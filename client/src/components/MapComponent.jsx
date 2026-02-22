import React, { useEffect, useState } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const MapComponent = ({ start, destination }) => {
  const [route, setRoute] = useState([]);
  const [startPos, setStartPos] = useState(null);
  const [endPos, setEndPos] = useState(null);
  const [stations, setStations] = useState([]);

  const FitBounds = ({ route }) => {
  const map = useMap();
  const hasFitted = React.useRef(false);

  useEffect(() => {
    if (!route.length || hasFitted.current) return;

    map.fitBounds(route, {
      padding: [50, 50],
    });

    hasFitted.current = true; // ✅ only once
  }, [route]);

  return null;
};
const startIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32],
});
const endIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32],
});
const evIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
  iconSize: [32, 32],
});

  const getRouteCenter = () => {
  if (!route.length) return null;

  const midIndex = Math.floor(route.length / 2);
  return route[midIndex]; // [lat, lng]
};

  // 📏 Distance function
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // 🔥 Filter stations on route
  const getStationsOnRoute = () => {
  if (!route.length || !stations.length) return [];

  const filtered = [];

  stations.forEach((station) => {
    let minDistance = Infinity;

    for (let i = 0; i < route.length; i += 5) {
      const [lat, lng] = route[i];

      const dist = getDistance(
        lat,
        lng,
        station.lat,
        station.lng
      );

      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    // 🔥 IMPORTANT: relaxed condition
    if (minDistance < 25) {
      filtered.push(station);
    }
  });

  console.log("Filtered stations:", filtered.length);

  return filtered;
};

  // 🔹 Convert place → coordinates
  const getCoordinates = async (place) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${place},India&limit=1`
    );
    const data = await res.json();

    if (!data.length) return null;

    return [
      parseFloat(data[0].lat),
      parseFloat(data[0].lon),
    ];
  };

  // 🔹 Fetch route
 useEffect(() => {
  if (!start || !destination) return;

  const fetchRoute = async () => {
    try {
      const startLatLng = await getCoordinates(start);
      const destLatLng = await getCoordinates(destination);

      if (!startLatLng || !destLatLng) return;

      setStartPos(startLatLng);
      setEndPos(destLatLng);

      const startCoords = [startLatLng[1], startLatLng[0]];
      const endCoords = [destLatLng[1], destLatLng[0]];

      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}?overview=full&geometries=geojson`
      );

      const data = await res.json();

      const coords = data.routes[0].geometry.coordinates;

      const formatted = coords.map((c) => [c[1], c[0]]);

      setRoute(formatted);
    } catch (err) {
      console.error("Route error:", err);
    }
  };

  fetchRoute();
}, [start, destination]); // ✅ ALWAYS SAME
  // 🔹 Fetch EV stations
  useEffect(() => {
  if (!route.length) return;

  const fetchStations = async () => {
    try {
      const center = getRouteCenter();
      if (!center) return;

      const [lat, lng] = center;

      const res = await fetch(
        `http://127.0.0.1:4500/api/ev-stations?lat=${lat}&lng=${lng}`
      );

      const data = await res.json();
      setStations(data);
    } catch (err) {
      console.error("EV fetch error:", err);
    }
  };

  fetchStations();
}, [route]);
console.log("Stations:", stations);
  return (
    
    <div className="rounded-xl overflow-hidden">
      <MapContainer
    
      
  center={[20, 78]}
  zoom={5}
  scrollWheelZoom={true}
  doubleClickZoom={true}
  style={{ height: "400px", width: "100%" }}
>
    
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Start */}
      {startPos && (
        <Marker position={startPos} icon={startIcon}>
          <Popup>Start: {start}</Popup>
        </Marker>
      )}

      {/* Destination */}
      {endPos && (
        <Marker position={endPos} icon={endIcon}>
          <Popup>Destination: {destination}</Popup>
        </Marker>
      )}

      {/* Route */}
      console.log("Route length:", route.length);
      {route.length > 0 && <Polyline
  positions={route}
  pathOptions={{
    color: "blue",
    weight: 5,
  }}
/>}

      {/* 🔥 Filtered EV Stations */}
      {getStationsOnRoute().map((station, i) => (
        <Marker key={i} position={[station.lat, station.lng]} icon={evIcon}>
          <Popup>⚡ {station.name}</Popup>
        </Marker>
      ))}
      <FitBounds route={route} />
    </MapContainer>
    </div>
  );
};

export default MapComponent;