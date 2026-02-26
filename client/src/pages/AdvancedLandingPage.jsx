import React, { useEffect, useMemo, useRef, useState } from "react";
import MapComponent from "../components/MapComponent.jsx";
import BarGraph from "../components/BarGraph.jsx";
import SocCurve from "../components/SocCurve.jsx";
import EnergyPieChart from "../components/EnergyPieChart.jsx";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const AdvancedLandingPage = () => {
  const [form, setForm] = useState({
    start: "",
    destination: "",
    battery: 75,
    efficiency: 4.5,
    usable: 90,
    reserve: 15,
    charge: 95,
  });

  const [sim, setSim] = useState({
    temperatureC: 28,
    windType: "none",
    hvacOn: true,
    trafficLevel: 0.4,
    soh: 95,
    fastChargeUsage: 0.3,
    weatherSensitivity: 0.5,
    trafficSensitivity: 0.5,
  });

  const [viz, setViz] = useState({ showSocCurve: true });
  const [showMap, setShowMap] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [socCurve, setSocCurve] = useState([]);
  const [socReady, setSocReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const tripSessionRef = useRef(0);
  const distanceRef = useRef(0);
  const durationRef = useRef(0);
  const routePolylineRef = useRef(null);
  const formRef = useRef(form);
  const simRef = useRef(sim);
  const timeoutRef = useRef(null);

  useEffect(() => {
    formRef.current = form;
  }, [form]);
  useEffect(() => {
    simRef.current = sim;
  }, [sim]);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });
  const setSimKey = (k, v) => setSim((p) => ({ ...p, [k]: v }));

  const trafficLabel = useMemo(() => {
    const x = clamp(sim.trafficLevel, 0, 1);
    if (x < 0.34) return "Free-flow";
    if (x < 0.67) return "Medium";
    return "Heavy";
  }, [sim.trafficLevel]);

  const handleSubmit = () => {
    setTripData(null);
    setSocCurve([]);
    setSocReady(false);
    setDistance(0);
    setDuration(0);
    setRoutePolyline(null);
    distanceRef.current = 0;
    durationRef.current = 0;
    routePolylineRef.current = null;
    setShowMap(true);
    setLoading(true);
    tripSessionRef.current += 1;
  };

  const handleRouteReady = ({ distance, duration, polyline }) => {
    distanceRef.current = distance;
    durationRef.current = duration;
    routePolylineRef.current = polyline;
    setDistance(distance);
    setDuration(duration);
    setRoutePolyline(polyline);
  };

  useEffect(() => {
    if (!distance || !routePolyline || !showMap) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      advancedPlanTrip();
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distance, routePolyline, sim, form, showMap]);

  const advancedPlanTrip = async () => {
    const session = tripSessionRef.current;
    const f = formRef.current;
    const s = simRef.current;
    const dist = distanceRef.current;
    const dur = durationRef.current;
    const poly = routePolylineRef.current;

    if (!dist || !poly || poly.length < 2) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost:4500/api/ev/advanced/plan-trip",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startLocation: f.start,
            destination: f.destination,
            distance: dist,
            duration: dur,
            routePolyline: poly,
            batteryCapacity: Number(f.battery),
            efficiency: Number(f.efficiency),
            usablePercentage: Number(f.usable),
            reservePercentage: Number(f.reserve),
            currentCharge: Number(f.charge),
            electricityRate: 8,
            advancedSim: {
              temperatureC: Number(s.temperatureC),
              windType: s.windType,
              hvacOn: Boolean(s.hvacOn),
              trafficLevel: Number(s.trafficLevel),
              soh: Number(s.soh),
              fastChargeUsage: Number(s.fastChargeUsage),
              weatherSensitivity: Number(s.weatherSensitivity),
              trafficSensitivity: Number(s.trafficSensitivity),
            },
          }),
        },
      );

      if (session !== tripSessionRef.current) return;
      const data = await response.json();
      setTripData(data);
      console.log("ADVANCED API RESPONSE:", data);
      setSocCurve([]);
      setSocReady(false);
    } catch (err) {
      console.error("Advanced trip planning failed", err);
    } finally {
      if (session === tripSessionRef.current) setLoading(false);
    }
  };

  const analyticsPayload = useMemo(() => {
    if (!routePolyline || routePolyline.length < 2) return null;
    if (!distance || !duration) return null;
    if (!tripData) return null;

    const adjustedEff =
      Number(tripData?.advanced?.adjustedInputs?.adjustedEfficiency) ||
      Number(form.efficiency);
    const adjustedBattery =
      Number(tripData?.advanced?.adjustedInputs?.adjustedBatteryCapacity) ||
      Number(form.battery);
    const adjustedUsable =
      Number(tripData?.advanced?.adjustedInputs?.adjustedUsablePercentage) ||
      Number(form.usable);

    return {
      startLocation: form.start,
      destination: form.destination,
      distance,
      duration,
      routePolyline,
      batteryCapacity: adjustedBattery,
      efficiency: adjustedEff,
      usablePercentage: adjustedUsable,
      reservePercentage: Number(form.reserve),
      currentCharge: Number(form.charge),
      electricityRate: 8,
    };
  }, [tripData, routePolyline, distance, duration, form]);

  useEffect(() => {
    if (!tripData) return;
    const fetchSocCurve = async () => {
      try {
        const res = await fetch("http://localhost:4500/api/ev/soc-curve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            distance,
            recommendedStops: tripData.recommendedStops ?? [],
            batteryCapacity: Number(form.battery),
            efficiency: Number(form.efficiency),
            usablePercentage: Number(form.usable),
            reservePercentage: Number(form.reserve),
            currentCharge: Number(form.charge),
          }),
        });
        const curve = await res.json();
        setSocCurve(curve.socCurve || []);
        setTimeout(() => setSocReady(true), 100);
      } catch (err) {
        console.error("SoC curve fetch failed", err);
      }
    };
    fetchSocCurve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripData]);

  /* ── Badge + card style helpers ── */
  const getStopBadge = (stop) => {
    if (stop.isSynthetic)
      return {
        label: "🔍 Find Charger",
        cls: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
      };
    if (stop.chargeToPercent === 100)
      return {
        label: "⚡ Charge to 100%",
        cls: "bg-purple-500/20 text-purple-300 border-purple-400/30",
      };
    return {
      label: "Real Station",
      cls: "bg-green-500/20 text-green-300 border-green-400/30",
    };
  };

  const getCardBorder = (stop) => {
    if (stop.isSynthetic) return "border-yellow-400/30";
    if (stop.chargeToPercent === 100) return "border-purple-400/40";
    return "border-white/10";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      {/* ── NAV ── */}
      <div className="flex justify-between items-center px-10 py-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-wide">⚡ VoltPath</h1>
          <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
            Part 2 • Advanced Simulation
          </span>
        </div>
        <button
          onClick={handleSubmit}
          className="bg-white text-black px-4 py-2 rounded-full font-semibold hover:bg-gray-200 transition"
        >
          Run Advanced Plan
        </button>
      </div>

      {/* ── TOP GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-10 pb-10">
        {/* LEFT — Route + Vehicle */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
            <h2 className="text-xl font-bold mb-3">🚗 Route Inputs</h2>
            <div className="space-y-3">
              <input
                name="start"
                placeholder="📍 Start Location"
                value={form.start}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-black/30 border border-white/10 focus:outline-none focus:border-blue-400/50"
              />
              <input
                name="destination"
                placeholder="🏁 Destination"
                value={form.destination}
                onChange={handleChange}
                className="w-full p-3 rounded-lg bg-black/30 border border-white/10 focus:outline-none focus:border-blue-400/50"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-xs text-gray-400">Distance</p>
                  <p className="text-lg font-semibold">
                    {distance ? `${distance.toFixed(1)} km` : "—"}
                  </p>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                  <p className="text-xs text-gray-400">Duration</p>
                  <p className="text-lg font-semibold">
                    {duration ? `${(duration / 60).toFixed(1)} hrs` : "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMap(true)}
                className="w-full bg-blue-500/90 hover:bg-blue-500 py-3 rounded-lg font-semibold transition"
              >
                🗺️ Show Map
              </button>
            </div>
          </div>

          <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
            <h3 className="text-lg font-semibold mb-4">🔋 Vehicle Stats</h3>
            <div className="space-y-3">
              {[
                { label: "Battery (kWh)", name: "battery" },
                { label: "Efficiency (km/kWh)", name: "efficiency" },
                { label: "Usable %", name: "usable" },
                { label: "Reserve %", name: "reserve" },
                { label: "Charge %", name: "charge" },
              ].map((item) => (
                <div key={item.name}>
                  <label className="text-sm text-gray-300">{item.label}</label>
                  <input
                    name={item.name}
                    value={form[item.name]}
                    onChange={handleChange}
                    className="w-full p-2 mt-1 rounded bg-black/30 border border-white/10 focus:outline-none focus:border-blue-400/50"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE — Weather + Traffic */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
            <h2 className="text-xl font-bold mb-4">🌦️ Weather Simulation</h2>
            <label className="text-sm text-gray-300">
              Temperature (°C): {sim.temperatureC}
            </label>
            <input
              type="range"
              min={-10}
              max={45}
              value={sim.temperatureC}
              onChange={(e) =>
                setSimKey("temperatureC", Number(e.target.value))
              }
              className="w-full mt-2"
            />
            <div className="mt-4">
              <label className="text-sm text-gray-300">Wind</label>
              <select
                value={sim.windType}
                onChange={(e) => setSimKey("windType", e.target.value)}
                className="w-full p-2 rounded bg-black/30 border border-white/10 mt-1"
              >
                <option value="none">None</option>
                <option value="headwind">Headwind</option>
                <option value="tailwind">Tailwind</option>
              </select>
            </div>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-300">HVAC</span>
              <button
                onClick={() => setSimKey("hvacOn", !sim.hvacOn)}
                className={`px-3 py-1 rounded-full text-sm border transition ${
                  sim.hvacOn
                    ? "bg-blue-500/20 border-blue-400/40"
                    : "bg-white/5 border-white/10"
                }`}
              >
                {sim.hvacOn ? "ON" : "OFF"}
              </button>
            </div>
            <div className="mt-4">
              <label className="text-sm text-gray-300">
                Weather Sensitivity: {Math.round(sim.weatherSensitivity * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={sim.weatherSensitivity}
                onChange={(e) =>
                  setSimKey("weatherSensitivity", Number(e.target.value))
                }
                className="w-full mt-2"
              />
            </div>
          </div>

          <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
            <h2 className="text-xl font-bold mb-4">🚦 Traffic Simulation</h2>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">
                Traffic: {trafficLabel}
              </label>
              <span className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10">
                {Math.round(sim.trafficLevel * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sim.trafficLevel}
              onChange={(e) =>
                setSimKey("trafficLevel", Number(e.target.value))
              }
              className="w-full mt-2"
            />
            <div className="mt-4">
              <label className="text-sm text-gray-300">
                Traffic Sensitivity: {Math.round(sim.trafficSensitivity * 100)}%
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={sim.trafficSensitivity}
                onChange={(e) =>
                  setSimKey("trafficSensitivity", Number(e.target.value))
                }
                className="w-full mt-2"
              />
            </div>
          </div>
        </div>

        {/* RIGHT — Battery Degradation + Summary */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/10 p-6 rounded-2xl border border-white/10">
            <h2 className="text-xl font-bold mb-4">🧪 Battery Degradation</h2>
            <label className="text-sm text-gray-300">
              State of Health (SoH): {sim.soh}%
            </label>
            <input
              type="range"
              min={70}
              max={100}
              value={sim.soh}
              onChange={(e) => setSimKey("soh", Number(e.target.value))}
              className="w-full mt-2"
            />
            <label className="text-sm text-gray-300 mt-4 block">
              Fast Charging Usage: {Math.round(sim.fastChargeUsage * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={sim.fastChargeUsage}
              onChange={(e) =>
                setSimKey("fastChargeUsage", Number(e.target.value))
              }
              className="w-full mt-2"
            />
          </div>

          {/* Summary card */}
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-[1px] rounded-2xl">
            <div className="bg-gray-900 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-4 text-center">
                ⚡ Advanced Summary
              </h3>

              {!tripData ? (
                <p className="text-gray-400 text-sm">
                  Run planning after route is ready. Map → route → advanced
                  plan.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/10 p-4 rounded-xl">
                      <p className="text-xs text-gray-400">Energy Required</p>
                      <p className="text-lg font-semibold">
                        {tripData.totalEnergyRequired} kWh
                      </p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl">
                      <p className="text-xs text-gray-400">Stops</p>
                      <p className="text-lg font-semibold">
                        🔌 {tripData.totalStops}
                      </p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl">
                      <p className="text-xs text-gray-400">Charging Time</p>
                      <p className="text-lg font-semibold">
                        ⏱️ {tripData.totalChargingTimeHours} hrs
                      </p>
                    </div>
                    <div className="bg-white/10 p-4 rounded-xl">
                      <p className="text-xs text-gray-400">Estimated Cost</p>
                      <p className="text-lg font-semibold text-green-400">
                        ₹{tripData.totalCost}
                      </p>
                    </div>
                    <div className="col-span-2 bg-white/10 p-4 rounded-xl">
                      <p className="text-xs text-gray-400">Final SoC</p>
                      <p className="text-xl font-bold">
                        🔋 {tripData.finalSoC}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Safe Range: {tripData.safeRange} km
                      </p>
                    </div>
                  </div>

                  {tripData.advanced?.multipliers && (
                    <div className="mt-4 bg-white/5 border border-white/10 p-4 rounded-xl">
                      <p className="text-sm font-semibold mb-2">
                        Backend Multipliers
                      </p>
                      <p className="text-xs text-gray-400">
                        Weather{" "}
                        {tripData.advanced.multipliers.weatherMultiplier}× •
                        Traffic{" "}
                        {tripData.advanced.multipliers.trafficMultiplier}× • SoH{" "}
                        {tripData.advanced.multipliers.degradationPenalty}×
                      </p>
                      <p className="text-lg font-bold mt-1">
                        Total {tripData.advanced.multipliers.totalMultiplier}×
                      </p>
                      {tripData.advanced.adjustedInputs && (
                        <p className="text-xs text-gray-500 mt-2">
                          Adjusted efficiency:{" "}
                          {tripData.advanced.adjustedInputs.adjustedEfficiency}{" "}
                          km/kWh • Adjusted battery:{" "}
                          {
                            tripData.advanced.adjustedInputs
                              .adjustedBatteryCapacity
                          }{" "}
                          kWh
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="mt-5 flex items-center justify-between">
                <span className="text-sm text-gray-300">Show SoC Curve</span>
                <button
                  onClick={() =>
                    setViz((p) => ({ ...p, showSocCurve: !p.showSocCurve }))
                  }
                  className={`px-3 py-1 rounded-full text-sm border transition ${
                    viz.showSocCurve
                      ? "bg-blue-500/20 border-blue-400/40"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  {viz.showSocCurve ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4" />
          <h2 className="text-xl font-semibold">
            ⚡ Running advanced simulation...
          </h2>
          <p className="text-gray-400 mt-2">
            Recalculating stops, energy & SoC curve 🔋
          </p>
        </div>
      )}

      {/* ── MAP ── */}
      {showMap && (
        <div className="px-10 pb-10">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">🗺️ Route + Charging Stops</h3>
              <button
                onClick={() => setShowMap(false)}
                className="text-sm px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 transition"
              >
                Close
              </button>
            </div>
            <MapComponent
              start={form.start}
              destination={form.destination}
              onRouteReady={handleRouteReady}
              tripData={tripData}
              form={form}
            />
          </div>
        </div>
      )}

      {/* ── CHARGING STOPS ── */}
      {tripData?.recommendedStops?.length > 0 && (
        <div className="px-10 pb-16">
          <h3 className="text-2xl font-bold text-center mb-2 tracking-wide">
            ⚡ Charging Stops Along Your Journey
          </h3>

          {/* Legend */}
          <div className="flex justify-center gap-4 mb-8 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />{" "}
              Real Station
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />{" "}
              Charge to 100%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{" "}
              Find Charger (PlugShare)
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tripData.recommendedStops.map((stop, idx) => {
              const badge = getStopBadge(stop);
              return (
                <div
                  key={idx}
                  className={`bg-white/10 p-5 rounded-2xl border transition hover:scale-[1.02] ${getCardBorder(stop)}`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">
                      Stop #{idx + 1}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  {/* Name */}
                  <h4 className="text-lg font-semibold mt-2 truncate">
                    🔌 {stop.stationName}
                  </h4>
                  <p className="text-sm text-gray-400 mt-1">
                    📍 {stop.lat?.toFixed(3)}, {stop.lng?.toFixed(3)}
                  </p>

                  {/* Warning note for boosted / synthetic stops */}
                  {stop.note && (
                    <p className="text-xs mt-3 px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-300 border border-yellow-400/20 leading-relaxed">
                      ⚠️ {stop.note}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Distance</span>
                      <span className="font-medium">
                        {stop.cumulativeDistance} km
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Arrival SoC</span>
                      <span
                        className={`font-medium ${stop.arrivalSoC < 20 ? "text-red-400" : "text-green-400"}`}
                      >
                        🔋 {stop.arrivalSoC}%
                      </span>
                    </div>
                    {stop.detourKm > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Detour</span>
                        <span className="font-medium text-gray-300">
                          +{stop.detourKm} km
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-400">Charge to</span>
                      <span
                        className={`font-medium ${
                          stop.chargeToPercent === 100
                            ? "text-purple-400"
                            : "text-blue-400"
                        }`}
                      >
                        {stop.chargeToPercent ?? 80}%
                      </span>
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-4 flex justify-between items-center">
                    {stop.isSynthetic && stop.plugshareUrl ? (
                      <a
                        href={stop.plugshareUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 border border-yellow-400/30 hover:bg-yellow-500/30 transition"
                      >
                        🔍 Find on PlugShare
                      </a>
                    ) : (
                      <a
                        href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-400 hover:underline"
                      >
                        🧭 Navigate
                      </a>
                    )}

                    <span className="text-xs text-gray-500">
                      {stop.isSynthetic
                        ? "Check PlugShare"
                        : stop.chargeToPercent === 100
                          ? "Full charge needed"
                          : "Optimized"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SoC CURVE ── */}
      {viz.showSocCurve && (
        <div className="px-10 pb-20">
          <div
            className="bg-white/5 p-6 rounded-2xl border border-white/10"
            style={{ minHeight: "380px" }}
          >
            {socCurve.length > 0 && socReady ? (
              <SocCurve
                socCurve={socCurve}
                reservePercentage={Number(form.reserve)}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                {tripData
                  ? "Loading SoC curve..."
                  : "Run advanced plan to view SoC curve"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BAR GRAPH ── */}
      {analyticsPayload && (
        <div className="px-10 pb-20">
          <BarGraph payload={analyticsPayload} />
        </div>
      )}
      {/* ── BAR GRAPH ── */}
      {analyticsPayload && (
        <div className="px-10 pb-20">
          <BarGraph payload={analyticsPayload} />
        </div>
      )}

      {/* ── ENERGY PIE CHART ── */}
      {analyticsPayload && (
        <div className="px-10 pb-20">
          <EnergyPieChart payload={analyticsPayload} />
        </div>
      )}
    </div>
  );
};

export default AdvancedLandingPage;
