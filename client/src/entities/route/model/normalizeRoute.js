export const normalizeRoute = (r) => ({
  ...r,
  id: r.id || r._id,
  fromPointId:
    typeof r.fromPointId === "object"
      ? r.fromPointId.id || r.fromPointId._id || String(r.fromPointId)
      : r.fromPointId,
  toPointId:
    typeof r.toPointId === "object"
      ? r.toPointId.id || r.toPointId._id || String(r.toPointId)
      : r.toPointId,
});