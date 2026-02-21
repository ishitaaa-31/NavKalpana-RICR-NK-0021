import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    startLocation: {
      type: String,
      required: true,
    },

    destination: {
      type: String,
      required: true,
    },

    distance: {
      type: Number, // km
    },

    duration: {
      type: String,
    },

    batteryUsed: {
      type: Number,
    },

    chargingStops: {
      type: Number,
    },

    routePolyline: {
      type: String, // for map drawing later
    },
  },
  { timestamps: true }
);

export default mongoose.model("Route", routeSchema);