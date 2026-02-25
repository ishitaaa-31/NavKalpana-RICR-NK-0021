import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { Zap } from "lucide-react";

import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import LandingPage from "./pages/Landingpage";
import AdvancedLandingPage from "./pages/AdvancedLandingPage";

const App = () => {
  return (
    <BrowserRouter>
      <div className="bg-[#070B14] min-h-screen text-white">
        <Toaster />

        <Navbar logoText="VoltPath" LogoIcon={Zap} loginRoute="/login" />

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/landingPage" element={<LandingPage />} />
          <Route path="/advanced" element={<AdvancedLandingPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

export default App;