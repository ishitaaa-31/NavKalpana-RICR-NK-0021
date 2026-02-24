import express from "express";
import { getEVStations } from "../controllers/evController.js";
import { planEVTrip , getSoCCurve } from "../controllers/evController.js";
import { getCoordinates } from "../controllers/evController.js";

const router = express.Router();

router.get("/ev-stations", getEVStations);
router.post("/plan-trip", planEVTrip);
router.post("/soc-curve", getSoCCurve);
router.get("/geocode", getCoordinates);

export default router;

