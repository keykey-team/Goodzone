// controllers/point.controller.js
import { Point } from "../models/point.model.js";

// GET /api/goodzone/points
export async function getPoints(req, res) {
  try {
    const points = await Point.find().sort({ numberBase: 1, numberDup: 1 });
    res.json(points);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get points" });
  }
}

// POST /api/goodzone/points
export async function createPoint(req, res) {
  const MAX_RETRIES = 5;

  try {
    const {
      name = "",
      description = "",
      workingHours = "",
      locationText = "",
      type = "",
      imageUrl = "",
      coords = null,
    } = req.body || {};

    if (
      !Array.isArray(coords) ||
      coords.length !== 2 ||
      typeof coords[0] !== "number" ||
      Number.isNaN(coords[0]) ||
      typeof coords[1] !== "number" ||
      Number.isNaN(coords[1])
    ) {
      return res.status(400).json({
        error: "Failed to create point",
        details: "Invalid coords. Expected [lat, lng]",
      });
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const lastPoint = await Point.findOne({})
          .sort({ numberBase: -1, numberDup: -1 })
          .select("number numberBase")
          .lean();

        const nextNumberBase =
          typeof lastPoint?.numberBase === "number"
            ? lastPoint.numberBase + 1
            : 1;

        const point = await Point.create({
          name,
          description,
          workingHours,
          locationText,
          type,
          imageUrl,
          coords,
          number: String(nextNumberBase), // <-- ВАЖНО
        });

        return res.status(201).json(point);
      } catch (e) {
        const isDuplicate =
          e?.code === 11000 &&
          e?.keyPattern?.numberBase === 1 &&
          e?.keyPattern?.numberDup === 1;

        if (!isDuplicate) {
          throw e;
        }

        if (attempt === MAX_RETRIES - 1) {
          throw new Error(
            "Could not generate unique point number after several attempts"
          );
        }
      }
    }
  } catch (e) {
    console.error(e);
    return res.status(400).json({
      error: "Failed to create point",
      details: e.message,
    });
  }
}

// PUT /api/goodzone/points/:id
export async function updatePoint(req, res) {
  try {
    console.log(req.params)
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
