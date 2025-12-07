// routes/point.routes.js
import { Router } from "express";
import {
  getPoints,
  createPoint,
  updatePoint,
  deletePoint,
} from "../controllers/point.controller.js";

const router = Router();

router.get("/", getPoints);
router.post("/", createPoint);
router.put("/:id", updatePoint);
router.delete("/:id", deletePoint);

export default router;
