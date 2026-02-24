import React, { useState, useEffect } from "react";
import MapComponent from "../components/MapComponent.jsx";
import { useRef } from "react";

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
  const [tripData, setTripData] = useState(null);

  const [routePolyline, setRoutePolyline] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const hasSpokenRef = useRef(false);
  

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    setTripData(null);
    setStations([]);
    setDistance(0);
    setShowMap(true);
    setLoading(true);
    hasSpokenRef.current = false;
  };

  // ✅ ONLY store route info here
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
  if (distance > 0 && routePolyline) {
    planTrip();
  }
}, [distance, routePolyline]);

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
          usablePercentage: Number(form.usable),
          reservePercentage: Number(form.reserve),
          currentCharge: Number(form.charge),

          electricityRate: 8,
          stations,
        }),
      });

      const data = await response.json();
      setTripData(data);
    } catch (error) {
      console.error("Trip planning failed", error);
      
    }finally{
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
        <button className="bg-white text-black px-4 py-2 rounded-full">
          Get Started
        </button>
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
              { label: "Efficiency", name: "efficiency" },
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
      {loading && (
  <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
    
    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500 mb-4"></div>

    <h2 className="text-xl font-semibold">
      ⚡ Planning your EV journey...
    </h2>

    <p className="text-gray-400 mt-2">
      Finding routes, stations & optimizing battery 🔋
    </p>
  </div>
)}

      {/* MAP */}
      {showMap&&(
        <div className="px-10 pb-10">
          <MapComponent
            start={form.start}
            destination={form.destination}
            onRouteReady={handleRouteReady}
            //onStationsReady={setStations}
             tripData={tripData} 
          />
        </div>
      )}

      {/* ROUTE INFO */}
      {distance > 0 && (
        <div className="px-10 pb-10 flex justify-center">
          <div className="bg-white/10 p-6 rounded-xl max-w-lg">
            <h3 className="text-lg font-semibold mb-2">Route Info</h3>
            <p>📍 Distance: {distance.toFixed(2)} km</p>
          </div>
        </div>
      )}

      {/* RESULT */}
      {tripData && (
  <div className="px-6 pb-10 flex justify-center">
    <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 
                    p-[1px] rounded-2xl shadow-xl max-w-xl w-full">

      <div className="bg-gray-900 rounded-2xl p-6 text-white">
        <h3 className="text-2xl font-bold mb-5 text-center tracking-wide">
          ⚡ Trip Analysis
        </h3>

        <div className="grid grid-cols-2 gap-4">

          <div className="bg-white/10 p-4 rounded-xl hover:scale-105 transition">
            <p className="text-sm opacity-70">Energy Required</p>
            <p className="text-xl font-semibold">⚡ {tripData.totalEnergyRequired} kWh</p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl hover:scale-105 transition">
            <p className="text-sm opacity-70">Charging Stops</p>
            <p className="text-xl font-semibold">🔌 {tripData.totalStops}</p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl hover:scale-105 transition">
            <p className="text-sm opacity-70">Charging Time</p>
            <p className="text-xl font-semibold">⏱️ {tripData.totalChargingTimeHours} hrs</p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl hover:scale-105 transition">
            <p className="text-sm opacity-70">Safe Range</p>
            <p className="text-xl font-semibold">📏 {tripData.safeRange} km</p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl hover:scale-105 transition">
            <p className="text-sm opacity-70">Final Battery</p>
            <p className="text-xl font-semibold">🔋 {tripData.finalSoC}%</p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl hover:scale-105 transition">
            <p className="text-sm opacity-70">Estimated Cost</p>
            <p className="text-xl font-semibold text-green-400">
              💰 ₹{tripData.totalCost}
            </p>
          </div>

        </div>
      </div>
    </div>
  </div>
)}
{tripData?.recommendedStops?.length > 0 && (
  <div className="px-10 pb-16">
    <h3 className="text-3xl font-bold text-center mb-10 tracking-wide">
      ⚡ Charging Stops Along Your Journey
    </h3>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      {tripData.recommendedStops.map((stop, index) => (
        <div
          key={index}
          className="relative group rounded-2xl p-[1px] 
          bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 
          hover:scale-105 transition duration-300 shadow-xl"
        >
          {/* INNER CARD */}
          <div className="bg-gray-900 rounded-2xl p-5 h-full flex flex-col justify-between">

            {/* TOP */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs uppercase tracking-wider text-gray-400">
                  Stop #{index + 1}
                </span>

                <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
                  ⚡ Charging Point
                </span>
              </div>

              <h4 className="text-lg font-semibold leading-snug">
                🔌 {stop.stationName || "EV Charging Station"}
              </h4>

              <p className="text-sm text-gray-400 mt-2">
                📍 {stop.lat?.toFixed(3)}, {stop.lng?.toFixed(3)}
              </p>
            </div>

            {/* MIDDLE */}
            <div className="mt-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Distance</span>
                <span className="font-medium">
                  🚗 {stop.cumulativeDistance} km
                </span>
              </div>

              {/* Progress bar (visual touch) */}
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-500"
                  style={{
                    width: `${Math.min(
                      (stop.cumulativeDistance / tripData.totalDistance) * 100 || 20,
                      100
                    )}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* BOTTOM */}
            <div className="mt-5 flex justify-between items-center">
              <a
                href={`https://www.google.com/maps?q=${stop.lat},${stop.lng}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-400 hover:underline"
              >
                🧭 Navigate
              </a>

              <span className="text-xs text-gray-500">
                Optimized Stop
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
)}

    </div>
  );
};

export default LandingPage;