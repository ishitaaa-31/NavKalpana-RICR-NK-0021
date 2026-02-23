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
      stations,
      currentCharge, 
       electricityRate = 8,
    } = req.body;

    if (
      !startLocation ||
      !destination ||
      !distance ||
      !batteryCapacity ||
      !efficiency ||
      !stations?.length ||
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
    const usableEnergy = bc * (usablePct / 100);
    const reserveEnergy = bc * (reservePct / 100);

   const currentEnergy = bc * (currentCharge / 100);

const firstRange = (currentEnergy - reserveEnergy) * eff;
const fullRange = (usableEnergy - reserveEnergy) * eff;
const totalEnergyRequired = distance / eff;
const totalCost = totalEnergyRequired * electricityRate;

    /* ---------------- STEP 1: FIND ENDPOINTS ---------------- */
    const endpoints = findAllBatteryEndpoints(
  routePolyline,
  firstRange,
  fullRange
);
    console.log("Battery Endpoints:", endpoints);

    /* ---------------- STEP 2: MAP TO STATIONS ---------------- */
    const recommendedStops = endpoints.map((ep) => {
      const station = findNearestStation(ep.point, stations);

      return {
        stopLocation: ep.point,
        stationName: station?.name,
        lat: station?.lat,
        lng: station?.lng,
        distanceCovered: ep.distanceCovered.toFixed(2),
      };
    });

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