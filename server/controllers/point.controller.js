// controllers/point.controller.js
import { Point } from "../models/point.model.js";

// GET /api/goodzone/points
export async function getPoints(req, res) {
  try {
    const points = await Point.find().sort({ number: 1 });
    res.json(points);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get points" });
  }
}

// POST /api/goodzone/points
export async function createPoint(req, res) {
  try {
    const point = await Point.create(req.body);
    res.status(201).json(point);
  } catch (e) {
    console.error(e);
    res
      .status(400)
      .json({ error: "Failed to create point", details: e.message });
  }
}

// PUT /api/goodzone/points/:id
export async function updatePoint(req, res) {
  try {
    const { id } = req.params;

    const point = await Point.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!point) {
      return res.status(404).json({ error: "Point not found" });
    }

    res.json(point);
  } catch (e) {
    console.error(e);
    res
      .status(400)
      .json({ error: "Failed to update point", details: e.message });
  }
}

// DELETE /api/goodzone/points/:id
export async function deletePoint(req, res) {
  try {
    const { id } = req.params;

    const point = await Point.findByIdAndDelete(id);
    if (!point) {
      return res.status(404).json({ error: "Point not found" });
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res
      .status(400)
      .json({ error: "Failed to delete point", details: e.message });
  }
}
