import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import voltPathLogo from "../assets/voltpathLogo.png";
import { Zap } from "lucide-react";

const Navbar = ({ logoText = "VoltPath", LogoIcon, loginRoute = "/login" }) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');

        .vp-nav {
          position: fixed;
          top: 0; left: 0;
          width: 100%;
          z-index: 50;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          transition: background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
        }
        .vp-nav.scrolled {
          background: rgba(5, 8, 16, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 40px rgba(0,0,0,0.4);
        }
        .vp-nav.top {
          background: rgba(5, 8, 16, 0.5);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }

        .nav-logo-wrap {
          display: flex;
          align-items: center;
          cursor: pointer;
          user-select: none;
          transition: opacity 0.2s ease;
        }
        .nav-logo-wrap:hover { opacity: 0.85; }

        .nav-logo-img {
          height: 44px;
          width: auto;
          object-fit: contain;
          transition: transform 0.25s cubic-bezier(.22,.68,0,1.2);
        }
        .nav-logo-wrap:hover .nav-logo-img {
          transform: scale(1.05);
        }

        /* right side pill */
        .nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-pill {
          font-family: 'Syne', sans-serif;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          padding: 7px 18px;
          border-radius: 99px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #64748b;
          cursor: default;
          transition: none;
        }

        /* glowing divider dot */
        .nav-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: linear-gradient(135deg, #38bdf8, #34d399);
          box-shadow: 0 0 8px rgba(56,189,248,0.6);
          flex-shrink: 0;
        }

        /* subtle animated underline on logo area */
        .nav-logo-line {
          position: absolute;
          bottom: 0; left: 0;
          height: 1px;
          width: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(56,189,248,0.4) 50%, transparent 100%);
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .vp-nav.scrolled .nav-logo-line { opacity: 1; }
      `}</style>

      <nav className={`vp-nav ${scrolled ? "scrolled" : "top"}`}>

        {/* Logo */}
        <div className="nav-logo-wrap" onClick={() => navigate("/")}>
          <img
            src={voltPathLogo}
            alt="VoltPath Logo"
            className="nav-logo-img"
            draggable="false"
          />
        </div>

        {/* Right side */}
        <div className="nav-right">
          <div className="nav-dot" />
          <span className="nav-pill">EV Trip Planner</span>
        </div>

        {/* bottom glow line on scroll */}
        <div className="nav-logo-line" />
      </nav>
    </>
  );
};

export default Navbar;