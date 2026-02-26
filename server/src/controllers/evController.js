// controllers/evController.js
import axios from "axios";
import Route from "../models/routeModel.js";

/* ---------------- DISTANCE FUNCTION (Haversine) ---------------- */
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

/* ---------------- HELPERS ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const findClosestIndexByKm = (cumKm, targetKm, startIdx = 0) => {
  let bestIdx = startIdx;
  let bestDiff = Infinity;
  for (let i = startIdx; i < cumKm.length; i++) {
    const diff = Math.abs(cumKm[i] - targetKm);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = i;
    }
    if (cumKm[i] > targetKm + 1) break;
  }
  return bestIdx;
};

/* ---------------- EV STATIONS DEBUG ENDPOINT ---------------- */
export const getEVStations = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    const response = await axios.get("https://api.openchargemap.io/v3/poi/", {
      params: {
        output: "json",
        latitude: lat,
        longitude: lng,
        distance: 80,
        maxresults: 50,
        key: process.env.OPENCHARGE_API_KEY,
      },
      timeout: 15000,
    });

    const stations = (response.data || [])
      .map((item) => ({
        name: item.AddressInfo?.Title,
        lat: item.AddressInfo?.Latitude,
        lng: item.AddressInfo?.Longitude,
      }))
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));

    res.json(stations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching EV stations" });
  }
};

/* ---------------- GEOCODE ---------------- */
export const getCoordinates = async (req, res) => {
  try {
    const { place } = req.query;
    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: { format: "json", q: `${place},India`, limit: 1 },
        headers: { "User-Agent": "ev-planner-app" },
        timeout: 15000,
      },
    );

    if (!response.data.length)
      return res.status(404).json({ message: "Location not found" });

    res.json({
      lat: parseFloat(response.data[0].lat),
      lng: parseFloat(response.data[0].lon),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Geocoding error" });
  }
};

