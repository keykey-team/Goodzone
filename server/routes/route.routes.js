// routes/route.routes.js
import { Router } from "express";
import {
  getRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  getRoutePath,
} from "../controllers/route.controller.js";

const router = Router();

// /api/routes
router.get("/", getRoutes);
router.post("/", createRoute);
router.put("/:id", updateRoute);
router.delete("/:id", deleteRoute);

// /api/routes/path?fromId=...&toId=...
router.get("/path", getRoutePath);

export default router;
