import React, { useCallback, useEffect, useRef, useState } from "react";
import MapComponent from "../components/MapComponent.jsx";
import SocCurve from "../components/SocCurve.jsx";
import { Zap, MapPin, Navigation, BatteryCharging, Gauge, Shield, Battery } from "lucide-react";

const LandingPage = () => {
  const [form, setForm] = useState({
    start: "",
    destination: "",
    battery: 75,
    efficiency: 4.5,
    usable: 90,
    reserve: 15,
    charge: 95,
  });

  const [showMap, setShowMap] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [loading, setLoading] = useState(false);       // ✅ kept once (removed duplicate)
  const [tripData, setTripData] = useState(null);      // ✅ added missing state
  const [socCurve, setSocCurve] = useState([]);        // ✅ added missing state
  const [socReady, setSocReady] = useState(false);
  const [error, setError] = useState(null);

  const hasSpokenRef = useRef(false);
  const hasPlannedRef = useRef(false);
  const distanceRef = useRef(0);
  const routePolylineRef = useRef(null);
  const durationRef = useRef(0);
  const formRef = useRef(form);
  const tripSessionRef = useRef(0);
  const resultsRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── "Calculate Route" button ──
  const handleSubmit = () => {
    setShowMap(true);
    setLoading(true);
    hasSpokenRef.current = false;
    hasPlannedRef.current = false;
    distanceRef.current = 0;
    routePolylineRef.current = null;
    tripSessionRef.current += 1;
    setTripData(null);
    setSocCurve([]);
    setDistance(0);
    setRoutePolyline(null);
  };

  const handleRouteReady = ({ distance, duration, polyline }) => {
    console.log("handleRouteReady fired", { distance, polylineLength: polyline?.length });
    distanceRef.current = distance;
    durationRef.current = duration;
    routePolylineRef.current = polyline;
    setDistance(distance);
    setDuration(duration);
    setRoutePolyline(polyline);
  };

  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!distance || !routePolyline) return;
    console.log("useEffect triggered", { distance, polylineLength: routePolyline?.length });
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { planTrip(); }, 500);
  }, [distance, routePolyline, form]);

  // ── Speech feedback ──
  useEffect(() => {
    if (loading && !hasSpokenRef.current) {
      speak("Planning your EV journey");
      hasSpokenRef.current = true;
    }
    if (!loading && tripData) {
      speak("Your trip has been planned successfully");
      hasSpokenRef.current = false;
    }
  }, [loading, tripData]);

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
            currentCharge:    Number(form.charge),
          }),
        });
        const data = await res.json();
        setSocCurve(data.socCurve || []);
        setTimeout(() => setSocReady(true), 100);
      } catch (err) {
        console.error("SoC curve fetch failed", err);
      }
    };
    fetchSocCurve();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripData]);

  useEffect(() => {
    if (tripData) {
      const t = setTimeout(() => setShowScrollHint(true), 700);
      return () => clearTimeout(t);
    } else {
      setShowScrollHint(false);
    }
  }, [tripData]);

  useEffect(() => { formRef.current = form; }, [form]);

  const planTrip = async () => {
    const session = tripSessionRef.current;
    const f = formRef.current;
    const dist = distanceRef.current;
    const poly = routePolylineRef.current;
    const dur = durationRef.current;
    if (!dist || !poly || poly.length < 2) { setLoading(false); return; }

    try {
      const response = await fetch("http://localhost:4500/api/ev/plan-trip", {
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
        }),
      });
      if (session !== tripSessionRef.current) return;
      const data = await response.json();
      setTripData(data);
    } catch (error) {
      console.error("Trip planning failed", error);
    } finally {
      if (session === tripSessionRef.current) setLoading(false);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1; utterance.pitch = 1; utterance.volume = 1;
    speechSynthesis.speak(utterance);
  };

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setShowScrollHint(false);
  };

  const statFields = [
    { label: "Battery",    name: "battery",    icon: Battery,         hint: "kWh" },
    { label: "Efficiency", name: "efficiency", icon: Gauge,            hint: "km/kWh" },
    { label: "Usable",     name: "usable",     icon: BatteryCharging, hint: "%" },
    { label: "Reserve",    name: "reserve",    icon: Shield,           hint: "%" },
    { label: "Charge",     name: "charge",     icon: Zap,              hint: "%" },
  ];

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: "#050810", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .syne { font-family: 'Plus Jakarta Sans', sans-serif; }

        .grad-text {
          background: linear-gradient(135deg, #38bdf8 0%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .grad-border-wrap {
          background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);
          padding: 1px; border-radius: 22px;
        }
        .vp-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
          background-size: 72px 72px;
        }
        .vp-input, .vp-stat-input {
          width: 100%; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08); color: #f1f5f9;
          font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9rem;
          outline: none; box-sizing: border-box;
          transition: border-color .3s, background .3s;
        }
        .vp-input { padding: 13px 14px 13px 44px; border-radius: 12px; }
        .vp-stat-input { padding: 10px 13px; border-radius: 10px; }
        .vp-input::placeholder, .vp-stat-input::placeholder { color: #475569; }
        .vp-input:focus { border-color: rgba(56,189,248,.45); background: rgba(56,189,248,.06); }
        .vp-stat-input:focus { border-color: rgba(52,211,153,.4); background: rgba(52,211,153,.04); }

        .calc-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #34d399 100%);
          background-size: 200% auto;
          box-shadow: 0 0 40px rgba(6,182,212,.3);
          transition: background-position .4s ease, transform .2s ease, box-shadow .3s ease;
          border: none; cursor: pointer; color: #fff;
        }
        .calc-btn:hover {
          background-position: right center;
          transform: translateY(-2px);
          box-shadow: 0 0 60px rgba(6,182,212,.45);
        }
        .glass {
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.08);
          backdrop-filter: blur(20px); border-radius: 22px;
        }
        .vp-spinner {
          width: 60px; height: 60px; border-radius: 50%;
          border: 3px solid rgba(255,255,255,.06);
          border-top-color: #38bdf8; border-right-color: #34d399;
          animation: vp-spin .85s linear infinite;
        }
        @keyframes vp-spin { to { transform: rotate(360deg); } }
        @keyframes vp-bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(8px)} }

        .trip-cell {
          background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07);
          border-radius: 14px; padding: 16px;
          transition: transform .25s, background .25s;
        }
        .trip-cell:hover { transform: translateY(-3px); background: rgba(255,255,255,.07); }

        .stop-outer {
          border-radius: 18px; padding: 1px;
          background: linear-gradient(135deg, #3b82f655, #8b5cf655, #ec489955);
          transition: transform .3s;
        }
        .stop-outer:hover { transform: translateY(-5px); }
        .stop-inner {
          background: #0a0d1a; border-radius: 17px; padding: 22px;
          height: 100%; box-sizing: border-box;
          display: flex; flex-direction: column; justify-content: space-between;
        }
        .sec-divider {
          width: 40px; height: 2px; border-radius: 99px; margin: 14px auto 0;
          background: linear-gradient(90deg,#38bdf8,transparent);
        }
      `}</style>

      {/* ══════════════════════════════
          PLANNER SECTION
      ══════════════════════════════ */}
      <section id="planner" className="relative flex flex-col md:flex-row items-start justify-center gap-8 px-8 py-24 overflow-hidden" style={{ minHeight: "100vh" }}>
        <div className="vp-grid" />
        <div className="absolute pointer-events-none" style={{ width: 600, height: 600, top: "30%", right: "-10%", background: "radial-gradient(ellipse, rgba(139,92,246,.07) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(60px)" }} />

        {/* LEFT — route form */}
        <div className="relative z-10 w-full max-w-md flex-shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-0.5 rounded-full" style={{ background: "#38bdf8" }} />
            <span className="syne text-xs font-bold uppercase tracking-widest" style={{ color: "#38bdf8" }}>Trip Planner</span>
          </div>
          <h2 className="syne font-extrabold mb-8" style={{ fontSize: "clamp(2rem, 3vw, 2.6rem)", letterSpacing: "-0.025em", lineHeight: 1.08 }}>
            Plan Smart<br /><span className="grad-text">EV Journeys</span>
          </h2>

          <div className="glass p-7">
            <div className="relative mb-3">
              <MapPin size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#38bdf8", opacity: .8 }} />
              <input name="start" placeholder="Start Location" value={form.start} onChange={handleChange} className="vp-input" />
            </div>
            <div className="relative mb-5">
              <Navigation size={15} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#34d399", opacity: .8 }} />
              <input name="destination" placeholder="Destination" value={form.destination} onChange={handleChange} className="vp-input" />
            </div>
            <button onClick={handleSubmit} className="calc-btn w-full py-4 rounded-xl syne font-bold flex items-center justify-center gap-2" style={{ fontSize: "0.95rem", letterSpacing: "0.03em" }}>
              <Zap size={18} /> Calculate Route
            </button>
          </div>
        </div>
        <div className="flex justify-center mb-5">
          <span
            className="syne text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full"
            style={{
              color: "#38bdf8",
              border: "1px solid rgba(56,189,248,.35)",
              background: "rgba(56,189,248,.08)",
            }}
          >
          </span>
        </div>

        {/* RIGHT — vehicle stats */}
        <div className="relative z-10 w-full max-w-md flex-shrink-0">
          <div className="glass p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(52,211,153,.3), rgba(6,182,212,.15))" }}>
                <BatteryCharging size={17} color="#34d399" />
              </div>
              <span className="syne font-bold" style={{ color: "#f1f5f9", letterSpacing: "-0.01em" }}>Vehicle Stats</span>
            </div>
            <div className="space-y-4">
              {statFields.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="syne text-xs font-bold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#64748b" }}>
                      <item.icon size={11} color="#64748b" />{item.label}
                    </label>
                    <span className="syne text-xs" style={{ color: "#334155" }}>{item.hint}</span>
                  </div>
                  <input name={item.name} value={form[item.name]} onChange={handleChange} className="vp-stat-input" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ LOADING ══════════ */}
      {loading && (
        <div className="fixed inset-0 flex flex-col items-center justify-center z-50" style={{ background: "rgba(5,8,16,.93)", backdropFilter: "blur(16px)" }}>
          <div className="vp-spinner mb-6" />
          <h2 className="syne font-bold text-xl" style={{ color: "#f1f5f9", letterSpacing: "-0.02em" }}>Planning your EV journey...</h2>
          <p className="text-sm mt-2" style={{ color: "#475569" }}>Finding routes, stations & optimizing battery 🔋</p>
        </div>
      )}

      {/* ══════════ MAP ══════════ */}
      {showMap && (
        <div className="px-8 pb-8">
          <MapComponent start={form.start} destination={form.destination} onRouteReady={handleRouteReady} tripData={tripData} form={form} />
        </div>
      )}

      {/* ══════════ ROUTE INFO ══════════ */}
      {distance > 0 && (
        <div className="px-8 pb-8">
          <div className="flex items-center gap-4 p-5 rounded-2xl max-w-sm" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(56,189,248,.1)" }}>
              <MapPin size={16} color="#38bdf8" />
            </div>
            <div>
              <p className="syne font-bold text-lg" style={{ color: "#f1f5f9", letterSpacing: "-0.02em" }}>{distance.toFixed(2)} km</p>
              <p className="text-xs mt-0.5" style={{ color: "#475569" }}>Total Route Distance</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TRIP ANALYSIS ══════════ */}
      {tripData && (
        <div ref={resultsRef} className="px-8 pb-10 flex justify-center">
          <div className="grad-border-wrap w-full max-w-2xl">
            <div className="rounded-[21px] p-8" style={{ background: "#0a0d1a" }}>
              <p className="syne text-xs font-bold uppercase tracking-widest text-center mb-2" style={{ color: "#38bdf8" }}>Results</p>
              <h3 className="syne font-extrabold text-center mb-7 grad-text" style={{ fontSize: "1.4rem", letterSpacing: "-0.02em" }}>⚡ Trip Analysis</h3>

              {tripData.recommendedStops?.some((s) => s.isSynthetic) && (
                <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: "rgba(234,179,8,.12)", border: "1px solid rgba(234,179,8,.3)", color: "#fde68a" }}>
                  ⚠️ Some stops are <strong>suggested plan-ahead points</strong> — real charging stations may be sparse in this corridor. Check{" "}
                  <a href="https://www.plugshare.com" target="_blank" rel="noreferrer" className="underline">PlugShare</a> for verified chargers.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Energy Required", value: `⚡ ${tripData.totalEnergyRequired} kWh` },
                  { label: "Charging Stops",  value: `🔌 ${tripData.totalStops}` },
                  { label: "Charging Time",   value: `⏱️ ${tripData.totalChargingTimeHours} hrs` },
                  { label: "Safe Range",      value: `📏 ${tripData.safeRange} km` },
                  { label: "Final Battery",   value: `🔋 ${tripData.finalSoC}%` },
                  { label: "Estimated Cost",  value: `💰 ₹${tripData.totalCost}`, green: true },
                ].map((s) => (
                  <div key={s.label} className="trip-cell">
                    <p className="syne text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#475569" }}>{s.label}</p>
                    <p className="syne font-bold text-lg" style={{ color: s.green ? "#34d399" : "#e2e8f0", letterSpacing: "-0.01em" }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ CHARGING STOPS ══════════ */}
      {tripData?.recommendedStops?.length > 0 && (
        <div className="px-8 pb-16">
          <div className="text-center mb-10">
            <p className="syne text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#38bdf8" }}>Route Stops</p>
            <h3 className="syne font-extrabold" style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", letterSpacing: "-0.025em", color: "#f1f5f9" }}>
              ⚡ Charging Stops Along Your Journey
            </h3>
            <div className="sec-divider" />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {tripData.recommendedStops.map((stop, index) => (   // ✅ fixed: removed stray `;` after closing `)`
              <div key={index} className="stop-outer">
                <div className="stop-inner">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="syne text-xs font-bold uppercase tracking-widest" style={{ color: "#475569" }}>
                        Stop #{String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="syne text-xs font-bold px-3 py-1 rounded-full"
                        style={stop.isSynthetic
                          ? { background: "rgba(234,179,8,.15)", border: "1px solid rgba(234,179,8,.3)", color: "#fde68a" }
                          : { background: "rgba(56,189,248,.1)", border: "1px solid rgba(56,189,248,.2)", color: "#38bdf8" }}
                      >
                        {stop.isSynthetic ? "⚠️ Plan Ahead" : "⚡ Charging Point"}
                      </span>
                    </div>

                    <h4 className="syne font-bold mb-2" style={{ fontSize: "1rem", color: "#e2e8f0", letterSpacing: "-0.01em" }}>
                      🔌 {stop.stationName}
                    </h4>
                    <p className="text-sm mb-4" style={{ color: "#475569" }}>📍 {stop.lat?.toFixed(3)}, {stop.lng?.toFixed(3)}</p>

                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs" style={{ color: "#475569" }}>Distance</span>
                      <span className="syne text-sm font-bold" style={{ color: "#94a3b8" }}>🚗 {stop.cumulativeDistance} km</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs" style={{ color: "#475569" }}>Arrival SoC</span>
                      <span className="syne text-sm font-bold" style={{ color: stop.arrivalSoC < 20 ? "#f87171" : "#34d399" }}>
                        🔋 {stop.arrivalSoC}%
                      </span>
                    </div>
                    <div className="w-full rounded-full" style={{ height: 4, background: "rgba(255,255,255,.07)", marginBottom: 8 }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min((stop.cumulativeDistance / (tripData.totalDistance || 1)) * 100, 100)}%`, background: "linear-gradient(90deg, #34d399, #38bdf8)" }} />
                    </div>
                  </div>

                  <div className="flex justify-between items-center" style={{ marginTop: 16 }}>
                    <a
                      href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                      target="_blank" rel="noreferrer"
                      className="syne text-xs font-bold flex items-center gap-1.5"
                      style={{ color: "#38bdf8", textDecoration: "none" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#7dd3fc"}
                      onMouseLeave={e => e.currentTarget.style.color = "#38bdf8"}
                    >
                      <Navigation size={12} /> Navigate
                    </a>
                    <span className="syne text-xs" style={{ color: "#334155" }}>
                      {stop.isSynthetic ? "No real station found" : "Optimized Stop"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════ SOC CURVE ══════════ */}
      {socCurve.length > 0 && (
        <div className="px-8 pb-20">
          <div className="p-7 rounded-2xl" style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", minHeight: 400 }}>
            {socReady ? (
              <SocCurve socCurve={socCurve} reservePercentage={Number(form.reserve)} />
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="syne text-sm" style={{ color: "#475569" }}>Loading chart...</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showScrollHint && (
        <div
          onClick={scrollToResults}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 cursor-pointer"
        >
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-full backdrop-blur-xl border border-white/10"
            style={{
              background: "rgba(10,13,26,.75)",
              boxShadow: "0 10px 40px rgba(6,182,212,.25)",
              animation: "vp-bounce 1.6s infinite",
            }}
          >
            <span className="syne text-sm font-semibold" style={{ color: "#e2e8f0" }}>
              View Trip Analysis
            </span>
            <div
              className="w-7 h-7 flex items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg,#38bdf8,#34d399)" }}
            >
              ↓
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;