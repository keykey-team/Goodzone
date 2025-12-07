import { createPoint, updatePoint, deletePoint } from "../../../entities/point/api/pointApi";

export const getNextPointNumber = (points) =>
  points.reduce((max, p) => Math.max(max, p.number || 0), 0) + 1;

export const addPointOnMap = async (latlng, points) => {
  const nextNumber = getNextPointNumber(points);

  const body = {
    number: nextNumber,
    name: `Об'єкт ${nextNumber}`,
    description: "",
    workingHours: "",
    locationText: "",
    type: "",
    imageUrl: "",
    coords: [latlng.lat, latlng.lng],
  };

  const saved = await createPoint(body);
  return saved;
};

// сдвинуть точку (возвращает обновлённую точку)
export const movePointOnMap = async (point, coords) => {
  const updated = await updatePoint(point.id, { ...point, coords });
  return updated;
};

// удалить точку (только API — без стейта)
export const deletePointOnMap = async (id) => {
  await deletePoint(id);
};
