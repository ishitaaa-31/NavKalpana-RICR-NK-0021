// src/routes/evRouter.js
import express from "express";
import {
  getEVStations,
  planEVTrip,
  getSoCCurve,
  getCoordinates,
} from "../controllers/evController.js";
import { getTimeBreakdown } from "../controllers/analyticsController.js";

import { advancedPlanTrip } from "../controllers/advancedController.js";

const router = express.Router();

// debug / helpers
router.get("/ev-stations", getEVStations);
router.get("/geocode", getCoordinates);

// base planning
router.post("/plan-trip", planEVTrip);
router.post("/soc-curve", getSoCCurve);

// ✅ advanced planning (Part 2)
router.post("/advanced/plan-trip", advancedPlanTrip);


router.post("/analytics/time-breakdown", getTimeBreakdown);

export default router;