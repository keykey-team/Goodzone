// app.js
import express from "express";
import cors from "cors";

import pointRoutes from "./routes/point.routes.js";
import routeRoutes from "./routes/route.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// Роуты
app.use("/api/points", pointRoutes);
app.use("/api/routes", routeRoutes);

export default app;
