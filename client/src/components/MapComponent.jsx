import React, { useEffect, useState, useRef } from "react";
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

const MapComponent = ({
  start,
  destination,
  onRouteReady,
  //onStationsReady,
  tripData,
  form,
}) => {
  const [route, setRoute] = useState([]);
  const [startPos, setStartPos] = useState(null);
  const [endPos, setEndPos] = useState(null);
  const [filteredStations, setFilteredStations] = useState([]);
  const hasSentStations = useRef(false);

  /* ---------------- Fit Bounds ---------------- */
  const FitBounds = ({ route }) => {
    const map = useMap();

    useEffect(() => {
      if (!route.length) return;
      map.fitBounds(route, { padding: [50, 50] });
    }, [route]);

    return null;
  };

  /* ---------------- Icons ---------------- */
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

  /* ---------------- Helpers ---------------- */
  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  /* ---------------- Filter stations on route ---------------- */
  const computeStationsOnRoute = (stationsList, routeLine) => {
    if (!routeLine.length || !stationsList.length) return [];

    return stationsList.filter((station) =>
      routeLine.some(([lat, lng], i) => {
        if (i % 5 !== 0) return false;
        return getDistance(lat, lng, station.lat, station.lng) < 25;
      })
    );
  };

  /* ---------------- Nominatim ---------------- */
  const getCoordinates = async (place) => {
  const res = await fetch(
    `http://127.0.0.1:4500/api/geocode?place=${place}`
  );

  const data = await res.json();
   if (!data || data.lat == null || data.lng == null) {
    return null; // ✅ prevent undefined crash
  }
  return [data.lat, data.lng];
};

  /* ---------------- Fetch Route ---------------- */
  // useEffect(() => {
  //   if (!start || !destination) return;

  //   // 🔁 RESET when route changes
  //   setRoute([]);
  //   setFilteredStations([]);
  //   hasSentStations.current = false;

  //   const fetchRoute = async () => {
  //     try {
  //       const startLatLng = await getCoordinates(start);
  //       const endLatLng = await getCoordinates(destination);
  //       if (!startLatLng || !endLatLng) return;

  //       setStartPos(startLatLng);
  //       setEndPos(endLatLng);

  //       const res = await fetch(
  //         `https://router.project-osrm.org/route/v1/driving/${startLatLng[1]},${startLatLng[0]};${endLatLng[1]},${endLatLng[0]}?overview=full&geometries=geojson`
  //       );

  //       const data = await res.json();
  //       const formatted = data.routes[0].geometry.coordinates.map((c) => [
  //         c[1],
  //         c[0],
  //       ]);

  //       setRoute(formatted);

  //       onRouteReady?.({
  //         distance: data.routes[0].distance / 1000,
  //         duration: data.routes[0].duration / 60,
  //         polyline: formatted,
  //       });
  //     } catch (err) {
  //       console.error("Route error:", err);
  //     }
  //   };

  //   fetchRoute();
  // }, [start, destination]);

useEffect(() => {
  if (!start || !destination) return;

  let isActive = true; // ✅ prevents stale updates

  // 🔁 RESET safely
  setRoute([]);
  setFilteredStations([]);
  setStartPos(null);   // ✅ IMPORTANT
  setEndPos(null);     // ✅ IMPORTANT
  hasSentStations.current = false;

  const fetchRoute = async () => {
    try {
      const startLatLng = await getCoordinates(start);
      const endLatLng = await getCoordinates(destination);

      // 🛑 STOP if component updated
      if (!isActive) return;

      // 🛑 Validate coords
      if (
        !startLatLng ||
        !endLatLng ||
        startLatLng.includes(undefined) ||
        endLatLng.includes(undefined)
      ) {
        console.log("❌ Invalid coordinates");
        return;
      }

      setStartPos(startLatLng);
      setEndPos(endLatLng);

      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${startLatLng[1]},${startLatLng[0]};${endLatLng[1]},${endLatLng[0]}?overview=full&geometries=geojson`
      );

      const data = await res.json();

      if (!isActive) return;

      if (!data.routes || !data.routes.length) return;

      const formatted = data.routes[0].geometry.coordinates.map((c) => [
        c[1],
        c[0],
      ]);

      // 🛑 FINAL VALIDATION
      if (!formatted.length) return;

      setRoute(formatted);

      onRouteReady?.({
        distance: data.routes[0].distance / 1000,
        duration: data.routes[0].duration / 60,
        polyline: formatted,
      });

    } catch (err) {
      console.error("Route error:", err);
    }
  };

  fetchRoute();

  // ✅ CLEANUP (MOST IMPORTANT)
  return () => {
    isActive = false;
  };
}, [start, destination,form]);



  /* ---------------- Fetch EV Stations ---------------- */
  /* ---------------- Fetch EV Stations (FULL ROUTE) ---------------- */
// useEffect(() => {
//   if (!route.length || hasSentStations.current) return;

//   const fetchStationsAlongRoute = async () => {
//     let allStations = [];

//     for (let i = 0; i < route.length; i += 100) {
//       const [lat, lng] = route[i];

//       try {
//         const res = await fetch(
//           `http://127.0.0.1:4500/api/ev-stations?lat=${lat}&lng=${lng}`
//         );

//         const data = await res.json();
//         allStations = [...allStations, ...data];
//       } catch (err) {
//         console.error("Fetch error at point:", i, err);
//       }
//     }

//     // remove duplicates
//     const uniqueStations = Array.from(
//       new Map(allStations.map(s => [`${s.lat}-${s.lng}`, s])).values()
//     );

//     return uniqueStations;
//   };

//   const fetchStations = async () => {
//     try {
//       const stations = await fetchStationsAlongRoute();

//       setFilteredStations(stations);
//       onStationsReady?.(stations);

//       hasSentStations.current = true;
//     } catch (err) {
//       console.error("EV fetch error:", err);
//     }
//   };

//   fetchStations();
// }, [route]);
  /* ---------------- Render ---------------- */
  return (
    <div className="rounded-xl overflow-hidden">
      <MapContainer
        center={[20, 78]}
        zoom={5}
        scrollWheelZoom
        style={{ height: "400px", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {startPos && (
          <Marker position={startPos} icon={startIcon}>
            <Popup>Start: {start}</Popup>
          </Marker>
        )}

        {endPos && (
          <Marker position={endPos} icon={endIcon}>
            <Popup>Destination: {destination}</Popup>
          </Marker>
        )}

        {route.length > 0 && (
          <Polyline positions={route} pathOptions={{ color: "blue", weight: 5 }} />
        )}

        {/* {tripData?.recommendedStops?.map((stop, i) => (
  <Marker key={i} position={[stop.lat, stop.lng]}>
    <Popup>⭐ {stop.stationName}</Popup>
  </Marker>
))} */}

{tripData?.recommendedStops?.map((stop, i) => {
  if (!stop.lat || !stop.lng) return null;

  return (
    <Marker key={i} position={[stop.lat, stop.lng]}>
      <Popup>⭐ {stop.stationName}</Popup>
    </Marker>
  );
})}

        <FitBounds route={route} />
      </MapContainer>
    </div>
  );
};

export default MapComponent;