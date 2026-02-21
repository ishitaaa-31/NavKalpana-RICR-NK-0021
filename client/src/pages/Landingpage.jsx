import React, { useState } from "react";

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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">

      {/* Navbar */}
      <div className="flex justify-between items-center px-10 py-5">
        <h1 className="text-2xl font-bold tracking-wide">
          ⚡ VoltPath
        </h1>
        <button className="bg-white text-black px-4 py-2 rounded-full font-medium hover:scale-105 transition">
          Get Started
        </button>
      </div>

      {/* Main Section */}
      <div className="flex flex-col md:flex-row items-center justify-between px-10 py-10 gap-10">

        {/* LEFT SIDE */}
        <div className="max-w-lg space-y-6">
          <h2 className="text-4xl font-bold leading-tight">
            Plan Smart EV Journeys 🚗⚡
          </h2>
          <p className="text-gray-300">
            Optimize your route with intelligent charging stops and never worry
            about battery again.
          </p>

          {/* Route Input Card */}
          <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl border border-white/20 shadow-xl space-y-4">

            <input
              name="start"
              placeholder="📍 Start Location"
              value={form.start}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-black/30 border border-gray-600 focus:outline-none focus:ring-2 focus:to-blue-500"
            />

            <input
              name="destination"
              placeholder="🏁 Destination"
              value={form.destination}
              onChange={handleChange}
              className="w-full p-3 rounded-lg bg-black/30 border border-gray-600 focus:outline-none focus:ring-2 focus:to-blue-500"
            />

            <button className="w-full bg-blue-500 hover:bg-blue-500 py-3 rounded-lg font-semibold transition">
              ⚡ Calculate Route
            </button>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="w-full max-w-md bg-white/10 backdrop-blur-lg p-6 rounded-2xl border border-white/20 shadow-xl">

          <h3 className="text-lg font-semibold mb-4">
            🔋 Vehicle Stats
          </h3>

          <div className="space-y-4">

            {[
              { label: "Battery (kWh)", name: "battery" },
              { label: "Efficiency (km/kWh)", name: "efficiency" },
              { label: "Usable Battery (%)", name: "usable" },
              { label: "Reserve (%)", name: "reserve" },
              { label: "Current Charge (%)", name: "charge" },
            ].map((item) => (
              <div key={item.name}>
                <label className="text-sm text-gray-300">
                  {item.label}
                </label>
                <input
                  name={item.name}
                  value={form[item.name]}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 rounded-md bg-black/30 border border-gray-600 focus:outline-none focus:ring-2 focus:bg-blue-500"
                />
              </div>
            ))}
          </div>

          {/* Battery Indicator */}
          <div className="mt-6">
            <p className="text-sm text-gray-300 mb-1">
              Battery Level
            </p>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-400 h-3 rounded-full"
                style={{ width: `${form.charge}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-400 text-sm pb-6">
        Built with ⚡ for smarter EV travel
      </div>
    </div>
  );
};

export default LandingPage;