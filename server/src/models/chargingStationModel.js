import mongoose from "mongoose";

const chargingStationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    location: {
      lat: Number,
      lng: Number,
    },

    powerOutput: {
      type: String, // "50kW"
    },

    status: {
      type: String,
      enum: ["available", "busy"],
      default: "available",
    },
  },
  { timestamps: true }
);

export default mongoose.model("ChargingStation", chargingStationSchema);