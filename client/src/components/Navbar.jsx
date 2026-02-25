import React from "react";
import { useNavigate } from "react-router-dom";
import voltPathLogo from "../assets/voltpathLogo.png";

const Navbar = ({ logoText = "VoltPath", LogoIcon, loginRoute = "/login" }) => {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 w-full z-50
bg-[#0B1220]/70 backdrop-blur-md border-b border-white/10
px-8 h-16 flex items-center justify-between">

  {/* Logo */}
  <div
    className="flex items-center cursor-pointer select-none"
    onClick={() => navigate("/")}
  >
    <img
      src={voltPathLogo}
      alt="VoltPath Logo"
      className="h-11 md:h-12 w-auto object-contain
      transition-transform duration-200 hover:scale-105"
      draggable="false"
    />
  </div>

  {/* CTA */}
  {/* <button
    onClick={() => navigate("/landingPage")}
    className="bg-gradient-to-r from-blue-500 to-teal-400 
    hover:opacity-90 text-white font-medium
    px-5 py-2 rounded-lg transition duration-200"
  >
    Get Started →
  </button> */}

</nav>
  );
};

export default Navbar;
