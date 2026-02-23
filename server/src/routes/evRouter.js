import express from "express";
import { getEVStations } from "../controllers/evController.js";

const router = express.Router();

router.get("/ev-stations", getEVStations);

export default router;