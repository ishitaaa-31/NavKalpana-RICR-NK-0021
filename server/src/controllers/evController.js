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
    const dist = getDistance(
      point[0],
      point[1],
      station.lat,
      station.lng
    );

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

    const response = await axios.get(
      "https://api.openchargemap.io/v3/poi/",
      {
        params: {
          output: "json",
          latitude: lat,
          longitude: lng,
          distance: 200,
          maxresults: 100,
          key: process.env.OPENCHARGE_API_KEY,
        },
      }
    );

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
  const response = await axios.get(
    "https://api.openchargemap.io/v3/poi/",
    {
      params: {
        output: "json",
        latitude: lat,
        longitude: lng,
        distance: 80,
        maxresults: 20,
        key: process.env.OPENCHARGE_API_KEY,
      },
    }
  );

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
      usablePercentage,
      reservePercentage,
      //stations,
      currentCharge, 
       electricityRate = 8,
    } = req.body;

    if (
      !startLocation ||
      !destination ||
      !distance ||
      !batteryCapacity ||
      !efficiency ||
      //!stations?.length ||
      !routePolyline?.length
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* ---------------- BASIC VALUES ---------------- */
    const bc = Number(batteryCapacity);
    const eff = Number(efficiency);
    const usablePct = Number(usablePercentage);
    const reservePct = Number(reservePercentage);

    /* ---------------- RANGE CALC ---------------- */
   /* ---------------- RANGE CALC ---------------- */
const reserveEnergy = bc * (reservePct / 100);

// 🔋 Current battery (first stretch)
const currentEnergy = bc * (currentCharge / 100);
const firstUsableEnergy = currentEnergy - reserveEnergy;
const firstRange = firstUsableEnergy * eff;

// 🔋 Full battery (after charging, but keeping reserve)
const usableEnergy = bc - reserveEnergy;
const fullRange = usableEnergy * eff;
const totalEnergyRequired = distance / eff;



/* ---------------- ENERGY CALCULATIONS ---------------- */

// 🔋 Initial energy
const initialEnergy = bc * (currentCharge / 100);

// 🔋 Reserve energy (already calculated above)
//const reserveEnergy = bc * (reservePct / 100);

// 🔋 Usable initial energy
const usableInitialEnergy = Math.max(0, initialEnergy - reserveEnergy);

// ⚡ Total energy needed for trip
//const totalEnergyRequired = distance / eff;

// ⚡ Energy deficit (how much we need to charge)
const energyDeficit = Math.max(0, totalEnergyRequired - usableInitialEnergy);

// 🔌 Assume charging power (kW)
const chargingPower = 50; // you can change later

// ⏱️ Total charging time
const totalChargingTimeHours = energyDeficit / chargingPower;

// 🔋 Energy left after trip
const energyLeft = initialEnergy + energyDeficit - totalEnergyRequired;

// 🔋 Final battery %
const finalSoC = (energyLeft / bc) * 100;

// 📏 Safe range (after keeping reserve)
const safeEnergy = Math.max(0, energyLeft - reserveEnergy);
const safeRange = safeEnergy * eff;












const totalCost = totalEnergyRequired * electricityRate;

    /* ---------------- STEP 1: FIND ENDPOINTS ---------------- */
    const endpoints = findAllBatteryEndpoints(
  routePolyline,
  firstRange,
  fullRange
);

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
stations = Array.from(
  new Map(stations.map(s => [`${s.lat}-${s.lng}`, s])).values()
);




    console.log("Battery Endpoints:", endpoints);

    /* ---------------- STEP 2: MAP TO STATIONS ---------------- */
    let cumulativeDistance = 0;

const recommendedStops = endpoints.map((ep) => {
  cumulativeDistance += ep.distanceCovered;

  const station = findNearestStation(ep.point, stations);

  if (!station) return null;

  return {
    stopLocation: ep.point,
    stationName: station.name,
    lat: station.lat,
    lng: station.lng,

    // ✅ cumulative distance
    cumulativeDistance: cumulativeDistance.toFixed(2),
  };
}).filter(Boolean);

    /* ---------------- SAVE ROUTE ---------------- */
    const savedRoute = await Route.create({
      startLocation,
      destination,
      distance,
      duration,
      chargingStops: recommendedStops.length,
    });

    /* ---------------- RESPONSE ---------------- */
    res.status(200).json({
      routeId: savedRoute._id,
      totalStops: recommendedStops.length,
      recommendedStops,
      maxRange: fullRange.toFixed(2),
      totalEnergyRequired: totalEnergyRequired.toFixed(2), // ✅ ADD
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
      }
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