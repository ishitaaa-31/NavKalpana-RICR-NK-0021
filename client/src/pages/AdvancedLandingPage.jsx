import React, { useEffect, useMemo, useRef, useState } from "react";
import MapComponent from "../components/MapComponent.jsx";
import BarGraph from "../components/BarGraph.jsx";
import SocCurve from "../components/SocCurve.jsx";
import EnergyPieChart from "../components/EnergyPieChart.jsx";

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* ── tiny reusable primitives ── */
const Label = ({ children }) => (
  <p className="text-xs font-semibold tracking-widest text-cyan-400 uppercase mb-1">
    {children}
  </p>
);

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-white/8 bg-[#0f1117] p-6 ${className}`}>
    {children}
  </div>
);

/* ── slider with cyan fill ── */
const Slider = ({ min, max, step = 1, value, onChange }) => (
  <input
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={onChange}
    className="w-full h-1 rounded-full appearance-none cursor-pointer mt-2"
    style={{
      background: `linear-gradient(to right, #22d3ee ${((value - min) / (max - min)) * 100}%, #1f2937 ${((value - min) / (max - min)) * 100}%)`,
    }}
  />
);

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
  const [error, setError] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState("Starting...");
  const [cacheWarming, setCacheWarming] = useState(false);

  const tripSessionRef = useRef(0);
  const distanceRef = useRef(0);
  const durationRef = useRef(0);
  const routePolylineRef = useRef(null);
  const formRef = useRef(form);
  const simRef = useRef(sim);
  const timeoutRef = useRef(null);
  const loadingMsgTimers = useRef([]);

  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { simRef.current = sim; }, [sim]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const setSimKey = (k, v) => setSim((p) => ({ ...p, [k]: v }));

  const trafficLabel = useMemo(() => {
    const x = clamp(sim.trafficLevel, 0, 1);
    if (x < 0.34) return "Free-flow";
    if (x < 0.67) return "Medium";
    return "Heavy";
  }, [sim.trafficLevel]);

  const handleSubmit = () => {
    tripSessionRef.current += 1;
    setTripData(null);
    setSocCurve([]);
    setSocReady(false);
    setError(null);
    setLoading(true);
    setShowMap(true);

    if (distanceRef.current && routePolylineRef.current?.length >= 2) {
      advancedPlanTrip();
    } else {
      setDistance(0);
      setDuration(0);
      setRoutePolyline(null);
      distanceRef.current = 0;
      durationRef.current = 0;
      routePolylineRef.current = null;
    }
  };

  const handleRouteReady = ({ distance, duration, polyline }) => {
    distanceRef.current = distance;
    durationRef.current = duration;
    routePolylineRef.current = polyline;
    setDistance(distance);
    setDuration(duration);
    setRoutePolyline(polyline);
    prewarmCache(polyline, distance, duration);
  };

  const prewarmCache = async (polyline, dist, dur) => {
    if (!polyline || polyline.length < 2 || !dist) return;
    const f = formRef.current;
    setCacheWarming(true);
    try {
      await fetch("http://localhost:4500/api/ev/advanced/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLocation: f.start, destination: f.destination,
          distance: dist, duration: dur, routePolyline: polyline,
          batteryCapacity: Number(f.battery), efficiency: Number(f.efficiency),
          usablePercentage: Number(f.usable), reservePercentage: Number(f.reserve),
          currentCharge: Number(f.charge), electricityRate: 8,
          advancedSim: {
            temperatureC: 28, windType: "none", hvacOn: false,
            trafficLevel: 0.4, soh: 95, fastChargeUsage: 0.3,
            weatherSensitivity: 0.5, trafficSensitivity: 0.5,
          },
        }),
      });
      console.log("✅ Cache pre-warmed!");
    } catch (e) {
      console.log("Cache pre-warm failed silently:", e.message);
    } finally {
      setCacheWarming(false);
    }
  };

  useEffect(() => {
    if (!distance || !routePolyline || !showMap) return;
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { advancedPlanTrip(); }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distance, routePolyline]);

  const advancedPlanTrip = async () => {
    const session = tripSessionRef.current;
    const f = formRef.current;
    const s = simRef.current;
    const dist = distanceRef.current;
    const dur = durationRef.current;
    const poly = routePolylineRef.current;

    if (!dist || !poly || poly.length < 2) { setLoading(false); return; }

    setLoading(true);
    setError(null);
    loadingMsgTimers.current.forEach(clearTimeout);
    loadingMsgTimers.current = [];

    setLoadingMsg("Fetching your route data...");
    loadingMsgTimers.current.push(setTimeout(() => setLoadingMsg("Searching for charging stations along route..."), 3000));
    loadingMsgTimers.current.push(setTimeout(() => setLoadingMsg("Finding best stops to minimise detours..."), 8000));
    loadingMsgTimers.current.push(setTimeout(() => setLoadingMsg("Almost there, calculating energy & cost..."), 15000));
    loadingMsgTimers.current.push(setTimeout(() => setLoadingMsg("Taking a bit longer than usual — still working! ☕"), 22000));

    try {
      const response = await fetch("http://localhost:4500/api/ev/advanced/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLocation: f.start, destination: f.destination,
          distance: dist, duration: dur, routePolyline: poly,
          batteryCapacity: Number(f.battery), efficiency: Number(f.efficiency),
          usablePercentage: Number(f.usable), reservePercentage: Number(f.reserve),
          currentCharge: Number(f.charge), electricityRate: 8,
          advancedSim: {
            temperatureC: Number(s.temperatureC), windType: s.windType,
            hvacOn: Boolean(s.hvacOn), trafficLevel: Number(s.trafficLevel),
            soh: Number(s.soh), fastChargeUsage: Number(s.fastChargeUsage),
            weatherSensitivity: Number(s.weatherSensitivity),
            trafficSensitivity: Number(s.trafficSensitivity),
          },
        }),
      });

      if (session !== tripSessionRef.current) return;
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Server error ${response.status}`);
      }
      const data = await response.json();
      if (session !== tripSessionRef.current) return;
      setTripData(data);
      setSocCurve([]);
      setSocReady(false);
    } catch (err) {
      if (session !== tripSessionRef.current) return;
      console.error("Advanced trip planning failed", err);
      setError(err.message || "Trip planning failed. Please try again.");
    } finally {
      if (session === tripSessionRef.current) {
        setLoading(false);
        loadingMsgTimers.current.forEach(clearTimeout);
        loadingMsgTimers.current = [];
      }
    }
  };

  const analyticsPayload = useMemo(() => {
    if (!routePolyline || routePolyline.length < 2 || !distance || !duration || !tripData) return null;
    const adjustedEff = Number(tripData?.advanced?.adjustedInputs?.adjustedEfficiency) || Number(form.efficiency);
    const adjustedBattery = Number(tripData?.advanced?.adjustedInputs?.adjustedBatteryCapacity) || Number(form.battery);
    const adjustedUsable = Number(tripData?.advanced?.adjustedInputs?.adjustedUsablePercentage) || Number(form.usable);
    return {
      startLocation: form.start, destination: form.destination,
      distance, duration, routePolyline,
      batteryCapacity: adjustedBattery, efficiency: adjustedEff,
      usablePercentage: adjustedUsable, reservePercentage: Number(form.reserve),
      currentCharge: Number(form.charge), electricityRate: 8,
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
            distance, recommendedStops: tripData.recommendedStops ?? [],
            batteryCapacity: Number(form.battery), efficiency: Number(form.efficiency),
            usablePercentage: Number(form.usable), reservePercentage: Number(form.reserve),
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

  const getStopBadge = (stop) => {
    if (stop.isSynthetic) return { label: "Find Charger", cls: "text-yellow-400 border-yellow-400/40 bg-yellow-400/5" };
    if (stop.chargeToPercent === 100) return { label: "Charge to 100%", cls: "text-purple-400 border-purple-400/40 bg-purple-400/5" };
    return { label: "Real Station", cls: "text-cyan-400 border-cyan-400/40 bg-cyan-400/5" };
  };

  const inputCls = "w-full px-4 py-3 rounded-xl bg-[#0a0c12] border border-white/8 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition text-sm";

  return (
    <div className="min-h-screen text-white" style={{ background: "#06070d" }}>

      {/* ── NAV ── */}
      <nav className="flex justify-between items-center px-10 py-5 border-b border-white/6">
        <div className="flex items-center gap-2">
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none">
            <polygon points="16,2 6,16 13,16 12,26 22,12 15,12" fill="#22d3ee" />
          </svg>
          <span className="text-xl font-bold tracking-tight">VoltPath</span>
        </div>
        <div className="flex items-center gap-4">
          {cacheWarming && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              Pre-loading stations...
            </div>
          )}
          <span className="text-xs tracking-widest text-gray-500 uppercase border border-white/10 px-3 py-1.5 rounded-full">
            Advanced Simulation
          </span>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-black text-sm font-bold px-5 py-2.5 rounded-full transition"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <polygon points="8,1 3,8 6.5,8 6,13 11,6 7.5,6" fill="black" />
            </svg>
            Run Advanced Plan
          </button>
        </div>
      </nav>

      {/* ── ERROR BANNER ── */}
      {error && (
        <div className="mx-10 mt-5 px-5 py-4 rounded-xl border border-red-400/20 bg-red-400/5 text-red-400 flex justify-between items-center text-sm">
          <span>⚠ {error}</span>
          <button onClick={handleSubmit} className="ml-4 px-4 py-1.5 rounded-lg border border-red-400/30 hover:bg-red-400/10 transition text-xs">
            Retry
          </button>
        </div>
      )}

      {/* ── PAGE HEADER ── */}
      <div className="px-10 pt-10 pb-8 border-b border-white/6">
        <span className="text-xs font-semibold tracking-widest text-cyan-400 uppercase border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 rounded-full">
          Advanced Simulation
        </span>
        <h1 className="text-3xl font-bold mt-4">Configure Your Trip Conditions</h1>
        <p className="text-gray-500 text-sm mt-2 max-w-xl">
          Adjust weather, traffic and battery health to get a precise plan for real-world driving conditions.
        </p>
      </div>

      {/* ── MAIN 3-COL GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-10 py-8">

        {/* COL 1 — Route + Vehicle */}
        <div className="space-y-5">
          <Card>
            <Label>Route</Label>
            <h3 className="text-base font-semibold mb-4">Trip Details</h3>
            <div className="space-y-3">
              <input name="start" placeholder="Start location" value={form.start} onChange={handleChange} className={inputCls} />
              <input name="destination" placeholder="Destination" value={form.destination} onChange={handleChange} className={inputCls} />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[#0a0c12] border border-white/8 p-3">
                  <p className="text-xs text-gray-500 mb-1">Distance</p>
                  <p className="text-base font-bold text-cyan-400">{distance ? `${distance.toFixed(1)} km` : "—"}</p>
                </div>
                <div className="rounded-xl bg-[#0a0c12] border border-white/8 p-3">
                  <p className="text-xs text-gray-500 mb-1">Duration</p>
                  <p className="text-base font-bold text-cyan-400">{duration ? `${(duration / 60).toFixed(1)} hrs` : "—"}</p>
                </div>
              </div>
              <button
                onClick={() => setShowMap(true)}
                className="w-full py-3 rounded-xl border border-white/10 hover:border-cyan-400/40 hover:bg-cyan-400/5 text-sm font-semibold text-gray-400 hover:text-cyan-400 transition"
              >
                Show Map
              </button>
            </div>
          </Card>

          <Card>
            <Label>Vehicle</Label>
            <h3 className="text-base font-semibold mb-4">Battery & Efficiency</h3>
            <div className="space-y-3">
              {[
                { label: "Battery Capacity (kWh)", name: "battery" },
                { label: "Efficiency (km/kWh)", name: "efficiency" },
                { label: "Usable Battery %", name: "usable" },
                { label: "Reserve %", name: "reserve" },
                { label: "Current Charge %", name: "charge" },
              ].map((item) => (
                <div key={item.name}>
                  <label className="text-xs text-gray-500 mb-1 block">{item.label}</label>
                  <input name={item.name} value={form[item.name]} onChange={handleChange} className={inputCls} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* COL 2 — Weather + Traffic */}
        <div className="space-y-5">
          <Card>
            <Label>Environment</Label>
            <h3 className="text-base font-semibold mb-5">Weather Conditions</h3>

            <div className="mb-5">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-400">Temperature</span>
                <span className="text-xs font-bold text-cyan-400">{sim.temperatureC}°C</span>
              </div>
              <Slider min={-10} max={45} value={sim.temperatureC} onChange={(e) => setSimKey("temperatureC", Number(e.target.value))} />
              <div className="flex justify-between text-xs text-gray-600 mt-1"><span>-10°C</span><span>45°C</span></div>
            </div>

            <div className="mb-5">
              <label className="text-xs text-gray-400 block mb-2">Wind Condition</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: "none", label: "None" },
                  { val: "headwind", label: "↙ Head" },
                  { val: "tailwind", label: "↗ Tail" },
                ].map((w) => (
                  <button key={w.val} onClick={() => setSimKey("windType", w.val)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      sim.windType === w.val
                        ? "bg-cyan-400/10 border-cyan-400/50 text-cyan-400"
                        : "bg-[#0a0c12] border-white/8 text-gray-500 hover:border-white/20"
                    }`}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between mb-5 py-3 px-4 rounded-xl bg-[#0a0c12] border border-white/8">
              <span className="text-xs text-gray-400">HVAC / Climate Control</span>
              <button
                onClick={() => setSimKey("hvacOn", !sim.hvacOn)}
                className={`relative w-10 h-5 rounded-full transition-colors ${sim.hvacOn ? "bg-cyan-400" : "bg-gray-700"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${sim.hvacOn ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-400">Weather Sensitivity</span>
                <span className="text-xs font-bold text-cyan-400">{Math.round(sim.weatherSensitivity * 100)}%</span>
              </div>
              <Slider min={0} max={1} step={0.01} value={sim.weatherSensitivity} onChange={(e) => setSimKey("weatherSensitivity", Number(e.target.value))} />
            </div>
          </Card>

          <Card>
            <Label>Traffic</Label>
            <h3 className="text-base font-semibold mb-5">Road Conditions</h3>

            <div className="mb-5">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400">Traffic Level</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                  trafficLabel === "Free-flow" ? "text-cyan-400 border-cyan-400/30 bg-cyan-400/5"
                  : trafficLabel === "Medium" ? "text-yellow-400 border-yellow-400/30 bg-yellow-400/5"
                  : "text-red-400 border-red-400/30 bg-red-400/5"
                }`}>{trafficLabel}</span>
              </div>
              <Slider min={0} max={1} step={0.01} value={sim.trafficLevel} onChange={(e) => setSimKey("trafficLevel", Number(e.target.value))} />
              <div className="flex justify-between text-xs text-gray-600 mt-1"><span>Free</span><span>Heavy</span></div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-400">Traffic Sensitivity</span>
                <span className="text-xs font-bold text-cyan-400">{Math.round(sim.trafficSensitivity * 100)}%</span>
              </div>
              <Slider min={0} max={1} step={0.01} value={sim.trafficSensitivity} onChange={(e) => setSimKey("trafficSensitivity", Number(e.target.value))} />
            </div>
          </Card>
        </div>

        {/* COL 3 — Battery Health + Summary */}
        <div className="space-y-5">
          <Card>
            <Label>Battery Health</Label>
            <h3 className="text-base font-semibold mb-5">Degradation Simulation</h3>

            <div className="mb-5">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-400">State of Health (SoH)</span>
                <span className={`text-xs font-bold ${sim.soh >= 90 ? "text-cyan-400" : sim.soh >= 80 ? "text-yellow-400" : "text-red-400"}`}>
                  {sim.soh}%
                </span>
              </div>
              <Slider min={70} max={100} value={sim.soh} onChange={(e) => setSimKey("soh", Number(e.target.value))} />
              <div className="flex justify-between text-xs text-gray-600 mt-1"><span>70% (Degraded)</span><span>100% (New)</span></div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-400">Fast Charging Usage</span>
                <span className="text-xs font-bold text-cyan-400">{Math.round(sim.fastChargeUsage * 100)}%</span>
              </div>
              <Slider min={0} max={1} step={0.01} value={sim.fastChargeUsage} onChange={(e) => setSimKey("fastChargeUsage", Number(e.target.value))} />
            </div>
          </Card>

          {/* SUMMARY */}
          <div className="rounded-2xl p-px" style={{ background: "linear-gradient(135deg, #22d3ee33, #06b6d420, #0ea5e915)" }}>
            <div className="rounded-2xl p-6" style={{ background: "#0d0f18" }}>
              <Label>Results</Label>
              <h3 className="text-base font-semibold mb-4">Trip Summary</h3>

              {!tripData ? (
                <p className="text-gray-600 text-sm leading-relaxed">
                  {loading ? "Calculating your trip..." : "Enter a route and click Run Advanced Plan to see results."}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                      { label: "Energy", value: `${tripData.totalEnergyRequired} kWh` },
                      { label: "Stops", value: `${tripData.totalStops} stops` },
                      { label: "Charging Time", value: `${tripData.totalChargingTimeHours} hrs` },
                      { label: "Est. Cost", value: `₹${tripData.totalCost}`, cyan: true },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-[#0a0c12] border border-white/6 p-3">
                        <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                        <p className={`text-sm font-bold ${item.cyan ? "text-cyan-400" : "text-white"}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl bg-[#0a0c12] border border-white/6 p-3 mb-4">
                    <p className="text-xs text-gray-500 mb-1">Arrival Battery</p>
                    <div className="flex items-end justify-between mb-2">
                      <p className="text-2xl font-bold text-cyan-400">{tripData.finalSoC}%</p>
                      <p className="text-xs text-gray-500 pb-0.5">Safe: {tripData.safeRange} km</p>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min(100, tripData.finalSoC)}%`,
                        background: tripData.finalSoC > 30 ? "#22d3ee" : "#f87171",
                      }} />
                    </div>
                  </div>

                  {tripData.advanced?.multipliers && (
                    <div className="rounded-xl bg-[#0a0c12] border border-white/6 p-3">
                      <p className="text-xs text-gray-500 mb-2">Condition Multipliers</p>
                      <div className="flex gap-2 flex-wrap mb-2">
                        {[
                          { k: "Weather", v: tripData.advanced.multipliers.weatherMultiplier },
                          { k: "Traffic", v: tripData.advanced.multipliers.trafficMultiplier },
                          { k: "SoH", v: tripData.advanced.multipliers.degradationPenalty },
                        ].map((m) => (
                          <span key={m.k} className="text-xs px-2 py-1 rounded-lg border border-white/8 bg-white/3 text-gray-300">
                            {m.k} <span className="text-cyan-400 font-bold">{m.v}×</span>
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500">
                        Total <span className="text-white font-bold">{tripData.advanced.multipliers.totalMultiplier}×</span>
                        {" · "}Eff <span className="text-cyan-400">{tripData.advanced.adjustedInputs?.adjustedEfficiency} km/kWh</span>
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/6">
                <span className="text-xs text-gray-500">Show SoC Curve</span>
                <button
                  onClick={() => setViz((p) => ({ ...p, showSocCurve: !p.showSocCurve }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${viz.showSocCurve ? "bg-cyan-400" : "bg-gray-700"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${viz.showSocCurve ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LOADING OVERLAY ── */}
      {loading && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50" style={{ background: "rgba(6,7,13,0.95)" }}>
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-white/5" />
            <div className="absolute inset-0 rounded-full border-t-2 border-cyan-400 animate-spin" />
            <div className="absolute inset-2 rounded-full border-t-2 border-cyan-400/30 animate-spin" style={{ animationDuration: "1.5s", animationDirection: "reverse" }} />
            <svg className="absolute inset-0 m-auto w-7 h-7" viewBox="0 0 28 28" fill="none">
              <polygon points="16,2 6,16 13,16 12,26 22,12 15,12" fill="#22d3ee" />
            </svg>
          </div>
          <p className="text-xs tracking-widest text-cyan-400 uppercase mb-2">Processing</p>
          <h2 className="text-xl font-bold text-white mb-3">Running Advanced Simulation</h2>
          <p className="text-sm text-gray-400 text-center max-w-xs">{loadingMsg}</p>
          <p className="text-xs text-gray-600 mt-3">Long routes may take 10–30 seconds</p>
        </div>
      )}

      {/* ── MAP ── */}
      {showMap && (
        <div className="px-10 pb-8 border-t border-white/6">
          <div className="pt-8 pb-5 flex justify-between items-center">
            <div>
              <Label>Map</Label>
              <h2 className="text-xl font-bold">Route + Charging Stops</h2>
            </div>
            <button
              onClick={handleSubmit}
              className="border border-white/10 hover:border-cyan-400/40 hover:bg-cyan-400/5 text-sm font-semibold text-gray-400 hover:text-cyan-400 px-4 py-2.5 rounded-xl transition"
            >
              ↺ Replan Trip
            </button>
          </div>
          <div className="rounded-2xl border border-white/8 overflow-hidden">
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
        <div className="px-10 pb-10 border-t border-white/6">
          <div className="pt-8 pb-6">
            <Label>Stops</Label>
            <h2 className="text-xl font-bold">Charging Stops Along Your Journey</h2>
            <div className="flex gap-5 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />Real Station</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />Charge to 100%</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />Find Charger</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tripData.recommendedStops.map((stop, idx) => {
              const badge = getStopBadge(stop);
              return (
                <div key={idx} className="rounded-2xl border border-white/8 bg-[#0f1117] p-5 hover:border-white/15 transition group">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-gray-600">Stop #{idx + 1}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                  </div>

                  <h4 className="text-sm font-bold text-white truncate mb-1">{stop.stationName}</h4>
                  <p className="text-xs text-gray-600 mb-3">{stop.lat?.toFixed(4)}, {stop.lng?.toFixed(4)}</p>

                  {stop.note && (
                    <p className="text-xs px-3 py-2 rounded-lg bg-yellow-400/5 text-yellow-400 border border-yellow-400/15 mb-3 leading-relaxed">
                      {stop.note}
                    </p>
                  )}

                  <div className="space-y-2 text-xs border-t border-white/6 pt-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">At km</span>
                      <span className="text-white font-semibold">{stop.cumulativeDistance} km</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Arrival SoC</span>
                      <span className={`font-bold ${stop.arrivalSoC < 20 ? "text-red-400" : "text-cyan-400"}`}>{stop.arrivalSoC}%</span>
                    </div>
                    {stop.detourKm > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Detour</span>
                        <span className="text-gray-300">+{stop.detourKm} km</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Charge to</span>
                      <span className={`font-bold ${stop.chargeToPercent === 100 ? "text-purple-400" : "text-cyan-400"}`}>
                        {stop.chargeToPercent ?? 80}%
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    {stop.isSynthetic && stop.plugshareUrl ? (
                      <a href={stop.plugshareUrl} target="_blank" rel="noreferrer"
                        className="w-full flex items-center justify-center py-2 rounded-xl border border-yellow-400/25 bg-yellow-400/5 text-yellow-400 text-xs font-semibold hover:bg-yellow-400/10 transition">
                        Find on PlugShare ↗
                      </a>
                    ) : (
                      <a href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`} target="_blank" rel="noreferrer"
                        className="w-full flex items-center justify-center py-2 rounded-xl border border-white/8 text-gray-500 text-xs font-semibold hover:border-cyan-400/30 hover:text-cyan-400 transition">
                        Navigate ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SOC CURVE ── */}
      {viz.showSocCurve && (
        <div className="px-10 pb-8 border-t border-white/6">
          <div className="pt-8 pb-6">
            <Label>Analytics</Label>
            <h2 className="text-xl font-bold">Battery State of Charge</h2>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#0f1117] p-6" style={{ minHeight: 380 }}>
            {socCurve.length > 0 && socReady ? (
              <SocCurve socCurve={socCurve} reservePercentage={Number(form.reserve)} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-600 text-sm">
                {tripData ? "Loading SoC curve..." : "Run advanced plan to view SoC curve"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BAR GRAPH ── */}
      {analyticsPayload && (
        <div className="px-10 pb-8">
          <div className="rounded-2xl border border-white/8 bg-[#0f1117] p-6">
            <BarGraph payload={analyticsPayload} />
          </div>
        </div>
      )}

      {/* ── ENERGY PIE CHART ── */}
      {analyticsPayload && (
        <div className="px-10 pb-16">
          <div className="rounded-2xl border border-white/8 bg-[#0f1117] p-6">
            <EnergyPieChart payload={analyticsPayload} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedLandingPage;