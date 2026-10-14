import mongoose from "mongoose";

const { Schema, model } = mongoose;

function parseNumberLabel(input) {
  const s = String(input ?? "").trim();
  // "12" или "12(1)"
  const m = s.match(/^(\d+)(?:\((\d+)\))?$/);
  if (!m) return null;

  const base = Number(m[1]);
  const dup = m[2] ? Number(m[2]) : 0;

  return {
    label: dup > 0 ? `${base}(${dup})` : String(base),
    base,
    dup,
  };
}

const PointSchema = new Schema(
  {
    // ✅ номер как строка: "12" или "12(1)"
    number: { type: String, required: true },

    // ✅ для сортировки и уникальности
    numberBase: { type: Number, required: true, index: true },
    numberDup: { type: Number, default: 0, index: true },

    name: { type: String, required: true },
    description: { type: String, default: "" },
    workingHours: { type: String, default: "" },
    locationText: { type: String, default: "" },
    type: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    link: { type: String, default: "" },

    coords: {
      type: [Number],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: "coords must be [y,x]",
      },
    },

    manualSearchingTags: { type: [String], default: [] },
  },
  { timestamps: true }
);

// ✅ уникальность: нельзя иметь два "12(1)" одновременно
PointSchema.index({ numberBase: 1, numberDup: 1 }, { unique: true });

/**
 * ✅ Документный хук (create/save)
 * Promise middleware: БЕЗ next(), просто throw при ошибке
 */
PointSchema.pre("validate", function () {
  const parsed = parseNumberLabel(this.number);
  if (!parsed) {
    throw new Error('Invalid number format. Use "12" or "12(1)".');
  }

  this.number = parsed.label;
  this.numberBase = parsed.base;
  this.numberDup = parsed.dup;
});

/**
 * ✅ Нормализация номера для UPDATE-запросов (PUT через findByIdAndUpdate и т.п.)
 * Тоже promise middleware: без next()
 */
function normalizeNumberInUpdate() {
  const update = this.getUpdate() || {};
  const $set = update.$set || {};

  const incomingNumber = $set.number ?? update.number;

  // если number не меняют — ничего не делаем
  if (incomingNumber == null) return;

  const parsed = parseNumberLabel(incomingNumber);
  if (!parsed) {
    throw new Error('Invalid number format. Use "12" or "12(1)".');
  }

  update.$set = {
    ...$set,
    number: parsed.label,
    numberBase: parsed.base,
    numberDup: parsed.dup,
  };

  // убираем верхнеуровневое number, чтобы не конфликтовало с $set
  if (update.number != null) delete update.number;

  this.setUpdate(update);
}

// ✅ покрываем основные апдейты
PointSchema.pre("findOneAndUpdate", normalizeNumberInUpdate);
PointSchema.pre("updateOne", normalizeNumberInUpdate);
PointSchema.pre("updateMany", normalizeNumberInUpdate);

PointSchema.method("toJSON", function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj._id;
  delete obj.__v;
  return obj;
});

export const Point = model("Point", PointSchema);