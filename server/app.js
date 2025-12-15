// app.js
import express from "express";
import cors from "cors";
import path from "path";

import uploadRoutes from "./routes/uploadRoutes.js";
import pointRoutes from "./routes/point.routes.js";
import routeRoutes from "./routes/route.routes.js";
import authRoutes from "./routes/authRoutes.js";

import { requireAdmin } from "./middleware/requireAdmin.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

// Роуты
app.use("/api/goodzone/points", pointRoutes);
app.use("/api/goodzone/routes", routeRoutes);
app.use("/api/goodzone/upload", uploadRoutes);
app.use("/api/goodzone/auth", authRoutes);

export default app;