import express from "express";
import { getEVStations } from "../controllers/evController.js";
import { planEVTrip } from "../controllers/evController.js";

const router = express.Router();

router.get("/ev-stations", getEVStations);
router.post("/plan-trip", planEVTrip);

export default router;

