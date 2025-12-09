import { createRoute, deleteRoute } from "../../../entities/route/api/routeApi";

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

/* ======================= утилиты ======================= */

function routeLength(route) {
  if (!Array.isArray(route.coords) || route.coords.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < route.coords.length; i++) {
    const [x1, y1] = route.coords[i - 1];
    const [x2, y2] = route.coords[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/**
 * НЕориентированный маршрут → две ориентированные дуги:
 * from -> to (reversed: false)
 * to   -> from (reversed: true)
 */
function buildGraph(allRoutes = []) {
  const graph = {};

  for (const r of allRoutes) {
    const from = r.fromPointId;
    const to = r.toPointId;
    if (!from || !to) continue;

    if (!graph[from]) graph[from] = [];
    if (!graph[to]) graph[to] = [];

    // прямое направление
    graph[from].push({ next: to, route: r, reversed: false });
    // обратное направление
    graph[to].push({ next: from, route: r, reversed: true });
  }

  return graph;
}

function findAllPaths(graph, fromId, toId, options = {}) {
  const {
    maxDepth = 10,
    maxVariants = 200,
  } = options;

  const variants = [];

  // edgesPath: [{ route, reversed }, ...]
  function dfs(currentId, targetId, visited, pointIds, edgesPath) {
    if (variants.length >= maxVariants) return;
    if (pointIds.length > maxDepth) return;

    if (currentId === targetId && edgesPath.length > 0) {
      variants.push({
        pointIds: [...pointIds],
        edges: [...edgesPath],
      });
      return;
    }

    const edges = graph[currentId] || [];
    for (const edge of edges) {
      const { next } = edge;
      if (visited.has(next)) continue;

      visited.add(next);
      pointIds.push(next);
      edgesPath.push(edge);

      dfs(next, targetId, visited, pointIds, edgesPath);

      edgesPath.pop();
      pointIds.pop();
      visited.delete(next);
    }
  }

  const visited = new Set([fromId]);
  dfs(fromId, toId, visited, [fromId], []);

  return variants;
}

function buildVariantObjects(pathVariants) {
  return pathVariants.map((v) => {
    const pointIds = v.pointIds;
    const routeIds = v.edges.map((e) => e.route.id || e.route._id);

    const coords = [];
    v.edges.forEach((edge, edgeIndex) => {
      const r = edge.route;
      if (!Array.isArray(r.coords) || r.coords.length === 0) return;

      // координаты в нужном направлении
      const segCoords = edge.reversed
        ? [...r.coords].slice().reverse()
        : r.coords;

      segCoords.forEach((c, i) => {
        // убираем дублирующую точку на стыке сегментов
        if (edgeIndex > 0 && i === 0) return;
        coords.push(c);
      });
    });

    const lengthByCoords = v.edges.reduce(
      (sum, e) => sum + routeLength(e.route),
      0
    );

    return {
      type: "alternative",
      isShortest: false,
      pointIds,
      routeIds,
      coords,
      length: lengthByCoords || v.edges.length,
    };
  });
}

/* ======================= публичная функция ======================= */

export const getRouteVariants = async (
  fromId,
  toId,
  allRoutes = [],
  options = {}
) => {
  if (!fromId || !toId || fromId === toId) return [];

  const graph = buildGraph(allRoutes);
  const pathVariants = findAllPaths(graph, fromId, toId, options);
  if (!pathVariants.length) return [];

  let variants = buildVariantObjects(pathVariants);

  variants.sort((a, b) => a.length - b.length);

  variants = variants.map((v, idx) => ({
    ...v,
    type: idx === 0 ? "shortest" : "alternative",
    isShortest: idx === 0,
  }));

  return variants;
};
