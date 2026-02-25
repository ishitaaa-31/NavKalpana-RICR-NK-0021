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
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: { format: "json", q: `${place},India`, limit: 1 },
      headers: { "User-Agent": "ev-planner-app" },
      timeout: 15000,
    });

    if (!response.data.length) return res.status(404).json({ message: "Location not found" });

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
  const effectiveBc = bc * (usablePct / 100); // actual usable kWh
  const eff = Number(efficiency); // km/kWh
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

  // ------- Energy constants -------
  const reserveEnergy = effectiveBc * (reservePct / 100);
  const targetSoC = 80;
  const targetEnergy = effectiveBc * (targetSoC / 100);
  const chargingPower = 50; // kW

  // ------- 1) Subsample polyline for performance -------
  const SUBSAMPLE = Math.max(1, Math.floor(routePolyline.length / 1500));
  const poly = [];
  for (let i = 0; i < routePolyline.length; i += SUBSAMPLE) poly.push(routePolyline[i]);
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
    `${Math.round(lat * 100) / 100},${Math.round(lng * 100) / 100},r=${r},m=${m}`;

  const fetchStationsAtPoint = async (
    lat,
    lng,
    { radiusKm = 40, maxresults = 60, retries = 3, cacheTtlMs = 3600000 } = {}
  ) => {
    const key = cacheKey(lat, lng, radiusKm, maxresults);
    const now = Date.now();
    const cached = global.__OCP_CACHE__.get(key);
    if (cached && now - cached.ts < cacheTtlMs) return cached.data;

    let attempt = 0;
    while (attempt <= retries) {
      try {
        const response = await axios.get("https://api.openchargemap.io/v3/poi/", {
          params: {
            output: "json",
            latitude: lat,
            longitude: lng,
            distance: radiusKm,
            maxresults,
            key: process.env.OPENCHARGE_API_KEY,
          },
          timeout: 15000,
        });

        const data = (response.data || [])
          .map((item) => ({
            name: item.AddressInfo?.Title,
            lat: item.AddressInfo?.Latitude,
            lng: item.AddressInfo?.Longitude,
          }))
          .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));

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

  const fetchStationsWithExpand = async (lat, lng) => {
    for (const r of [25, 40, 60, 80, 120]) {
      const sts = await fetchStationsAtPoint(lat, lng, { radiusKm: r, maxresults: 60 });
      if (sts.length) return { stations: sts, radiusUsed: r, real: true };
    }
    return { stations: [], radiusUsed: 120, real: false };
  };

  // ------- 3) Stop selection loop -------
  const SEARCH_TRIGGER_RATIO = 0.70;
  const MAX_DIST_TO_ROUTE_KM = 15;
  const MAX_DETOUR_KM = 20;
  const SAMPLE_STRIDE = 5;

  let currentEnergy = effectiveBc * (startSoc / 100);
  let currentRouteKm = 0;
  let currentIndex = 0;
  const recommendedStops = [];

  const usableRangeKm = () => Math.max(0, (currentEnergy - reserveEnergy) * eff);

  while (currentRouteKm < tripKm && recommendedStops.length < 20) {
    const remainingTripKm = tripKm - currentRouteKm;

    if (usableRangeKm() >= remainingTripKm) {
      console.log(
        `✅ Can reach destination. Remaining range=${usableRangeKm().toFixed(1)}km`
      );
      break;
    }

    const searchAtKm = currentRouteKm + usableRangeKm() * SEARCH_TRIGGER_RATIO;

    let searchIndex = currentIndex;
    while (searchIndex < cumKm.length - 1 && cumKm[searchIndex] < searchAtKm) searchIndex++;
    if (searchIndex >= cumKm.length - 1) break;

    const [searchLat, searchLng] = poly[searchIndex];
    console.log(
      `🔍 Searching at km=${searchAtKm.toFixed(1)}, (${searchLat.toFixed(3)}, ${searchLng.toFixed(
        3
      )})`
    );

    const { stations: nearbyStations } = await fetchStationsWithExpand(searchLat, searchLng);

    const maxReachKm = currentRouteKm + usableRangeKm();
    const windowSamples = [];
    for (let i = currentIndex; i < cumKm.length; i += SAMPLE_STRIDE) {
      if (cumKm[i] > maxReachKm) break;
      const [lat, lng] = poly[i];
      windowSamples.push({ idx: i, lat, lng, km: cumKm[i] });
    }

    let chosen = null;

    // Try real stations
    if (nearbyStations.length && windowSamples.length) {
      const candidates = [];

      for (const st of nearbyStations) {
        let best = null;
        let bestD = Infinity;

        for (const p of windowSamples) {
          if (p.km < currentRouteKm + 5) continue;
          const d = getDistance(p.lat, p.lng, st.lat, st.lng);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }

        if (!best || bestD > MAX_DIST_TO_ROUTE_KM) continue;

        const detourKm = 2 * bestD;
        if (detourKm > MAX_DETOUR_KM) continue;

        const routeLegKm = best.km - currentRouteKm;
        if (routeLegKm <= 1) continue;

        const energyNeeded = (routeLegKm + detourKm) / eff;
        if (currentEnergy - energyNeeded < reserveEnergy) continue;

        const energyAfterArrival = currentEnergy - energyNeeded;
        const score = Math.abs(best.km - searchAtKm) + detourKm * 3;

        candidates.push({
          stationName: st.name || "EV Charging Station",
          lat: st.lat,
          lng: st.lng,
          routeKm: best.km,
          distToRouteKm: bestD,
          detourKm,
          energyAfterArrival,
          arrivalSoC: (energyAfterArrival / effectiveBc) * 100,
          score,
          isSynthetic: false,
        });
      }

      if (candidates.length) {
        candidates.sort((a, b) => a.score - b.score);
        chosen = candidates[0];
      }
    }

    // Fallback: synthetic stop on-route
    if (!chosen) {
      const stopKm = Math.min(searchAtKm, maxReachKm - 5);
      const stopIndex = findClosestIndexByKm(cumKm, stopKm, currentIndex);
      const [stopLat, stopLng] = poly[stopIndex];

      const routeLegKm = cumKm[stopIndex] - currentRouteKm;
      const energyNeeded = routeLegKm / eff;
      const energyAfterArrival = Math.max(reserveEnergy, currentEnergy - energyNeeded);

      console.log(`⚠️  No real station — synthetic stop at km=${stopKm.toFixed(1)}`);

      chosen = {
        stationName: "Charging Stop (Plan Ahead)",
        lat: stopLat,
        lng: stopLng,
        routeKm: cumKm[stopIndex],
        distToRouteKm: 0,
        detourKm: 0,
        energyAfterArrival,
        arrivalSoC: (energyAfterArrival / effectiveBc) * 100,
        score: 0,
        isSynthetic: true,
      };
    }

    currentEnergy = chosen.energyAfterArrival;

    recommendedStops.push({
      stationName: chosen.stationName,
      lat: chosen.lat,
      lng: chosen.lng,
      cumulativeDistance: Number(chosen.routeKm.toFixed(2)),
      distToRouteKm: Number(chosen.distToRouteKm.toFixed(2)),
      detourKm: Number(chosen.detourKm.toFixed(2)),
      arrivalSoC: Number(chosen.arrivalSoC.toFixed(2)),
      isSynthetic: chosen.isSynthetic,
    });

    console.log(
      `✅ Stop ${recommendedStops.length}: "${chosen.stationName}" @ ${chosen.routeKm.toFixed(
        1
      )}km` +
        ` | arrivalSoC=${chosen.arrivalSoC.toFixed(1)}% | synthetic=${chosen.isSynthetic}`
    );

    // charge to 80%
    currentEnergy = Math.min(targetEnergy, effectiveBc);
    currentRouteKm = chosen.routeKm;
    currentIndex = findClosestIndexByKm(cumKm, currentRouteKm, currentIndex);
  }

  // ------- 4) Analytics -------
  let simEnergy = effectiveBc * (startSoc / 100);
  let lastKm = 0;
  let detourTotalKm = 0;
  let totalChargingTimeHours = 0;

  for (const stop of recommendedStops) {
    const driveKm = stop.cumulativeDistance - lastKm;
    const detourKm = Number(stop.detourKm || 0);
    detourTotalKm += detourKm;

    simEnergy = Math.max(0, simEnergy - (driveKm + detourKm) / eff);

    const needToCharge = Math.max(0, targetEnergy - simEnergy);
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
    `Stops: ${recommendedStops.length} | Charging: ${totalChargingTimeHours.toFixed(2)}hrs`
  );
  console.log(`Final SoC: ${finalSoC.toFixed(2)}% | Safe range: ${safeRange.toFixed(2)}km`);
  console.log(`======================\n`);

  // ------- 5) Save -------
  const savedRoute = await Route.create({
    startLocation,
    destination,
    distance: tripKm,
    duration,
    chargingStops: recommendedStops.length,
  });

  // ------- 6) Return object (NO res here) -------
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
    // keep your previous behavior but cleaner
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

  if (!distance || !batteryCapacity || !efficiency || currentCharge === undefined) {
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
    });

    if (stop.detourKm > 0) {
      currentEnergy = Math.max(0, currentEnergy - stop.detourKm / eff);
      socCurve.push({
        distance: Number(stopKm.toFixed(1)),
        soc: Number(Math.max(0, (currentEnergy / effectiveBc) * 100).toFixed(2)),
        type: "detour",
      });
    }

    // charge to 80%
    currentEnergy = effectiveBc * 0.8;
    socCurve.push({ distance: Number((stopKm + 0.5).toFixed(1)), soc: 80, type: "charge" });

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