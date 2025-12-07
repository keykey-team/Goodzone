// server.js
import "dotenv/config"; // если используешь .env
import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
  });
}

start();
