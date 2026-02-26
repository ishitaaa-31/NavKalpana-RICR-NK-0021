import React from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin,
  BatteryCharging,
  DollarSign,
  Clock,
  ShieldCheck,
  BarChart3,
  Zap,
} from "lucide-react";

const Home = () => {
  const navigate = useNavigate();

  const features = [
    {
      title: "Smart Routing",
      desc: "Optimized charging stop placement along your route for maximum efficiency.",
      icon: MapPin,
    },
    {
      title: "Energy Modeling",
      desc: "Precise State of Charge simulation for every segment of your journey.",
      icon: BatteryCharging,
    },
    {
      title: "Cost Analysis",
      desc: "Transparent electricity cost breakdown with real-time pricing.",
      icon: DollarSign,
    },
    {
      title: "Time Optimization",
      desc: "Minimize total trip time including charging stops and driving duration.",
      icon: Clock,
    },
    {
      title: "Range Safety",
      desc: "Guaranteed minimum reserve SoC with configurable safety buffers.",
      icon: ShieldCheck,
    },
    {
      title: "Analytics Dashboard",
      desc: "Comprehensive visualizations of energy consumption and efficiency.",
      icon: BarChart3,
    },
  ];

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: "#050810", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* GLOBAL STYLES (same as Landing page) */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        .syne { font-family: 'Plus Jakarta Sans', sans-serif; }

        .grad-text {
          background: linear-gradient(135deg, #38bdf8 0%, #34d399 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .glass {
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.08);
          backdrop-filter: blur(20px);
          border-radius: 22px;
        }

        .vp-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
          background-size: 72px 72px;
        }

        .cta-btn {
          background: linear-gradient(135deg, #3b82f6 0%, #06b6d4 50%, #34d399 100%);
          background-size: 200% auto;
          box-shadow: 0 0 40px rgba(6,182,212,.3);
          transition: background-position .4s ease, transform .2s ease, box-shadow .3s ease;
        }

        .cta-btn:hover {
          background-position: right center;
          transform: translateY(-2px);
          box-shadow: 0 0 60px rgba(6,182,212,.45);
        }

        .feature-card {
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 20px;
          transition: transform .25s, background .25s;
        }

        .feature-card:hover {
          transform: translateY(-4px);
          background: rgba(255,255,255,.06);
        }
      `}</style>

      {/* HERO */}
      <section className="relative pt-36 pb-28 text-center px-6 overflow-hidden">
        <div className="vp-grid" />

        {/* micro label */}
        <div className="flex justify-center mb-5">
          <span
            className="syne text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full"
            style={{
              color: "#38bdf8",
              border: "1px solid rgba(56,189,248,.35)",
              background: "rgba(56,189,248,.08)",
            }}
          >
            Smart EV Navigation
          </span>
        </div>

        {/* heading */}
        <h1
          className="syne font-extrabold leading-tight mx-auto"
          style={{
            fontSize: "clamp(2.6rem, 5vw, 4rem)",
            letterSpacing: "-0.03em",
            maxWidth: "900px",
          }}
        >
          Eliminate Range Anxiety.
          <br />
          <span className="grad-text">Optimize Every Kilometer</span>
        </h1>

        {/* description */}
        <p
          className="mx-auto mt-6"
          style={{
            color: "#64748b",
            maxWidth: "620px",
            fontSize: "1.05rem",
            lineHeight: 1.7,
          }}
        >
          VoltPath intelligently plans EV journeys by predicting battery usage,
          placing charging stops, and guaranteeing a safe reserve throughout
          your trip.
        </p>

        {/* CTA */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => navigate("advanced")}
            className="cta-btn syne font-bold px-8 py-4 rounded-xl flex items-center gap-2"
            style={{ letterSpacing: "0.03em" }}
          >
            <Zap size={18} />
            Plan Your Trip
          </button>
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-8 pb-28 max-w-7xl mx-auto">
        {/* section heading */}
        <div className="text-center mb-16">
          <p
            className="syne text-xs font-bold uppercase tracking-widest mb-3"
            style={{ color: "#38bdf8" }}
          >
            Platform Capabilities
          </p>
          <h2
            className="syne font-extrabold"
            style={{
              fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
              letterSpacing: "-0.025em",
            }}
          >
            Complete Trip Intelligence
          </h2>
          <p className="mt-4 text-sm" style={{ color: "#64748b" }}>
            Every kilometer calculated. Every stop optimized.
          </p>
        </div>

        {/* grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((item, index) => (
            <div key={index} className="feature-card p-7">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(56,189,248,.18), rgba(52,211,153,.12))",
                }}
              >
                <item.icon size={20} color="#38bdf8" />
              </div>

              <h3 className="syne font-bold mb-2 text-lg">{item.title}</h3>

              <p
                className="text-sm leading-relaxed"
                style={{ color: "#64748b" }}
              >
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;