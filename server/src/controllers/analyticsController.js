import { planEVTripCore } from "./evController.js";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const getTimeBreakdown = async (req, res) => {
  try {
    const body = req.body || {};
    const trip = await planEVTripCore(body);

    const durationMin = Number(body.duration);
    const drivingHoursTotal = Number.isFinite(durationMin) ? durationMin / 60 : 0;

    const totalDistance = Number(trip.totalDistance || body.distance || 0);
    const avgSpeed = drivingHoursTotal > 0 ? totalDistance / drivingHoursTotal : 60;

    const bc = Number(body.batteryCapacity);
    const eff = Number(body.efficiency);
    const usablePct = Number(body.usablePercentage ?? 100);
    const reservePct = Number(body.reservePercentage ?? 15);
    const startSoc = Number(body.currentCharge);

    const effectiveBc = bc * (usablePct / 100);
    const reserveEnergy = effectiveBc * (reservePct / 100);
    const targetEnergy = effectiveBc * 0.8;
    const chargingPower = 50;

    let currentEnergy = effectiveBc * (startSoc / 100);

    const stops = (trip.recommendedStops || [])
      .map((s) => ({
        km: Number(s.cumulativeDistance),
        detourKm: Number(s.detourKm || 0),
        name: s.stationName || "Charging Stop",
      }))
      .filter((s) => Number.isFinite(s.km))
      .sort((a, b) => a.km - b.km);

    const segments = [];
    let lastKm = 0;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const driveKm = Math.max(0, stop.km - lastKm);
      const detourKm = Math.max(0, stop.detourKm);
      const totalDriveKm = driveKm + detourKm;

      const driveEnergy = eff > 0 ? totalDriveKm / eff : 0;
      currentEnergy = Math.max(0, currentEnergy - driveEnergy);

      const needToCharge = Math.max(0, targetEnergy - currentEnergy);
      const chargingHours = needToCharge / chargingPower;

      currentEnergy = Math.min(targetEnergy, effectiveBc);

      const drivingHours = avgSpeed > 0 ? totalDriveKm / avgSpeed : 0;

      segments.push({
        label: i === 0 ? "Start → Stop 1" : `Stop ${i} → Stop ${i + 1}`,
        drivingHours: Number(drivingHours.toFixed(2)),
        chargingHours: Number(chargingHours.toFixed(2)),
      });

      lastKm = stop.km;
    }

    const finalDriveKm = Math.max(0, totalDistance - lastKm);
    const finalDrivingHours = avgSpeed > 0 ? finalDriveKm / avgSpeed : 0;

    if (totalDistance > 0) {
      segments.push({
        label: stops.length ? `Stop ${stops.length} → Destination` : "Start → Destination",
        drivingHours: Number(finalDrivingHours.toFixed(2)),
        chargingHours: 0,
      });
    }

    const chargingHoursTotal = segments.reduce((a, s) => a + s.chargingHours, 0);
    const totalTripHours = drivingHoursTotal + chargingHoursTotal;

    return res.status(200).json({
      totals: {
        drivingHours: Number(drivingHoursTotal.toFixed(2)),
        chargingHours: Number(chargingHoursTotal.toFixed(2)),
        totalTripHours: Number(totalTripHours.toFixed(2)),
      },
      segments,
    });
  } catch (error) {
    console.error("Time breakdown error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to compute time breakdown",
    });
  }
};

// ── Energy Per Segment ────────────────────────────────────────────────────────
export const getEnergyPerSegment = async (req, res) => {
  try {
    const body = req.body || {};
    const trip = await planEVTripCore(body);

    const eff        = Number(body.efficiency);               // km/kWh
    const bc         = Number(body.batteryCapacity);
    const usablePct  = Number(body.usablePercentage  ?? 100);
    const reservePct = Number(body.reservePercentage ?? 15);
    const startSoc   = Number(body.currentCharge);

    const effectiveBc    = bc * (usablePct / 100);
    const targetEnergy   = effectiveBc * 0.8;               // charge-to-80% target
    const chargingPower  = 50;                              // kW (same assumption as getTimeBreakdown)

    const totalDistance = Number(trip.totalDistance || body.distance || 0);

    const stops = (trip.recommendedStops || [])
      .map((s) => ({
        km:       Number(s.cumulativeDistance),
        detourKm: Number(s.detourKm || 0),
      }))
      .filter((s) => Number.isFinite(s.km))
      .sort((a, b) => a.km - b.km);

    let currentEnergy = effectiveBc * (startSoc / 100);
    let lastKm        = 0;
    const segments    = [];

    for (let i = 0; i < stops.length; i++) {
      const stop        = stops[i];
      const driveKm     = Math.max(0, stop.km - lastKm);
      const detourKm    = Math.max(0, stop.detourKm);
      const totalDriveKm = driveKm + detourKm;

      // Energy consumed driving this segment
      const driveEnergy = eff > 0 ? totalDriveKm / eff : 0;
      currentEnergy     = Math.max(0, currentEnergy - driveEnergy);

      // Energy recharged at this stop
      const energyRecharged = Math.max(0, targetEnergy - currentEnergy);

      // Advance SoC after charging
      currentEnergy = Math.min(targetEnergy, effectiveBc);

      segments.push({
        label:            i === 0 ? "Start → Stop 1" : `Stop ${i} → Stop ${i + 1}`,
        driveKm:          Number(totalDriveKm.toFixed(2)),
        driveEnergyKwh:   Number(driveEnergy.toFixed(2)),
        rechargedKwh:     Number(energyRecharged.toFixed(2)),
      });

      lastKm = stop.km;
    }

    // Final leg — no recharge
    const finalDriveKm    = Math.max(0, totalDistance - lastKm);
    const finalDriveEnergy = eff > 0 ? finalDriveKm / eff : 0;
    currentEnergy          = Math.max(0, currentEnergy - finalDriveEnergy);

    segments.push({
      label:          stops.length ? `Stop ${stops.length} → Destination` : "Start → Destination",
      driveKm:        Number(finalDriveKm.toFixed(2)),
      driveEnergyKwh: Number(finalDriveEnergy.toFixed(2)),
      rechargedKwh:   0,
    });

    const totalDriveEnergy    = segments.reduce((a, s) => a + s.driveEnergyKwh, 0);
    const totalRechargedEnergy = segments.reduce((a, s) => a + s.rechargedKwh, 0);
    const finalSoCPct          = effectiveBc > 0
      ? Number(((currentEnergy / effectiveBc) * 100).toFixed(1))
      : 0;

    return res.status(200).json({
      totals: {
        totalDriveEnergyKwh:    Number(totalDriveEnergy.toFixed(2)),
        totalRechargedEnergyKwh: Number(totalRechargedEnergy.toFixed(2)),
        effectiveBatteryKwh:    Number(effectiveBc.toFixed(2)),
        finalSoCPct,
      },
      segments,
    });
  } catch (error) {
    console.error("Energy per segment error:", error);
    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to compute energy per segment",
    });
  }
};