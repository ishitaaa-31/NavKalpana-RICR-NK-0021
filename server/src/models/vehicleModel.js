import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    batteryCapacity: {
      type: Number, // kWh
      required: true,
    },

    efficiency: {
      type: Number, // km per kWh
      required: true,
    },

    usablePercentage: {
      type: Number,
      default: 90,
    },

    reservePercentage: {
      type: Number,
      default: 15,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Vehicle", vehicleSchema);