// server.js
import "dotenv/config"; // если используешь .env
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`API http://192.168.1.126:${PORT}`);
  });
}

start();
