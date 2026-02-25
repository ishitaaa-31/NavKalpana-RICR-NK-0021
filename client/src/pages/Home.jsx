import React from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { Zap } from "lucide-react";
import {
  MapPin,
  BatteryCharging,
  DollarSign,
  Clock,
  ShieldCheck,
  BarChart3,
} from "lucide-react";

const Home = () => {
  const navigate = useNavigate();
  const features = [
    {
      title: "Smart Routing",
      desc: "Optimized charging stop placement along your route for maximum efficiency.",
      icon: MapPin,
      color: "bg-blue-500/20",
    },
    {
      title: "Energy Modeling",
      desc: "Precise State of Charge simulation for every segment of your journey.",
      icon: BatteryCharging,
      color: "bg-emerald-500/20",
    },
    {
      title: "Cost Analysis",
      desc: "Transparent electricity cost breakdown with real-time pricing.",
      icon: DollarSign,
      color: "bg-blue-500/20",
    },
    {
      title: "Time Optimization",
      desc: "Minimize total trip time including charging stops and driving duration.",
      icon: Clock,
      color: "bg-emerald-500/20",
    },
    {
      title: "Range Safety",
      desc: "Guaranteed minimum reserve SoC with configurable safety buffers.",
      icon: ShieldCheck,
      color: "bg-cyan-500/20",
    },
    {
      title: "Analytics Dashboard",
      desc: "Comprehensive visualizations of energy consumption and efficiency.",
      icon: BarChart3,
      color: "bg-emerald-500/20",
    },
  ];
  return (
    <div className="min-h-screen bg-[#070B14] text-white">
      {/* push content below fixed navbar */}
      <div className="pt-28">
        <section className="relative flex flex-col items-center justify-center text-center px-6">
          {/* background glow */}
          <div className="absolute inset-0 -z-10">
            <div
              className="absolute left-1/2 top-1/2 w-[900px] h-[900px] -translate-x-1/2 -translate-y-1/2 
            bg-gradient-to-br from-blue-600/30 via-cyan-400/20 to-green-400/20 blur-3xl rounded-full"
            />
          </div>

          {/* badge */}
          <div className="mb-6">
            <span className="px-4 py-2 rounded-full text-sm bg-blue-500/10 border border-blue-400/30 text-blue-300">
              ⚡ Smart energy planning
            </span>
          </div>

          {/* main heading */}
          <h1 className="text-5xl md:text-6xl font-bold leading-tight max-w-4xl">
            Eliminate Range Anxiety.
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-green-400 text-transparent bg-clip-text">
              Optimize Every Mile.
            </span>
          </h1>

          {/* description */}
          <p className="mt-6 text-gray-400 max-w-2xl text-lg leading-relaxed">
            VoltPath plans EV routes by computing efficient charging stops,
            estimating battery consumption, and ensuring a minimum reserve SoC
            throughout the journey.
          </p>

          {/* buttons */}
          <div className="mt-15 flex gap-4 flex-wrap justify-center">
            <button
              onClick={() => navigate("/landingPage")}
              className="flex items-center gap-2 px-6 py-3 rounded-lg 
    bg-gradient-to-r from-blue-500 to-green-400 hover:opacity-90 font-medium"
            >
              <Zap size={18} />
              Let’s Plan Your Trip ⚡
            </button>
          </div>
        </section>
        {/* FEATURES SECTION */}
        <section className="max-w-7xl mx-auto px-6 py-24">
          {/* heading */}
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold">Complete Trip Intelligence</h2>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Optimized route planning and energy estimation guide your entire
              trip.
            </p>
          </div>

          {/* grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((item, index) => (
              <div
                key={index}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 
                   hover:bg-white/10 transition duration-300 
                   backdrop-blur-md group"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${item.color}`}
                >
                  <item.icon className="text-white" size={22} />
                </div>

                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;