/* ---------------- CORE TRIP PLANNER (REUSABLE) ---------------- */
export const planEVTripCore = async (payload) => {
  const {
    startLocation,
    destination,
    distance,
    duration,
    routePolyline,
    batteryCapacity,
    efficiency,
    reservePercentage,
    usablePercentage,
    currentCharge,
    electricityRate = 8,
  } = payload || {};

  // ------- Validate -------
  if (
    !startLocation ||
    !destination ||
    distance === undefined ||
    !batteryCapacity ||
    !efficiency ||
    !Array.isArray(routePolyline) ||
    routePolyline.length < 2 ||
    currentCharge === undefined
  ) {
    const err = new Error("Missing required fields");
    err.statusCode = 400;
    throw err;
  }

  const bc = Number(batteryCapacity);
  const usablePct = Number(usablePercentage ?? 100);
  const effectiveBc = bc * (usablePct / 100);
  const eff = Number(efficiency);
  const tripKm = Number(distance);
  const reservePct = Number(reservePercentage ?? 15);
  const startSoc = Number(currentCharge);

  if (
    !Number.isFinite(bc) ||
    !Number.isFinite(eff) ||
    !Number.isFinite(tripKm) ||
    !Number.isFinite(reservePct) ||
    !Number.isFinite(startSoc) ||
    bc <= 0 ||
    eff <= 0 ||
    tripKm <= 0 ||
    startSoc <= 0 ||
    startSoc > 100 ||
    reservePct < 0 ||
    reservePct >= 100
  ) {
    const err = new Error("Invalid numeric inputs");
    err.statusCode = 400;
    throw err;
  }

  const reserveEnergy = effectiveBc * (reservePct / 100);
  const targetSoC = 80;
  const targetEnergy = effectiveBc * (targetSoC / 100);
  const chargingPower = 50; // kW

  // ------- 1) Subsample polyline -------
  const SUBSAMPLE = Math.max(1, Math.floor(routePolyline.length / 1500));
  const poly = [];
  for (let i = 0; i < routePolyline.length; i += SUBSAMPLE)
    poly.push(routePolyline[i]);
  if (poly[poly.length - 1] !== routePolyline[routePolyline.length - 1])
    poly.push(routePolyline[routePolyline.length - 1]);

  const cumKm = new Array(poly.length).fill(0);
  for (let i = 1; i < poly.length; i++) {
    const [lat1, lng1] = poly[i - 1];
    const [lat2, lng2] = poly[i];
    cumKm[i] = cumKm[i - 1] + getDistance(lat1, lng1, lat2, lng2);
  }

  // ------- 2) OpenChargeMap fetch with cache + retry -------
  global.__OCP_CACHE__ = global.__OCP_CACHE__ || new Map();

  const cacheKey = (lat, lng, r, m) =>
    `${Math.round(lat * 10) / 10},${Math.round(lng * 10) / 10},r=${r},m=${m}`;

  const fetchStationsAtPoint = async (
    lat,
    lng,
    { radiusKm = 40, maxresults = 60, retries = 3, cacheTtlMs = 3600000 } = {},
  ) => {
    const key = cacheKey(lat, lng, radiusKm, maxresults);
    const now = Date.now();
    const cached = global.__OCP_CACHE__.get(key);
    if (cached && now - cached.ts < cacheTtlMs) return cached.data;

    let attempt = 0;
    while (attempt <= retries) {
      try {
        const response = await axios.get(
          "https://api.openchargemap.io/v3/poi/",
          {
            params: {
              output: "json",
              latitude: lat,
              longitude: lng,
              distance: radiusKm,
              maxresults,
              key: process.env.OPENCHARGE_API_KEY,
            },
            timeout: 15000,
          },
        );

        const data = (response.data || [])
          .map((item) => ({
            name: item.AddressInfo?.Title || "Unknown",
            lat: item.AddressInfo?.Latitude,
            lng: item.AddressInfo?.Longitude,
          }))
          .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
          // Deterministic sort — API result order must never affect the trip plan
          .sort((a, b) => {
            const nc = a.name.localeCompare(b.name);
            if (nc !== 0) return nc;
            if (a.lat !== b.lat) return a.lat - b.lat;
            return a.lng - b.lng;
          });

        global.__OCP_CACHE__.set(key, { ts: now, data });
        return data;
      } catch (err) {
        if (err?.response?.status === 429 && attempt < retries) {
          await sleep(800 * Math.pow(2, attempt));
          attempt++;
        } else {
          throw err;
        }
      }
    }
    return [];
  };

  // ------- 3) Candidate scorer (shared by Pass 1 & Pass 2) -------
  const MIN_STOP_GAP_KM = 60;
  const SAMPLE_STRIDE = 5;

  const scoreCandidates = (
    stations,
    windowSamples,
    currentRouteKm,
    visitedKeys,
    maxDistToRoute,
    maxDetour,
    currentEnergyVal,
  ) => {
    const stationKey = (lat, lng) =>
      `${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000}`;

    const candidates = [];

    for (const st of stations) {
      const sk = stationKey(st.lat, st.lng);
      if (visitedKeys.has(sk)) continue;

      let best = null;
      let bestD = Infinity;

      for (const p of windowSamples) {
        if (p.km < currentRouteKm + MIN_STOP_GAP_KM) continue;
        const d = getDistance(p.lat, p.lng, st.lat, st.lng);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }

      if (!best || bestD > maxDistToRoute) continue;

      const detourKm = 2 * bestD;
      if (detourKm > maxDetour) continue;

      const routeLegKm = best.km - currentRouteKm;
      if (routeLegKm <= 1) continue;

      const energyNeeded = (routeLegKm + detourKm) / eff;
      if (currentEnergyVal - energyNeeded < reserveEnergy) continue;

      const energyAfterArrival = currentEnergyVal - energyNeeded;
      // Prefer farthest reachable station → fewest total stops
      const score = -best.km + detourKm * 1.5;

      candidates.push({
        stationName: st.name,
        lat: st.lat,
        lng: st.lng,
        routeKm: best.km,
        distToRouteKm: bestD,
        detourKm,
        energyAfterArrival,
        arrivalSoC: (energyAfterArrival / effectiveBc) * 100,
        score,
        isSynthetic: false,
        stationKey: sk,
      });
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
      const diff = a.score - b.score;
      if (Math.abs(diff) > 0.001) return diff;
      return a.stationName.localeCompare(b.stationName);
    });

    return candidates[0];
  };

  // ------- 4) Stop selection loop -------
  const SEARCH_TRIGGER_RATIO = 0.75;

  let currentEnergy = effectiveBc * (startSoc / 100);
  let currentRouteKm = 0;
  let currentIndex = 0;
  const recommendedStops = [];
  const visitedStationKeys = new Set();
  const stationKey = (lat, lng) =>
    `${Math.round(lat * 1000) / 1000},${Math.round(lng * 1000) / 1000}`;

  // Tracks whether the last stop was already boosted to 100% for the gap strategy
  let lastStopAlreadyBoosted = false;

  const usableRangeKm = () =>
    Math.max(0, (currentEnergy - reserveEnergy) * eff);

  while (currentRouteKm < tripKm && recommendedStops.length < 20) {
    const remainingTripKm = tripKm - currentRouteKm;

    if (usableRangeKm() >= remainingTripKm) {
      console.log(
        `✅ Can reach destination. Range left=${usableRangeKm().toFixed(1)}km`,
      );
      break;
    }

    const searchAtKm = currentRouteKm + usableRangeKm() * SEARCH_TRIGGER_RATIO;

    let searchIndex = currentIndex;
    while (searchIndex < cumKm.length - 1 && cumKm[searchIndex] < searchAtKm)
      searchIndex++;
    if (searchIndex >= cumKm.length - 1) break;

    const [searchLat, searchLng] = poly[searchIndex];

    const maxReachKm = currentRouteKm + usableRangeKm();
    const windowSamples = [];
    for (let i = currentIndex; i < cumKm.length; i += SAMPLE_STRIDE) {
      if (cumKm[i] > maxReachKm) break;
      const [lat, lng] = poly[i];
      windowSamples.push({ idx: i, lat, lng, km: cumKm[i] });
    }

    let chosen = null;

    // ── PASS 1: normal radius, station ≤25 km from route ──────────────────
    if (!chosen) {
      for (const r of [25, 40, 60, 80, 120]) {
        const stations = await fetchStationsAtPoint(searchLat, searchLng, {
          radiusKm: r,
        });
        if (!stations.length) continue;
        const best = scoreCandidates(
          stations,
          windowSamples,
          currentRouteKm,
          visitedStationKeys,
          25,
          30,
          currentEnergy,
        );
        if (best) {
          chosen = best;
          console.log(`✅ Pass 1 station @ r=${r}km: "${best.stationName}"`);
          break;
        }
      }
    }

    // ── PASS 2: wider radius, station ≤10 km from route (small real detour) ─
    if (!chosen) {
      console.log(`🔄 Pass 2 — wider search, tight route proximity`);
      for (const r of [140, 160, 200]) {
        const stations = await fetchStationsAtPoint(searchLat, searchLng, {
          radiusKm: r,
          maxresults: 80,
        });
        if (!stations.length) continue;
        const best = scoreCandidates(
          stations,
          windowSamples,
          currentRouteKm,
          visitedStationKeys,
          10,
          20,
          currentEnergy,
        );
        if (best) {
          chosen = best;
          console.log(
            `✅ Pass 2 station @ r=${r}km (tight detour): "${best.stationName}"`,
          );
          break;
        }
      }
    }

    // ── PASS 3: boost last stop to 100% charge, retry ─────────────────────
    if (!chosen && recommendedStops.length > 0 && !lastStopAlreadyBoosted) {
      const lastStop = recommendedStops[recommendedStops.length - 1];
      lastStop.chargeToPercent = 100;
      lastStop.chargeToFull = true;
      lastStop.note =
        "Charge to 100% here — sparse charging ahead. " +
        "Full charge gives maximum range to reach the next station.";

      currentEnergy = effectiveBc; // simulate full charge
      lastStopAlreadyBoosted = true;

      console.log(
        `🔋 Pass 3 — boosted "${lastStop.stationName}" to 100%. Retrying iteration...`,
      );
      continue; // retry this whole iteration with more energy
    }

    // ── PASS 4: synthetic PlugShare stop ──────────────────────────────────
    // All real-station options exhausted. Place a stop at 80% of remaining
    // range on the actual route polyline. Battery is drained by distance / eff
    // (no detour since the stop is on-route). Tell the user to find a real
    // charger here via PlugShare.
    if (!chosen) {
      lastStopAlreadyBoosted = false; // reset for next segment

      const stopKm = Math.min(
        currentRouteKm + usableRangeKm() * 0.8,
        maxReachKm - 5,
      );
      const stopIndex = findClosestIndexByKm(cumKm, stopKm, currentIndex);
      const [stopLat, stopLng] = poly[stopIndex];

      const routeLegKm = cumKm[stopIndex] - currentRouteKm;
      const energyNeeded = routeLegKm / eff; // drain = distance / efficiency
      const energyAfterArrival = Math.max(
        reserveEnergy,
        currentEnergy - energyNeeded,
      );

      // PlugShare deep-link — opens the map centred on this coordinate
      const plugshareUrl = `https://www.plugshare.com/?latitude=${stopLat.toFixed(5)}&longitude=${stopLng.toFixed(5)}&zoomLevel=14`;

      console.log(
        `⚠️  Pass 4 — synthetic PlugShare stop at km=${stopKm.toFixed(1)}`,
      );

      chosen = {
        stationName: "Find a Charger Here",
        lat: stopLat,
        lng: stopLng,
        routeKm: cumKm[stopIndex],
        distToRouteKm: 0,
        detourKm: 0,
        energyAfterArrival,
        arrivalSoC: (energyAfterArrival / effectiveBc) * 100,
        isSynthetic: true,
        stationKey: null,
        plugshareUrl,
        note:
          "No charging station found in our database for this area. " +
          "You will need to find a charger here — tap the PlugShare link to locate one near this point.",
      };
    }

    // ── Commit the chosen stop ─────────────────────────────────────────────
    if (chosen.stationKey) visitedStationKeys.add(chosen.stationKey);
    lastStopAlreadyBoosted = false;
    currentEnergy = chosen.energyAfterArrival;

    const stopRecord = {
      stationName: chosen.stationName,
      lat: chosen.lat,
      lng: chosen.lng,
      cumulativeDistance: Number(chosen.routeKm.toFixed(2)),
      distToRouteKm: Number(chosen.distToRouteKm.toFixed(2)),
      detourKm: Number(chosen.detourKm.toFixed(2)),
      arrivalSoC: Number(chosen.arrivalSoC.toFixed(2)),
      isSynthetic: chosen.isSynthetic || false,
      chargeToPercent: chosen.chargeToPercent ?? 80,
      ...(chosen.plugshareUrl && { plugshareUrl: chosen.plugshareUrl }),
      ...(chosen.note && { note: chosen.note }),
    };

    recommendedStops.push(stopRecord);

    console.log(
      `✅ Stop ${recommendedStops.length}: "${chosen.stationName}" ` +
        `@ ${chosen.routeKm.toFixed(1)}km | arrivalSoC=${chosen.arrivalSoC.toFixed(1)}% ` +
        `| synthetic=${chosen.isSynthetic || false}`,
    );

    // Charge to target (80% normally, 100% if boosted by Pass 3)
    currentEnergy = effectiveBc * (stopRecord.chargeToPercent / 100);
    currentRouteKm = chosen.routeKm;
    currentIndex = findClosestIndexByKm(cumKm, currentRouteKm, currentIndex);
  }

  // ------- 5) Analytics -------
  let simEnergy = effectiveBc * (startSoc / 100);
  let lastKm = 0;
  let detourTotalKm = 0;
  let totalChargingTimeHours = 0;

  for (const stop of recommendedStops) {
    const driveKm = stop.cumulativeDistance - lastKm;
    const detourKm = Number(stop.detourKm || 0);
    detourTotalKm += detourKm;

    simEnergy = Math.max(0, simEnergy - (driveKm + detourKm) / eff);

    const chargeTarget = effectiveBc * ((stop.chargeToPercent ?? 80) / 100);
    const needToCharge = Math.max(0, chargeTarget - simEnergy);
    totalChargingTimeHours += needToCharge / chargingPower;
    simEnergy += needToCharge;

    lastKm = stop.cumulativeDistance;
  }

  const finalDriveKm = tripKm - lastKm;
  simEnergy = Math.max(0, simEnergy - finalDriveKm / eff);
  const totalKmWithDetours = tripKm + detourTotalKm;
  const totalEnergyRequired = totalKmWithDetours / eff;
  const totalCost = totalEnergyRequired * Number(electricityRate);
  const finalSoC = Math.max(0, (simEnergy / effectiveBc) * 100);
  const safeRange = Math.max(0, (simEnergy - reserveEnergy) * eff);

  console.log(`\n==== TRIP SUMMARY ====`);
  console.log(
    `Stops: ${recommendedStops.length} | Charging: ${totalChargingTimeHours.toFixed(2)}hrs`,
  );
  console.log(
    `Final SoC: ${finalSoC.toFixed(2)}% | Safe range: ${safeRange.toFixed(2)}km`,
  );
  console.log(`======================\n`);

  // ------- 6) Save -------
  const savedRoute = await Route.create({
    startLocation,
    destination,
    distance: tripKm,
    duration,
    chargingStops: recommendedStops.length,
  });

  // ------- 7) Return -------
  return {
    message:
      recommendedStops.length > 0
        ? `Trip planned with ${recommendedStops.length} charging stop(s).`
        : "No charging stops needed — battery sufficient for full trip.",
    routeId: savedRoute._id,
    totalStops: recommendedStops.length,
    recommendedStops,
    totalDistance: tripKm,
    suggestedStations: [],
    totalEnergyRequired: totalEnergyRequired.toFixed(2),
    totalCost: totalCost.toFixed(2),
    totalChargingTimeHours: totalChargingTimeHours.toFixed(2),
    finalSoC: finalSoC.toFixed(2),
    safeRange: safeRange.toFixed(2),
    totalDetourKm: detourTotalKm.toFixed(2),
  };
};

