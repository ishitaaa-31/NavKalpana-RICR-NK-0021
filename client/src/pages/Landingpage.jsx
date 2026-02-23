import React, { useState, useEffect } from "react";
import MapComponent from "../components/MapComponent.jsx";

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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = () => {
    setTripData(null);
    setStations([]);
    setDistance(0);
    setShowMap(true);
  };

  // ✅ ONLY store route info here
  const handleRouteReady = ({ distance, duration, polyline }) => {
    setDistance(distance);
    setDuration(duration);
    setRoutePolyline(polyline);
  };

  // ✅ BACKEND CALL — only when distance + stations are ready
  useEffect(() => {
    if (distance > 0 && stations.length > 0) {
      planTrip();
    }
  }, [distance, stations]);

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
    }
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

      {/* MAP */}
      {showMap && (
        <div className="px-10 pb-10">
          <MapComponent
            start={form.start}
            destination={form.destination}
            onRouteReady={handleRouteReady}
            onStationsReady={setStations}
          />
        </div>
      )}

      {/* ROUTE INFO */}
      {distance > 0 && (
        <div className="px-10 pb-10">
          <div className="bg-white/10 p-6 rounded-xl max-w-lg">
            <h3 className="text-lg font-semibold mb-2">Route Info</h3>
            <p>📍 Distance: {distance.toFixed(2)} km</p>
          </div>
        </div>
      )}

      {/* RESULT */}
      {tripData && (
        <div className="px-10 pb-10">
          <div className="bg-white/10 p-6 rounded-xl max-w-lg space-y-3">
            <h3 className="text-lg font-semibold mb-2">🔋 Trip Analysis</h3>

            <p>⚡ Total Energy Required: {tripData.totalEnergyRequired} kWh</p>
            <p>🔌 Charging Stops Required: {tripData.totalStops}</p>
            <p>⏱️ Total Charging Time: {tripData.totalChargingTimeHours} hrs</p>
            <p>📏 Safe Range: {tripData.safeRange} km</p>
            <p>🔋 Final Battery SoC: {tripData.finalSoC}%</p>
            <p>💰 Estimated Charging Cost: ₹{tripData.totalCost}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;