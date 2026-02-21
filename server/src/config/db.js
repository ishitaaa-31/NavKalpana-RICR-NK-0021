import mongoose from "mongoose";
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected at", conn.connection.host);
    console.log("Database name", conn.connection.name);
  } catch (error) {
    console.log(error);
    process.exit.apply(1);
  }
};
export default connectDB;