/* ---------------- MAIN TRIP PLANNER ENDPOINT ---------------- */
export const planEVTrip = async (req, res, next) => {
  try {
    const data = await planEVTripCore(req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error("EV Trip Error:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      message: status === 500 ? "Server error" : error.message,
      error: error.message,
    });
  }
};

/* ---------------- SoC CURVE CORE (REUSABLE) ---------------- */
export const getSoCCurveCore = async (payload) => {
  const {
    distance,
    recommendedStops = [],
    batteryCapacity,
    efficiency,
    reservePercentage = 15,
    currentCharge,
    usablePercentage,
  } = payload || {};

  if (
    !distance ||
    !batteryCapacity ||
    !efficiency ||
    currentCharge === undefined
  ) {
    const err = new Error("Missing required fields");
    err.statusCode = 400;
    throw err;
  }

  const tripKm = Number(distance);
  const bc = Number(batteryCapacity);
  const usablePct = Number(usablePercentage ?? 100);
  const effectiveBc = bc * (usablePct / 100);
  const eff = Number(efficiency);
  const STEP_KM = 5;

  let currentEnergy = (effectiveBc * Number(currentCharge)) / 100;
  let lastRouteKm = 0;
  const socCurve = [];

  const pushDrive = (fromKm, toKm) => {
    if (toKm <= fromKm) return;
    const energyAtStart = currentEnergy;
    for (let km = fromKm + STEP_KM; km < toKm; km += STEP_KM) {
      const energyLeft = Math.max(0, energyAtStart - (km - fromKm) / eff);
      socCurve.push({
        distance: Number(km.toFixed(1)),
        soc: Number(((energyLeft / effectiveBc) * 100).toFixed(2)),
        type: "drive",
      });
    }
    currentEnergy = Math.max(0, energyAtStart - (toKm - fromKm) / eff);
  };

  socCurve.push({
    distance: 0,
    soc: Number(Number(currentCharge).toFixed(2)),
    type: "start",
  });

  const stops = [...recommendedStops]
    .map((s) => ({
      ...s,
      routeKm: Number(s.cumulativeDistance),
      detourKm: Number(s.detourKm || 0),
      chargeToPercent: s.chargeToPercent ?? 80,
    }))
    .filter((s) => Number.isFinite(s.routeKm))
    .sort((a, b) => a.routeKm - b.routeKm);

  for (const stop of stops) {
    const stopKm = stop.routeKm;

    pushDrive(lastRouteKm, stopKm);

    socCurve.push({
      distance: Number(stopKm.toFixed(1)),
      soc: Number(Math.max(0, (currentEnergy / effectiveBc) * 100).toFixed(2)),
      type: "arrive_route",
      isSynthetic: stop.isSynthetic || false,
    });

    if (stop.detourKm > 0) {
      currentEnergy = Math.max(0, currentEnergy - stop.detourKm / eff);
      socCurve.push({
        distance: Number(stopKm.toFixed(1)),
        soc: Number(
          Math.max(0, (currentEnergy / effectiveBc) * 100).toFixed(2),
        ),
        type: "detour",
        isSynthetic: stop.isSynthetic || false,
      });
    }

    // Charge to target — 80% normally, 100% if this stop was boosted by Pass 3
    currentEnergy = effectiveBc * (stop.chargeToPercent / 100);
    socCurve.push({
      distance: Number((stopKm + 0.5).toFixed(1)),
      soc: stop.chargeToPercent,
      type: "charge",
      isSynthetic: stop.isSynthetic || false,
      chargeToFull: stop.chargeToPercent === 100,
    });

    lastRouteKm = stopKm;
  }

  pushDrive(lastRouteKm, tripKm);

  socCurve.push({
    distance: Number(tripKm.toFixed(1)),
    soc: Number(Math.max(0, (currentEnergy / effectiveBc) * 100).toFixed(2)),
    type: "end",
  });

  return {
    socCurve,
    reserveSoC: reservePercentage,
    minSoc: Math.min(...socCurve.map((p) => p.soc)),
  };
};

/* ---------------- SoC CURVE ENDPOINT ---------------- */
export const getSoCCurve = async (req, res) => {
  try {
    const data = await getSoCCurveCore(req.body);
    return res.status(200).json(data);
  } catch (error) {
    console.error("SoC Curve Error:", error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      message: status === 500 ? "Failed to generate SoC curve" : error.message,
      error: error.message,
    });
  }
};
