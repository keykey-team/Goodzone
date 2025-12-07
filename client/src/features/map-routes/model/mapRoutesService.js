import { createRoute, deleteRoute, fetchRoutePath } from "../../../entities/route/api/routeApi";

export const createRouteFromDraw = async (pendingRouteCoords, data) => {
  const body = {
    name: data.name,
    fromPointId: data.fromPointId,
    toPointId: data.toPointId,
    coords: pendingRouteCoords,
  };

  const normalized = await createRoute(body);
  return normalized;
};

export const deleteRouteById = async (id) => {
  await deleteRoute(id);
};

export const getRouteVariants = async (fromId, toId) => {
  const data = await fetchRoutePath(fromId, toId);
  return data.variants || [];
};
