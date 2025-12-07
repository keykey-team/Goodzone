// config/db.js
import mongoose from "mongoose";

const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://goodzonemap:uJUHYZrld2ziF6Yx@cluster0.n8ca2ib.mongodb.net/goodzone?retryWrites=true&w=majority";

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("[Mongo] connected");
  } catch (err) {
    console.error("[Mongo] connection error:", err);
    process.exit(1);
  }
}
