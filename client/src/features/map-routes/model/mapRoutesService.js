import { createRoute, deleteRoute } from "../../../entities/route/api/routeApi";
import { buildRouteGraph } from "./routeGraph";
import { findRouteVariants } from "./shortestPath";

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

// Сетка перестраивается только при смене массивов точек/маршрутов
// (после загрузки или правок в админке), а не на каждый клик «Прокласти маршрут».
let cachedGraph = null;
let cachedGraphSources = { points: null, routes: null };

/**
 * Варианты маршрута между двумя точками-объектами.
 *
 * Строит из всех нарисованных линий граф проходимости (вершины линий,
 * перекрёстки, сварка близких узлов — см. routeGraph.js) и ищет по нему
 * кратчайший путь Дейкстрой плюс непохожие альтернативы (shortestPath.js).
 * Первый вариант в массиве — действительно кратчайший по длине в пикселях.
 */
export const getRouteVariants = (fromPointId, toPointId, { points = [], routes = [] } = {}) => {
  if (!fromPointId || !toPointId || fromPointId === toPointId) return [];

  if (cachedGraphSources.points !== points || cachedGraphSources.routes !== routes) {
    cachedGraph = buildRouteGraph(points, routes);
    cachedGraphSources = { points, routes };
  }
  return findRouteVariants(cachedGraph, fromPointId, toPointId);
};
