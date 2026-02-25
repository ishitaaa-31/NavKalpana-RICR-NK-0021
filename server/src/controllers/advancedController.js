// controllers/advancedController.js
import { planEVTripCore } from "./evController.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function computeWeatherMultiplier(sim = {}) {
  const {
    temperatureC = 28,
    windType = "none", // none|headwind|tailwind
    hvacOn = true,
    weatherSensitivity = 0.5, // 0..1
  } = sim;

  let mult = 1;

  // Cold weather (<10C): +15% to +35% energy
  if (temperatureC < 10) {
    const t = clamp((10 - temperatureC) / 10, 0, 1);
    const add = (0.15 + 0.20 * t) * weatherSensitivity; // 0.15..0.35
    mult *= 1 + add;
  }

  // Very cold (<0C): extra up to +10%
  if (temperatureC < 0) {
    const t = clamp((0 - temperatureC) / 10, 0, 1);
    mult *= 1 + (0.10 * t) * weatherSensitivity;
  }

  // Wind
  if (windType === "headwind") mult *= 1 + 0.20 * weatherSensitivity; // +20%
  if (windType === "tailwind") mult *= 1 - 0.10 * weatherSensitivity; // -10%

  // HVAC small fixed bump
  if (hvacOn) mult *= 1 + 0.07 * weatherSensitivity; // +7%

  return clamp(mult, 0.7, 1.7);
}

function computeTrafficMultiplier(sim = {}) {
  const {
    trafficLevel = 0.4, // 0..1
    trafficSensitivity = 0.5, // 0..1
  } = sim;

  const x = clamp(trafficLevel, 0, 1);
  let add = 0;

  // Free-flow: slight overhead
  if (x < 0.34) add = 0.02;
  // Medium: +5% to +10%
  else if (x < 0.67) {
    const t = (x - 0.34) / (0.67 - 0.34);
    add = 0.05 + 0.05 * clamp(t, 0, 1);
  }
  // Heavy: +10% to +20%
  else {
    const t = (x - 0.67) / (1 - 0.67);
    add = 0.10 + 0.10 * clamp(t, 0, 1);
  }

  return clamp(1 + add * trafficSensitivity, 0.9, 1.35);
}

function computeDegradationPenalty(sim = {}) {
  const {
    soh = 95, // 70..100
    fastChargeUsage = 0.3, // 0..1
  } = sim;

  // Lower SoH reduces effective capacity (and worsens range)
  // We'll model as a penalty multiplier.
  const sohFactor = clamp((100 - soh) / 100, 0, 0.4);
  const fastFactor = clamp(fastChargeUsage, 0, 1);

  // mild penalty: up to ~25% worst case
  const mult = 1 + (0.12 * sohFactor + 0.05 * fastFactor);
  return clamp(mult, 1.0, 1.25);
}

/**
 * Advanced Trip Planner:
 * - takes same payload as old planTrip
 * - plus req.body.advancedSim (from toggles/sliders)
 * - modifies efficiency / battery / usable based on multipliers
 * - calls old core logic
 */
export const advancedPlanTrip = async (req, res, next) => {
  try {
    const body = req.body || {};

    // Basic required fields (same as old)
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
      currentCharge,
      electricityRate = 8,
      advancedSim = {},
    } = body;

    if (
      !startLocation ||
      !destination ||
      !distance ||
      !duration ||
      !Array.isArray(routePolyline) ||
      routePolyline.length < 2
    ) {
      return res.status(400).json({ message: "Missing route inputs" });
    }

    // multipliers
    const weatherMultiplier = computeWeatherMultiplier(advancedSim);
    const trafficMultiplier = computeTrafficMultiplier(advancedSim);
    const degradationPenalty = computeDegradationPenalty(advancedSim);
    const totalMultiplier = clamp(
      weatherMultiplier * trafficMultiplier * degradationPenalty,
      0.8,
      2.0
    );

    /**
     * KEY IDEA:
     * Old logic assumes efficiency = km/kWh.
     * If conditions worsen, you effectively get fewer km per kWh.
     *
     * So we can do:
     * newEfficiency = oldEfficiency / totalMultiplier
     *
     * Also SoH reduces effective capacity:
     * effectiveBattery = batteryCapacity * (soh/100)
     *
     * (You can choose either or both; doing both makes it stronger.)
     */

    const soh = clamp(Number(advancedSim.soh ?? 95), 70, 100);
    const effectiveBatteryCapacity = Number(batteryCapacity) * (soh / 100);

    const adjustedEfficiency = Number(efficiency) / totalMultiplier;

    // OPTIONAL: also reduce usable % slightly if very cold + HVAC
    // keep small so you don't break old system
    const extraUsableDrop = totalMultiplier > 1.25 ? 2 : 0; // 2% drop
    const adjustedUsable = clamp(Number(usablePercentage) - extraUsableDrop, 50, 100);

    const adjustedPayload = {
      startLocation,
      destination,
      distance,
      duration,
      routePolyline,

      batteryCapacity: effectiveBatteryCapacity,
      efficiency: adjustedEfficiency,
      usablePercentage: adjustedUsable,

      reservePercentage: Number(reservePercentage),
      currentCharge: Number(currentCharge),
      electricityRate,
    };

    // ✅ call old logic
   const base = await planEVTripCore(adjustedPayload);

    // Add metadata (so frontend can show sliders result)
    return res.status(200).json({
      ...base,

      advanced: {
        multipliers: {
          weatherMultiplier: Number(weatherMultiplier.toFixed(3)),
          trafficMultiplier: Number(trafficMultiplier.toFixed(3)),
          degradationPenalty: Number(degradationPenalty.toFixed(3)),
          totalMultiplier: Number(totalMultiplier.toFixed(3)),
        },
        adjustedInputs: {
          originalEfficiency: Number(efficiency),
          adjustedEfficiency: Number(adjustedEfficiency.toFixed(3)),
          originalBatteryCapacity: Number(batteryCapacity),
          adjustedBatteryCapacity: Number(effectiveBatteryCapacity.toFixed(2)),
          originalUsablePercentage: Number(usablePercentage),
          adjustedUsablePercentage: Number(adjustedUsable),
          soh,
        },
        receivedAdvancedSim: advancedSim,
      },
    });
  } catch (err) {
    next(err);
  }
};