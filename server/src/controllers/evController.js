import axios from "axios";
import Route from "../models/routeModel.js";
import ChargingStation from "../models/chargingStationModel.js";

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

export const planEVTrip = async (req, res) => {
  try {
    const {
      startLocation,
      destination,
      distance,
      duration,
      electricityRate = 8,
      batteryCapacity,
      efficiency,
      usablePercentage,
      reservePercentage,
      currentCharge,
      stations, // ✅ stations passed from frontend
    } = req.body;

    if (
      !startLocation ||
      !destination ||
      !distance ||
      !batteryCapacity ||
      !efficiency ||
      !stations?.length
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    /* ---------------- BASIC VALUES ---------------- */
    const bc = Number(batteryCapacity);     // kWh
    const eff = Number(efficiency);         // km/kWh
    const usablePct = Number(usablePercentage);
    const reservePct = Number(reservePercentage);
    const chargePct = Number(currentCharge);
    const tripDistance = Number(distance);

    /* ---------------- ENERGY CALCS ---------------- */
    const usableEnergy = bc * (usablePct / 100);
    const reserveEnergy = bc * (reservePct / 100);

    let currentEnergy = bc * (chargePct / 100);
    let remainingDistance = tripDistance;

    const totalEnergyRequired = tripDistance / eff;
    const safeRange = usableEnergy * eff;

    let chargingStops = [];
    let totalChargingTime = 0;
    let stationIndex = 0;

    /* ---------------- CHARGING LOGIC ---------------- */
    while (remainingDistance > (currentEnergy - reserveEnergy) * eff) {
      const maxDrivable = (currentEnergy - reserveEnergy) * eff;

      if (maxDrivable <= 0) break;

      // Drive till battery hits reserve
      remainingDistance -= maxDrivable;
      currentEnergy = reserveEnergy;

      // Pick next station (rotate to avoid repetition)
      const station = stations[stationIndex % stations.length];
      stationIndex++;

      const arrivalSoC = (currentEnergy / bc) * 100;

      const targetSoC = 80;
      const targetEnergy = bc * (targetSoC / 100);

      // Prevent negative charging
      const energyAdded = Math.max(0, targetEnergy - currentEnergy);

      const stationPower = station.powerOutput || 50;
      const chargingTime = energyAdded / stationPower;

      currentEnergy += energyAdded;
      totalChargingTime += chargingTime;

      chargingStops.push({
        stationName: station.name,
        arrivalSoC: arrivalSoC.toFixed(2),
        energyAdded: energyAdded.toFixed(2),
        chargingTimeHours: chargingTime.toFixed(2),
      });
    }

    /* ---------------- FINAL LEG ---------------- */
    const finalEnergyUsed = remainingDistance / eff;
    currentEnergy -= finalEnergyUsed;

    const finalSoC = (currentEnergy / bc) * 100;
    const totalCost = totalEnergyRequired * electricityRate;

    /* ---------------- SAVE ROUTE ---------------- */
    const savedRoute = await Route.create({
      startLocation,
      destination,
      distance: tripDistance,
      duration,
      batteryUsed: totalEnergyRequired,
      chargingStops: chargingStops.length,
    });

    /* ---------------- RESPONSE ---------------- */
    res.status(200).json({
      routeId: savedRoute._id,
      distance: tripDistance.toFixed(2),
      duration,
      totalEnergyRequired: totalEnergyRequired.toFixed(2),
      safeRange: safeRange.toFixed(2),
      finalSoC: finalSoC.toFixed(2),
      chargingStops,
      totalStops: chargingStops.length,
      totalChargingTimeHours: totalChargingTime.toFixed(2),
      totalCost: totalCost.toFixed(2),
    });
  } catch (error) {
    console.error("EV Trip Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};