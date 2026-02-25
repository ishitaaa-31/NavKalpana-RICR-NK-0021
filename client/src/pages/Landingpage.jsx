import React, { useState, useEffect, useRef } from "react";
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
  const [socCurve, setSocCurve] = useState([]);
  const [duration, setDuration] = useState(0);
  const [tripData, setTripData] = useState(null);
  const [routePolyline, setRoutePolyline] = useState(null);
  const [loading, setLoading] = useState(false);
  // FIX: track whether socCurve container is mounted and has dimensions
  const [socReady, setSocReady] = useState(false);

  const hasSpokenRef = useRef(false);
  const hasPlannedRef = useRef(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = () => {
    // setTripData(null);
    // setStations([]);
    // setDistance(0);
    setShowMap(true);
    setLoading(true);
     
    hasSpokenRef.current = false;
    
  };

  const handleRouteReady = ({ distance, duration, polyline }) => {
    setDistance(distance);
    setDuration(duration);
    setRoutePolyline(polyline);
  };




  // ✅ BACKEND CALL — only when distance + stations are ready
  // useEffect(() => {
  //   if (distance > 0 && stations.length > 0) {
  //     planTrip();
  //   }
  // }, [distance, stations]);
  useEffect(() => {
    if (distance > 0 && routePolyline && !hasPlannedRef.current) {
      hasPlannedRef.current = true;
      planTrip();
      
    }
  }, [distance, routePolyline,form]);

const timeoutRef = useRef(null);

useEffect(() => {
  if (!distance || !routePolyline) return;

  clearTimeout(timeoutRef.current);

  timeoutRef.current = setTimeout(() => {
    planTrip();
  }, 500); // 👈 delay

}, [distance, routePolyline, form]);



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

  // FIX: fetch SoC curve after tripData is set, and mark socReady after short delay
  // so the Recharts container has time to mount and get real dimensions
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
            usablePercentage: Number(form.usable), // FIX: pass usable%
            reservePercentage: Number(form.reserve),
            currentCharge: Number(form.charge),
          }),
        });
        const data = await res.json();
        setSocCurve(data.socCurve || []);

        // FIX: delay marking chart as ready so container is in DOM with real width
        setTimeout(() => setSocReady(true), 100);
      } catch (err) {
        console.error("SoC curve fetch failed", err);
      }
    };

    fetchSocCurve();
  }, [tripData]);

  const planTrip = async () => {
    try {
      const response = await fetch("http://localhost:4500/api/ev/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLocation: form.start,
          destination: form.destination,
          distance,
          duration,
          routePolyline,
          batteryCapacity: Number(form.battery),
          efficiency: Number(form.efficiency),
          usablePercentage: Number(form.usable), // FIX: pass usable%
          reservePercentage: Number(form.reserve),
          currentCharge: Number(form.charge),
          electricityRate: 8,
        }),
      });
      const data = await response.json();
      setTripData(data);
    } catch (error) {
      console.error("Trip planning failed", error);
    } finally {
       setLoading(false);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      {/* Navbar */}
      <div className="flex justify-between items-center px-10 py-5">
        <h1 className="text-2xl font-bold tracking-wide">⚡ VoltPath</h1>
        <button className="bg-white text-black px-4 py-2 rounded-full">Get Started</button>
      </div>

      {/* Main Section */}
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
              className="w-full p-3 rounded-lg bg-black/30 border"
            />
            <input
              name="destination"
              placeholder="🏁 Destination"
              value={form.destination}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-black/30 border"
            />
            <button
              onClick={handleSubmit}
              className="w-full bg-blue-500 py-3 rounded-lg font-semibold"
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
                  className="w-full p-2 mt-1 rounded bg-black/30 border"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4"></div>
          <h2 className="text-xl font-semibold">⚡ Planning your EV journey...</h2>
          <p className="text-gray-400 mt-2">Finding routes, stations & optimizing battery 🔋</p>
        </div>
      )}

      {/* MAP */}
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

      {/* Route Info */}
      {distance > 0 && (
        <div className="px-10 pb-10 flex justify-center">
          <div className="bg-white/10 p-6 rounded-xl max-w-lg">
            <h3 className="text-lg font-semibold mb-2">Route Info</h3>
            <p>📍 Distance: {distance.toFixed(2)} km</p>
          </div>
        </div>
      )}

      {/* Trip Analysis */}
      {tripData && (
        <div className="px-6 pb-10 flex justify-center">
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-[1px] rounded-2xl shadow-xl max-w-xl w-full">
            <div className="bg-gray-900 rounded-2xl p-6 text-white">
              <h3 className="text-2xl font-bold mb-5 text-center tracking-wide">⚡ Trip Analysis</h3>

              {/* Show message if no real stops found */}
              {tripData.recommendedStops?.some((s) => s.isSynthetic) && (
                <div className="mb-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-3 text-sm text-yellow-300">
                  ⚠️ Some stops are <strong>suggested plan-ahead points</strong> — real charging stations
                  may be sparse in this corridor. Check <a href="https://www.plugshare.com" target="_blank" rel="noreferrer" className="underline">PlugShare</a> for verified chargers nearby.
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Energy Required", value: `⚡ ${tripData.totalEnergyRequired} kWh` },
                  { label: "Charging Stops", value: `🔌 ${tripData.totalStops}` },
                  { label: "Charging Time", value: `⏱️ ${tripData.totalChargingTimeHours} hrs` },
                  { label: "Safe Range", value: `📏 ${tripData.safeRange} km` },
                  { label: "Final Battery", value: `🔋 ${tripData.finalSoC}%` },
                  { label: "Estimated Cost", value: `💰 ₹${tripData.totalCost}`, green: true },
                ].map((item) => (
                  <div key={item.label} className="bg-white/10 p-4 rounded-xl hover:scale-105 transition">
                    <p className="text-sm opacity-70">{item.label}</p>
                    <p className={`text-xl font-semibold ${item.green ? "text-green-400" : ""}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charging Stops Cards */}
      {tripData?.recommendedStops?.length > 0 && (
        <div className="px-10 pb-16">
          <h3 className="text-3xl font-bold text-center mb-10 tracking-wide">⚡ Charging Stops Along Your Journey</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tripData.recommendedStops.map((stop, index) => (
              <div key={index} className="relative group rounded-2xl p-[1px] bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 hover:scale-105 transition duration-300 shadow-xl">
                <div className="bg-gray-900 rounded-2xl p-5 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs uppercase tracking-wider text-gray-400">Stop #{index + 1}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${stop.isSynthetic ? "bg-yellow-500/20 text-yellow-300" : "bg-white/10"}`}>
                        {stop.isSynthetic ? "⚠️ Plan Ahead" : "⚡ Charging Point"}
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold leading-snug">🔌 {stop.stationName}</h4>
                    <p className="text-sm text-gray-400 mt-2">📍 {stop.lat?.toFixed(3)}, {stop.lng?.toFixed(3)}</p>
                  </div>

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
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-400 to-blue-500"
                        style={{ width: `${Math.min((stop.cumulativeDistance / (tripData.totalDistance || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex justify-between items-center">
                    <a
                      href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                      target="_blank" rel="noreferrer"
                      className="text-sm text-blue-400 hover:underline"
                    >
                      🧭 Navigate
                    </a>
                    <span className="text-xs text-gray-500">{stop.isSynthetic ? "No real station found" : "Optimized Stop"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FIX: only render SocCurve after container is mounted & socReady=true */}
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