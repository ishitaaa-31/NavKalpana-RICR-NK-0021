import axios from "axios";
import Route from "../models/routeModel.js";

/* ---------------- DISTANCE FUNCTION ---------------- */
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

/* ---------------- FIND ALL BATTERY ENDPOINTS ---------------- */
const findAllBatteryEndpoints = (route, firstRange, fullRange) => {
  let currentIndex = 0;
  let endpoints = [];
  let isFirst = true;

  while (currentIndex < route.length - 1) {
    let distanceCovered = 0;
    let maxRange = isFirst ? firstRange : fullRange;
    let found = false;

    for (let i = currentIndex + 1; i < route.length; i++) {
      const [lat1, lng1] = route[i - 1];
      const [lat2, lng2] = route[i];

      const segmentDist = getDistance(lat1, lng1, lat2, lng2);
      distanceCovered += segmentDist;

      if (distanceCovered >= maxRange) {
        endpoints.push({
          point: route[i],
          index: i,
          distanceCovered,
        });

        currentIndex = i;
        isFirst = false; // 🔥 after first stop
        found = true;
        break;
      }
    }

    if (!found) break;
  }

  return endpoints;
};

/* ---------------- FIND NEAREST STATION ---------------- */
const findNearestStation = (point, stations) => {
  let minDist = Infinity;
  let nearest = null;

  stations.forEach((station) => {
    const dist = getDistance(point[0], point[1], station.lat, station.lng);

    if (dist < minDist) {
      minDist = dist;
      nearest = station;
    }
  });

  return nearest;
};

/* ---------------- EV STATIONS API ---------------- */
export const getEVStations = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const response = await axios.get("https://api.openchargemap.io/v3/poi/", {
      params: {
        output: "json",
        latitude: lat,
        longitude: lng,
        distance: 200,
        maxresults: 100,
        key: process.env.OPENCHARGE_API_KEY,
      },
    });

    const stations = response.data.map((item) => ({
      name: item.AddressInfo?.Title,
      lat: item.AddressInfo?.Latitude,
      lng: item.AddressInfo?.Longitude,
    }));

    res.json(stations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching EV stations" });
  }
};

/* ---------------- MAIN TRIP PLANNER ---------------- */

const fetchStationsAtPoint = async (lat, lng) => {
  const response = await axios.get("https://api.openchargemap.io/v3/poi/", {
    params: {
      output: "json",
      latitude: lat,
      longitude: lng,
      distance: 80,
      maxresults: 20,
      key: process.env.OPENCHARGE_API_KEY,
    },
  });

  return response.data.map((item) => ({
    name: item.AddressInfo?.Title,
    lat: item.AddressInfo?.Latitude,
    lng: item.AddressInfo?.Longitude,
  }));
};

