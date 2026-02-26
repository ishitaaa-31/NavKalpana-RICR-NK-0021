import React, { useEffect, useRef, useState } from "react";
import MapComponent from "../components/MapComponent.jsx";
import SocCurve from "../components/SocCurve.jsx";
import { Zap, MapPin, Navigation, BatteryCharging, Gauge, Shield, Battery } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [socReady, setSocReady] = useState(false);
  const [error, setError] = useState(null);

  // ✅ FIXED (missing states)
  const [tripData, setTripData] = useState(null);
  const [socCurve, setSocCurve] = useState([]);

  const hasSpokenRef = useRef(false);
  const distanceRef = useRef(0);
  const routePolylineRef = useRef(null);
  const durationRef = useRef(0);
  const formRef = useRef(form);
  const tripSessionRef = useRef(0);
  const resultsRef = useRef(null);
  const timeoutRef = useRef(null);

  const [showScrollHint, setShowScrollHint] = useState(false);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  // ── SUBMIT ──
  const handleSubmit = () => {
    setShowMap(true);
    setLoading(true);

    distanceRef.current = 0;
    routePolylineRef.current = null;
    tripSessionRef.current += 1;

    setTripData(null);
    setSocCurve([]);
    setDistance(0);
    setRoutePolyline(null);
  };

  const handleRouteReady = ({ distance, duration, polyline }) => {
    if (!polyline || polyline.length === 0) return;

    distanceRef.current = distance;
    durationRef.current = duration;
    routePolylineRef.current = polyline;

    setDistance(distance);
    setDuration(duration);
    setRoutePolyline(polyline);
  };

  // ✅ FIXED useEffect (removed form dependency)
  useEffect(() => {
    if (!distance || !routePolyline?.length) return;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      planTrip();
    }, 500);
  }, [distance, routePolyline]);

  // Speech
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

  // SoC curve
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
            usablePercentage: Number(form.usable),
            reservePercentage: Number(form.reserve),
            currentCharge: Number(form.charge),
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
  }, [tripData]);

  useEffect(() => {
    if (tripData) {
      const t = setTimeout(() => setShowScrollHint(true), 700);
      return () => clearTimeout(t);
    } else {
      setShowScrollHint(false);
    }
  }, [tripData]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // ── PLAN TRIP ──
  const planTrip = async () => {
    const session = tripSessionRef.current;
    const f = formRef.current;
    const dist = distanceRef.current;
    const poly = routePolylineRef.current;
    const dur = durationRef.current;

    if (!dist || !poly || poly.length < 2) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("http://localhost:4500/api/ev/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startLocation: f.start,
          destination: f.destination,
          distance: dist,
          duration: dur,
          routePolyline: poly,
          batteryCapacity: Number(f.battery),
          efficiency: Number(f.efficiency),
          usablePercentage: Number(f.usable),
          reservePercentage: Number(f.reserve),
          currentCharge: Number(f.charge),
          electricityRate: 8,
        }),
      });

      if (session !== tripSessionRef.current) return;

      const data = await response.json();
      console.log("Trip Data:", data); // ✅ debug

      setTripData(data);
    } catch (error) {
      console.error("Trip planning failed", error);
      setError("Failed to plan trip");
    } finally {
      if (session === tripSessionRef.current) setLoading(false);
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  };

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setShowScrollHint(false);
  };

  const statFields = [
    { label: "Battery", name: "battery", icon: Battery, hint: "kWh" },
    { label: "Efficiency", name: "efficiency", icon: Gauge, hint: "km/kWh" },
    { label: "Usable", name: "usable", icon: BatteryCharging, hint: "%" },
    { label: "Reserve", name: "reserve", icon: Shield, hint: "%" },
    { label: "Charge", name: "charge", icon: Zap, hint: "%" },
  ];

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: "#050810" }}>
      
      {/* LOADING */}
      {loading && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/90">
          <p>Planning your EV journey...</p>
        </div>
      )}

      {/* FORM */}
      <div className="p-6">
        <input name="start" placeholder="Start" value={form.start} onChange={handleChange} />
        <input name="destination" placeholder="Destination" value={form.destination} onChange={handleChange} />
        <button onClick={handleSubmit}>Calculate Route</button>
      </div>

      {/* MAP */}
      {showMap && (
        <MapComponent
          start={form.start}
          destination={form.destination}
          onRouteReady={handleRouteReady}
          tripData={tripData}
          form={form}
        />
      )}

      {/* RESULTS */}
      {tripData && (
        <div ref={resultsRef}>
          <h2>Trip Analysis</h2>
          <p>Stops: {tripData.totalStops}</p>
        </div>
      )}

      {/* STOPS */}
      {tripData?.recommendedStops?.length > 0 && (
        <div>
          {tripData.recommendedStops.map((stop, i) => (
            <div key={i}>
              <h4>{stop.stationName}</h4>
              <p>{stop.cumulativeDistance} km</p>
            </div>
          ))}
        </div>
      )}

      {/* SOC */}
      {socCurve.length > 0 && <SocCurve socCurve={socCurve} />}

      {showScrollHint && (
        <button onClick={scrollToResults}>
          View Results ↓
        </button>
      )}
    </div>
  );
};

export default LandingPage;