// models/route.model.js
import mongoose from "mongoose";

const { Schema, model, Types } = mongoose;

const RouteSchema = new Schema(
  {
    name: { type: String, required: true },
    fromPointId: { type: Types.ObjectId, ref: "Point", required: true },
    toPointId: { type: Types.ObjectId, ref: "Point", required: true },
    coords: {
      type: [
        {
          type: [Number], // [lat, lng]
          validate: {
            validator: (v) => Array.isArray(v) && v.length === 2,
            message: "coords element must be [lat, lng]",
          },
        },
      ],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 1,
        message: "coords must contain at least 2 points",
      },
    },
  },
  { timestamps: true }
);

export const Route = model("Route", RouteSchema);
