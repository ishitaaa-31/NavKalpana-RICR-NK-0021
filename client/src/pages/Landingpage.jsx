import React, { useCallback, useEffect, useRef, useState } from "react";
import MapComponent from "../components/MapComponent.jsx";
import SocCurve from "../components/SocCurve.jsx";

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
  const [tripData, setTripData] = useState(null);
  const [socCurve, setSocCurve] = useState([]);
  const [socReady, setSocReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Refs ──
  const abortRef     = useRef(null);   // AbortController for in-flight fetch
  const timeoutRef   = useRef(null);   // debounce timer
  const routeReadyRef = useRef(false); // true once MapComponent delivers a route
  const hasSpokenRef  = useRef(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── "Calculate Route" button ──
  const handleSubmit = () => {
    if (abortRef.current) abortRef.current.abort();
    clearTimeout(timeoutRef.current);

    setTripData(null);
    setSocCurve([]);
    setSocReady(false);
    setDistance(0);
    setDuration(0);
    setRoutePolyline(null);
    setError(null);
    routeReadyRef.current = false;
    hasSpokenRef.current = false;
    setShowMap(true);
    // loading will be set true once planning actually starts
  };

  // ── Route ready callback from MapComponent ──
  const handleRouteReady = useCallback(({ distance: d, duration: dur, polyline }) => {
    console.log("✅ handleRouteReady fired", { distance: d, polylineLength: polyline?.length });
    setDistance(d);
    setDuration(dur);
    setRoutePolyline(polyline);
    routeReadyRef.current = true;
  }, []);

  // ── Core planner ──
  const planTrip = useCallback(async (dist, dur, poly, currentForm) => {
    if (!dist || !poly || poly.length < 2) return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:4500/api/ev/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          startLocation:    currentForm.start,
          destination:      currentForm.destination,
          distance:         dist,
          duration:         dur,
          routePolyline:    poly,
          batteryCapacity:  Number(currentForm.battery),
          efficiency:       Number(currentForm.efficiency),
          usablePercentage: Number(currentForm.usable),
          reservePercentage: Number(currentForm.reserve),
          currentCharge:    Number(currentForm.charge),
          electricityRate:  8,
        }),
      });

      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(`Server error ${response.status}`);

      const data = await response.json();
      if (controller.signal.aborted) return;

      setTripData(data);
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error("Trip planning failed", err);
      setError("Trip planning failed. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // ── Fire plan when route first arrives ──
  useEffect(() => {
    if (!distance || !routePolyline || !showMap) return;
    if (!routeReadyRef.current) return;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      planTrip(distance, duration, routePolyline, form);
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distance, routePolyline]);

  // ── Re-plan when vehicle form inputs change (while route exists) ──
  useEffect(() => {
    if (!distance || !routePolyline || !showMap) return;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      planTrip(distance, duration, routePolyline, form);
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

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

  // ── Fetch SoC curve after tripData arrives ──
  useEffect(() => {
    if (!tripData || !distance) return;

    const fetchSocCurve = async () => {
      try {
        const res = await fetch("http://localhost:4500/api/ev/soc-curve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            distance,
            recommendedStops: tripData.recommendedStops ?? [],
            batteryCapacity:  Number(form.battery),
            efficiency:       Number(form.efficiency),
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

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  };

  // ── Stop card helpers ──
  const getStopBadge = (stop) => {
    if (stop.isSynthetic)
      return { label: "🔍 Find Charger", cls: "bg-yellow-500/20 text-yellow-300" };
    if (stop.chargeToPercent === 100)
      return { label: "⚡ Charge to 100%", cls: "bg-purple-500/20 text-purple-300" };
    return { label: "⚡ Charging Point", cls: "bg-white/10 text-gray-200" };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">

      {/* ── Navbar ── */}
      <div className="flex justify-between items-center px-10 py-5">
        <h1 className="text-2xl font-bold tracking-wide">⚡ VoltPath</h1>
        <button className="bg-white text-black px-4 py-2 rounded-full">Get Started</button>
      </div>

      {/* ── Main Section ── */}
      <div className="flex flex-col md:flex-row items-center px-10 py-10 gap-72">
        {/* LEFT */}
        <div className="max-w-lg space-y-6 ms-32">
          <h2 className="text-4xl font-bold">Plan Smart EV Journeys 🚗⚡</h2>
          <div className="bg-white/10 p-6 rounded-2xl space-y-4">
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
            <button
              onClick={handleSubmit}
              className="w-full bg-blue-500 hover:bg-blue-400 py-3 rounded-lg font-semibold transition"
            >
              ⚡ Calculate Route
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="w-full max-w-md bg-white/10 p-6 rounded-2xl me-40">
          <h3 className="text-lg font-semibold mb-4">🔋 Vehicle Stats</h3>
          <div className="space-y-4">
            {[
              { label: "Battery (kWh)", name: "battery" },
              { label: "Efficiency (km/kWh)", name: "efficiency" },
              { label: "Usable %", name: "usable" },
              { label: "Reserve %", name: "reserve" },
              { label: "Charge %", name: "charge" },
            ].map((item) => (
              <div key={item.name}>
                <label className="text-sm">{item.label}</label>
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

      {/* ── Loading overlay ── */}
      {loading && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4" />
          <h2 className="text-xl font-semibold">⚡ Planning your EV journey...</h2>
          <p className="text-gray-400 mt-2">Finding routes, stations & optimizing battery 🔋</p>
          <button
            onClick={() => {
              if (abortRef.current) abortRef.current.abort();
              setLoading(false);
            }}
            className="mt-6 text-sm text-gray-500 hover:text-gray-300 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && !loading && (
        <div className="mx-10 mb-6 px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/30 text-red-300 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* ── MAP ── */}
      {showMap && (
        <div className="px-10 pb-10">
          <MapComponent
            start={form.start}
            destination={form.destination}
            onRouteReady={handleRouteReady}
            tripData={tripData}
            form={form}
          />
        </div>
      )}

      {/* ── Route Info ── */}
      {distance > 0 && (
        <div className="px-10 pb-10 flex justify-center">
          <div className="bg-white/10 p-6 rounded-xl max-w-lg">
            <h3 className="text-lg font-semibold mb-2">Route Info</h3>
            <p>📍 Distance: {distance.toFixed(2)} km</p>
          </div>
        </div>
      )}

      {/* ── Trip Analysis ── */}
      {tripData && (
        <div className="px-6 pb-10 flex justify-center">
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-[1px] rounded-2xl shadow-xl max-w-xl w-full">
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
              <h3 className="text-2xl font-bold mb-5 text-center tracking-wide">⚡ Trip Analysis</h3>

              {/* PlugShare warning if any synthetic stops */}
              {tripData.recommendedStops?.some((s) => s.isSynthetic) && (
                <div className="mb-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-3 text-sm text-yellow-300">
                  ⚠️ Some stops are <strong>plan-ahead points</strong> — our database has no charger
                  here. Use the{" "}
                  <a href="https://www.plugshare.com" target="_blank" rel="noreferrer" className="underline">
                    PlugShare
                  </a>{" "}
                  link on those stop cards to find a real charger nearby.
                </div>
              )}

              {/* Charge-to-100% warning */}
              {tripData.recommendedStops?.some((s) => s.chargeToPercent === 100) && (
                <div className="mb-4 bg-purple-500/20 border border-purple-500/50 rounded-xl p-3 text-sm text-purple-300">
                  ⚡ One or more stops are marked <strong>Charge to 100%</strong> — charging
                  infrastructure is sparse ahead and you'll need maximum range.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Energy Required", value: `⚡ ${tripData.totalEnergyRequired} kWh` },
                  { label: "Charging Stops",  value: `🔌 ${tripData.totalStops}` },
                  { label: "Charging Time",   value: `⏱️ ${tripData.totalChargingTimeHours} hrs` },
                  { label: "Safe Range",      value: `📏 ${tripData.safeRange} km` },
                  { label: "Final Battery",   value: `🔋 ${tripData.finalSoC}%` },
                  { label: "Estimated Cost",  value: `💰 ₹${tripData.totalCost}`, green: true },
                ].map((item) => (
                  <div key={item.label} className="bg-white/10 p-4 rounded-xl hover:scale-105 transition">
                    <p className="text-sm opacity-70">{item.label}</p>
                    <p className={`text-xl font-semibold ${item.green ? "text-green-400" : ""}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Charging Stop Cards ── */}
      {tripData?.recommendedStops?.length > 0 && (
        <div className="px-10 pb-16">
          <h3 className="text-3xl font-bold text-center mb-4 tracking-wide">
            ⚡ Charging Stops Along Your Journey
          </h3>

          {/* Legend */}
          <div className="flex justify-center gap-6 mb-10 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white inline-block" /> Real Station
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Charge to 100%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Find Charger (PlugShare)
            </span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tripData.recommendedStops.map((stop, index) => {
              const badge = getStopBadge(stop);
              return (
                <div
                  key={index}
                  className={`relative group rounded-2xl p-[1px] hover:scale-105 transition duration-300 shadow-xl ${
                    stop.isSynthetic
                      ? "bg-gradient-to-br from-yellow-500 via-orange-500 to-red-500"
                      : stop.chargeToPercent === 100
                      ? "bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500"
                      : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
                  }`}
                >
                  <div className="bg-gray-900 rounded-2xl p-5 h-full flex flex-col justify-between">
                    <div>
                      {/* Header */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-xs uppercase tracking-wider text-gray-400">
                          Stop #{index + 1}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Name */}
                      <h4 className="text-lg font-semibold leading-snug truncate">
                        🔌 {stop.stationName}
                      </h4>
                      <p className="text-sm text-gray-400 mt-2">
                        📍 {stop.lat?.toFixed(3)}, {stop.lng?.toFixed(3)}
                      </p>

                      {/* Warning note */}
                      {stop.note && (
                        <p className="text-xs mt-3 px-3 py-2 rounded-lg bg-yellow-500/10 text-yellow-300 border border-yellow-400/20 leading-relaxed">
                          ⚠️ {stop.note}
                        </p>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="mt-5 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Distance</span>
                        <span className="font-medium">🚗 {stop.cumulativeDistance} km</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Arrival SoC</span>
                        <span className={`font-medium ${stop.arrivalSoC < 20 ? "text-red-400" : "text-green-400"}`}>
                          🔋 {stop.arrivalSoC}%
                        </span>
                      </div>
                      {stop.detourKm > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-400">Detour</span>
                          <span className="font-medium text-gray-300">+{stop.detourKm} km</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Charge to</span>
                        <span className={`font-medium ${stop.chargeToPercent === 100 ? "text-purple-400" : "text-blue-400"}`}>
                          {stop.chargeToPercent ?? 80}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mt-1">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-blue-500"
                          style={{
                            width: `${Math.min(
                              (stop.cumulativeDistance / (tripData.totalDistance || 1)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-5 flex justify-between items-center">
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
                          : "Optimized Stop"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SoC Curve ── */}
      {socCurve.length > 0 && (
        <div className="px-10 pb-20">
          <div className="bg-white/5 p-6 rounded-2xl" style={{ minHeight: "400px" }}>
            {socReady ? (
              <SocCurve socCurve={socCurve} reservePercentage={Number(form.reserve)} />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <div className="animate-pulse">Loading chart...</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;