// server/models/point.model.js
import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PointSchema = new Schema(
  {
    number: { type: Number, required: true, unique: true }, // № объекта
    name: { type: String, required: true },
    description: { type: String, default: "" },
    workingHours: { type: String, default: "" },
    locationText: { type: String, default: "" }, // где находится на территории
    type: { type: String, default: "" }, // коттедж / СПА / бассейн...
    imageUrl: { type: String, default: "" },
    coords: {
      type: [Number], // [y,x] в CRS.Simple
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: "coords must be [lat,lng]",
      },
    },
  },
  { timestamps: true }
);

PointSchema.method("toJSON", function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
});

export const Point = model("Point", PointSchema);