export const planEVTrip = async (req, res) => {
  try {
    const {
      startLocation,
      destination,
      distance,
      duration,
      routePolyline,
      batteryCapacity,
      efficiency,
      usablePercentage, // (not used in this logic, but kept as you send it)
      reservePercentage,
      currentCharge,
      electricityRate = 8,
    } = req.body;

    if (
      !startLocation ||
      !destination ||
      !distance ||
      !batteryCapacity ||
      !efficiency ||
      !routePolyline?.length
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* ---------------- BASIC VALUES ---------------- */
    const bc = Number(batteryCapacity); // kWh
    const eff = Number(efficiency); // km per kWh
    const reservePct = Number(reservePercentage);
    const currentChargePct = Number(currentCharge);

    /* ---------------- NEW: STOP BEFORE RESERVE ---------------- */
    // This is the key fix: we don't plan stops at "reserve", we plan BEFORE reserve.
    const bufferPct = 5; // ✅ tune 3–10 (means reserve 15% => plan stops at 20%)
    const minSoCPct = Math.min(95, reservePct + bufferPct);

    const reserveEnergy = bc * (reservePct / 100);
    const minSoCEnergy = bc * (minSoCPct / 100);

    // Current energy at start
    const currentEnergy = bc * (currentChargePct / 100);

    // Assume: at every station you charge to 80%
    const chargeTargetEnergy = bc * 0.8;

    // ✅ First leg range: from currentCharge down to minSoC (NOT to reserve)
    const firstUsableEnergy = currentEnergy - minSoCEnergy;
    const firstRange = Math.max(0, firstUsableEnergy) * eff;

    // ✅ Next legs range: from 80% down to minSoC (NOT to reserve)
    const usableEnergyAfterCharge = chargeTargetEnergy - minSoCEnergy;
    const fullRange = Math.max(0, usableEnergyAfterCharge) * eff;

    /* ---------------- TRIP ENERGY / COST ---------------- */
    const totalEnergyRequired = Number(distance) / eff; // kWh
    const totalCost = totalEnergyRequired * Number(electricityRate);

    /* ---------------- ENERGY DEFICIT (approx) ---------------- */
    // (kept similar to your earlier, not perfect but fine for estimate)
    const usableInitialEnergy = Math.max(0, currentEnergy - reserveEnergy);
    const energyDeficit = Math.max(0, totalEnergyRequired - usableInitialEnergy);

    const chargingPower = 50; // kW (assumed)
    const totalChargingTimeHours = energyDeficit / chargingPower;

    const energyLeft = currentEnergy + energyDeficit - totalEnergyRequired;
    const finalSoC = (energyLeft / bc) * 100;

    const safeEnergy = Math.max(0, energyLeft - reserveEnergy);
    const safeRange = safeEnergy * eff;

    /* ---------------- STEP 1: FIND ENDPOINTS (NOW EARLIER) ---------------- */
    const endpoints = findAllBatteryEndpoints(routePolyline, firstRange, fullRange);

    let stations = [];

    for (const ep of endpoints) {
      const [lat, lng] = ep.point;
      try {
        const nearbyStations = await fetchStationsAtPoint(lat, lng);
        stations.push(...nearbyStations);
      } catch (err) {
        console.error("Station fetch error:", err);
      }
    }

    // remove duplicates
    stations = Array.from(new Map(stations.map((s) => [`${s.lat}-${s.lng}`, s])).values());

    /* ---------------- STEP 2: MAP TO STATIONS ---------------- */
    let cumulativeDistance = 0;

    const recommendedStops = endpoints
      .map((ep) => {
        cumulativeDistance += ep.distanceCovered;

        const station = findNearestStation(ep.point, stations);
        if (!station) return null;

        return {
          stopLocation: ep.point,
          stationName: station.name,
          lat: station.lat,
          lng: station.lng,
          cumulativeDistance: cumulativeDistance.toFixed(2),
        };
      })
      .filter(Boolean);

    /* ---------------- SAVE ROUTE ---------------- */
    const savedRoute = await Route.create({
      startLocation,
      destination,
      distance,
      duration,
      chargingStops: recommendedStops.length,
    });

    /* ---------------- DEBUG (OPTIONAL) ---------------- */
    console.log("=== PLAN TRIP DEBUG (NEW) ===");
    console.log("Trip distance (km):", distance);
    console.log("firstRange:", firstRange.toFixed(2), "fullRange:", fullRange.toFixed(2));
    console.log("reservePct:", reservePct, "bufferPct:", bufferPct, "minSoCPct:", minSoCPct);
    console.log("recommendedStops:", recommendedStops.map((s) => s.cumulativeDistance));
    console.log("=============================");

    /* ---------------- RESPONSE ---------------- */
    res.status(200).json({
      routeId: savedRoute._id,
      totalStops: recommendedStops.length,
      recommendedStops,

      // show these too (useful for UI/debug)
      maxRange: fullRange.toFixed(2),
      minSoCPlanned: minSoCPct, // ✅ tells frontend you planned stops before reserve

      totalEnergyRequired: totalEnergyRequired.toFixed(2),
      totalCost: totalCost.toFixed(2),
      totalChargingTimeHours: totalChargingTimeHours.toFixed(2),
      finalSoC: finalSoC.toFixed(2),
      safeRange: safeRange.toFixed(2),
    });
  } catch (error) {
    console.error("EV Trip Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
export const getCoordinates = async (req, res) => {
  try {
    const { place } = req.query;

    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          format: "json",
          q: `${place},India`,
          limit: 1,
        },
        headers: {
          "User-Agent": "ev-planner-app", // IMPORTANT
        },
      },
    );

    if (!response.data.length) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.json({
      lat: parseFloat(response.data[0].lat),
      lng: parseFloat(response.data[0].lon),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Geocoding error" });
  }
};
export const getSoCCurve = async (req, res) => {
  try {
    const {
      distance,
      recommendedStops = [],
      batteryCapacity,
      efficiency,
      reservePercentage = 10, // kept for reference line, not for clamping
      currentCharge,
      chargeTargetPercentage = 80, // optional override
    } = req.body;

    const bc = Number(batteryCapacity);
    const eff = Number(efficiency);

    let currentEnergy = (bc * Number(currentCharge)) / 100; // kWh
    let lastDistance = 0;

    const socCurve = [];
    const STEP_KM = 10; // smoothness control

    // ✅ always sort stops by distance
    const stopsSorted = [...recommendedStops].sort(
      (a, b) => Number(a.cumulativeDistance) - Number(b.cumulativeDistance)
    );

    const pushDriveSegment = (fromKm, toKm) => {
      const start = Number(fromKm);
      const end = Number(toKm);

      // ✅ start from fromKm + STEP_KM to avoid duplicate point at segment start
      for (let km = start + STEP_KM; km <= end; km += STEP_KM) {
        const deltaKm = km - start;
        const energyUsed = deltaKm / eff;

        // ✅ NO reserve clamp — only clamp to 0 to avoid negatives
        const energyLeft = Math.max(currentEnergy - energyUsed, 0);

        socCurve.push({
          distance: Number(km.toFixed(1)),
          soc: Number(((energyLeft / bc) * 100).toFixed(2)),
          type: "drive",
        });
      }

      // update real energy after full segment
      const segmentEnergyUsed = (end - start) / eff;
      currentEnergy = Math.max(currentEnergy - segmentEnergyUsed, 0);
    };

    /* 🔋 START */
    socCurve.push({
      distance: 0,
      soc: Number(Number(currentCharge).toFixed(2)),
      type: "start",
    });

    /* 🔁 STOPS */
    for (const stop of stopsSorted) {
      const stopKm = Number(stop.cumulativeDistance);

      // 🚗 drive smoothly up to stop
      pushDriveSegment(lastDistance, stopKm);

      // ✅ add ARRIVAL point exactly at stopKm (before charging)
      socCurve.push({
        distance: Number(stopKm.toFixed(2)),
        soc: Number(((Math.max(currentEnergy, 0) / bc) * 100).toFixed(2)),
        type: "arrive",
      });

      // 🔌 charge bump slightly after the stop to show vertical jump
      currentEnergy = bc * (Number(chargeTargetPercentage) / 100);

      socCurve.push({
        distance: Number((stopKm + 0.2).toFixed(1)), // small epsilon to show jump
        soc: Number(Number(chargeTargetPercentage).toFixed(2)),
        type: "charge",
      });

      lastDistance = stopKm;
    }

    /* 🏁 FINAL LEG */
    pushDriveSegment(lastDistance, Number(distance));

    // ✅ add END point exactly at trip distance
    socCurve.push({
      distance: Number(Number(distance).toFixed(2)),
      soc: Number(((Math.max(currentEnergy, 0) / bc) * 100).toFixed(2)),
      type: "end",
    });

    // DEBUG
    console.log("=== SOC CURVE DEBUG ===");
    console.log("distance (km):", distance);
    console.log("stops:", stopsSorted.map((s) => s.cumulativeDistance));
    console.log("first 10 curve points:", socCurve.slice(0, 10));
    console.log("last 10 curve points:", socCurve.slice(-10));
    console.log("=======================");

    res.status(200).json({ socCurve });
  } catch (error) {
    console.error("SoC Curve Error:", error);
    res.status(500).json({
      message: "Failed to generate SoC curve",
      error: error.message,
    });
  }
};