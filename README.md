# VoltPath — EV Route & Charging Planner with Energy Intelligence

## Team: SyntaxSquad

* **Ishita Bajpai (Team Lead)** — Database schema design, backend architecture, API orchestration, charging optimization logic, debugging & integration validation
* **Raksha Pandey** — Frontend engineering, UI/UX design, simulation visualization, optimization algorithm implementation, testing & debugging, technical documentation
* **Ayushi Parmar** — Backend logic development, API orchestration,, controller implementation, data consistency validation & debugging

---

## Overview

VoltPath is a deterministic EV journey intelligence system that predicts whether an electric vehicle can safely complete a trip and automatically plans optimal charging stops.

Unlike traditional navigation systems that only provide directions, VoltPath simulates battery consumption across the entire route and dynamically calculates charging requirements.

Simulation Pipeline:

```
Route → Segment → Simulate → Charge → Recalculate → Optimize → Visualize
```

The platform focuses on eliminating **range anxiety** by ensuring arrival with safe reserve battery while minimizing trip time and improving cost transparency.

---

## Problem Statement

EV users currently lack reliable tools that can:
Determine whether an electric vehicle can complete a journey before departure.
Suggest a realistic charging strategy.
Reflect changing energy consumption conditions.
Transparently estimate electricity cost.

VoltPath addresses this through a deterministic route‑energy simulation system that:
Simulates segment‑level battery usage across the entire route.
Places safe charging stops and guarantees arrival with reserve State of Charge.
Estimates charging duration and electricity cost.
Models real‑world variability including weather impact, traffic conditions, and battery degradation.
Predicts how external factors influence feasibility, travel time, and trip cost before the journey begins.

---

## Features Implemented

### Core Route & Charging Optimization Engine

* Route distance calculation
* Segment‑level battery simulation (SoC tracking)
* Charging time estimation
* Trip electricity cost estimation
* Charging stop placement with safety guarantee
* Interactive map with charging markers
* State of Charge curve visualization
* Nearest safe charger optimization logic

### Multi‑Pass Charging Search Strategy

To guarantee a feasible route, VoltPath runs a 4‑stage fallback planning algorithm:

1. **Primary Search** — Finds charger within safe reachable distance (~25km grid search)
2. **Extended Radius Search** — Expands search radius when optimal station unavailable
3. **Last Stop Boost Retry** — Recalculates route by charging previous stop to 100%
4. **Synthetic Stop Fallback** — Inserts emergency stop using external dataset (PlugShare fallback)

This ensures a trip solution exists whenever physically possible.

### Analytics & Visualization

* SoC curve graph
* Energy vs driving time bar comparison
* Energy per segment pie chart
* Charging vs driving time breakdown

---

## Advanced Simulation

* Weather impact multiplier
* Traffic congestion energy adjustment
* Battery degradation estimation
* Sensitivity simulation endpoints

---

## Tech Stack

### Frontend

* React.js
* Leaflet + OpenStreetMap
* Recharts (graph visualizations)
* Browser Speech Synthesis API

### Backend

* Node.js
* Express.js
* RESTful simulation controllers

### Database

* MongoDB (trip and station caching)

### APIs Used

* OpenChargeMap API (charging station data)
* Geocoding API (coordinates conversion)

### Deployment

* Frontend: Vercel
* Backend: Render
* Database: MongoDB Atlas

---

## API Endpoints

### Utility

| Method | Endpoint     | Description                    |
| ------ | ------------ | ------------------------------ |
| GET    | /ev-stations | Fetch nearby charging stations |
| GET    | /geocode     | Convert address to coordinates |

### Core Planning

| Method | Endpoint   | Description                   |
| ------ | ---------- | ----------------------------- |
| POST   | /plan-trip | Generate optimized EV route   |
| POST   | /soc-curve | Generate SoC simulation curve |

### Advanced Simulation

| Method | Endpoint                     | Description                        |
| ------ | -------------------------    | ---------------------------------- |
| POST   | /advanced/plan-trip          | Weather & traffic aware simulation |
| POST   | /analytics/time-breakdown    | Driving vs charging analysis       |
| POST   | /analytics/energy-per-segment| Calculates Energy Per Segment       |

---

## Installation & Setup

### Prerequisites

* Node.js
* MongoDB Atlas account
* OpenChargeMap API key

### Environment Variables

Create `.env` in backend root:

```
MONGO_URI=your_mongodb_connection_string
OPENCHARGE_API_KEY=your_api_key
```

### Backend Setup

```
cd server
npm install
npm install -D nodemon
npm run dev
```

### Frontend Setup

```
cd client
npm install
npm run dev
```

---

## Screenshots (Add Later)

* Home Page
* Route Result Page
* SoC Curve Graph
* Energy Analytics Dashboard

---

## Performance Notes

* Planning accuracy within realistic EV usage range
* Slightly slower response due to multiple external API calls for optimization passes
* Deterministic simulation prioritizes correctness over raw speed

---

## Real‑World Impact

EV adoption is rapidly increasing, but infrastructure awareness remains limited. VoltPath helps users:

* Travel confidently over long distances
* Understand charging strategy before departure
* Estimate real trip cost
* Reduce inefficient charging patterns

This contributes to sustainable mobility adoption and practical EV usability.

---

## Future Improvements

* Station reliability scoring
* Live charger availability
* Elevation‑aware energy model
* ML‑based consumption prediction
* Offline caching for faster computation
* Fleet dashboard & analytics

---

## Conclusion

VoltPath is not a navigation app — it is an EV energy simulation system that determines whether a journey is physically feasible and provides a safe, optimized charging strategy before the trip even begins.
