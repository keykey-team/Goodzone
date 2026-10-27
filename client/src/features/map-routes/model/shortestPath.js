// Поиск кратчайшего пути по графу проходимости (Дейкстра с двоичной кучей)
// и подбор непохожих альтернативных вариантов.
//
// Вес ребра — его длина в пикселях карты, поэтому «Найкоротший» вариант
// действительно кратчайший по нарисованным дорожкам, а не первый найденный.

import {
  MAX_ROUTE_VARIANTS,
  ALTERNATIVE_EDGE_PENALTY,
  ALTERNATIVE_MAX_LENGTH_RATIO,
  ALTERNATIVE_MAX_OVERLAP,
} from "../config/routeGraph.config";

function edgeKeyOf(nodeIdA, nodeIdB) {
  return nodeIdA < nodeIdB ? `${nodeIdA}|${nodeIdB}` : `${nodeIdB}|${nodeIdA}`;
}

// Двоичная мин-куча элементов [costPx, nodeId].
function heapPush(heap, item) {
  heap.push(item);
  let child = heap.length - 1;
  while (child > 0) {
    const parent = (child - 1) >> 1;
    if (heap[parent][0] <= heap[child][0]) break;
    [heap[parent], heap[child]] = [heap[child], heap[parent]];
    child = parent;
  }
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length) {
    heap[0] = last;
    let parent = 0;
    for (;;) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let smallest = parent;
      if (left < heap.length && heap[left][0] < heap[smallest][0]) smallest = left;
      if (right < heap.length && heap[right][0] < heap[smallest][0]) smallest = right;
      if (smallest === parent) break;
      [heap[parent], heap[smallest]] = [heap[smallest], heap[parent]];
      parent = smallest;
    }
  }
  return top;
}

/**
 * Дейкстра от startNodeId до targetNodeId.
 * penalizedEdgeKeys — рёбра, подорожавшие в ALTERNATIVE_EDGE_PENALTY раз
 * (используется при поиске альтернатив); длина пути считается без штрафов.
 */
function runDijkstra(graph, startNodeId, targetNodeId, penalizedEdgeKeys = null) {
  const { adjacency } = graph;
  if (!adjacency.has(startNodeId) || !adjacency.has(targetNodeId)) return null;

  const bestCostPx = new Map([[startNodeId, 0]]);
  const arrivedBy = new Map(); // nodeId -> { from, edge }
  const settled = new Set();
  const heap = [[0, startNodeId]];

  while (heap.length) {
    const [costPx, nodeId] = heapPop(heap);
    if (settled.has(nodeId)) continue;
    settled.add(nodeId);
    if (nodeId === targetNodeId) break;

    for (const edge of adjacency.get(nodeId) || []) {
      if (settled.has(edge.to)) continue;
      const isPenalized = penalizedEdgeKeys && penalizedEdgeKeys.has(edgeKeyOf(nodeId, edge.to));
      const stepCostPx = edge.weightPx * (isPenalized ? ALTERNATIVE_EDGE_PENALTY : 1);
      const nextCostPx = costPx + stepCostPx;
      const knownCostPx = bestCostPx.has(edge.to) ? bestCostPx.get(edge.to) : Infinity;
      if (nextCostPx < knownCostPx) {
        bestCostPx.set(edge.to, nextCostPx);
        arrivedBy.set(edge.to, { from: nodeId, edge });
        heapPush(heap, [nextCostPx, edge.to]);
      }
    }
  }

  if (!settled.has(targetNodeId)) return null;

  const nodePath = [targetNodeId];
  const edges = [];
  let cursor = targetNodeId;
  while (cursor !== startNodeId) {
    const step = arrivedBy.get(cursor);
    edges.push({ from: step.from, to: cursor, routeId: step.edge.routeId, weightPx: step.edge.weightPx });
    cursor = step.from;
    nodePath.push(cursor);
  }
  nodePath.reverse();
  edges.reverse();

  const lengthPx = edges.reduce((sum, edge) => sum + edge.weightPx, 0);
  return { nodePath, edges, lengthPx };
}

function toVariant(graph, path, index) {
  const coords = [];
  const pointIds = [];
  for (const nodeId of path.nodePath) {
    const node = graph.nodeById.get(nodeId);
    const lastCoord = coords[coords.length - 1];
    if (!lastCoord || lastCoord[0] !== node.coord[0] || lastCoord[1] !== node.coord[1]) {
      coords.push(node.coord);
    }
    if (node.pointId) pointIds.push(node.pointId);
  }

  const routeIds = [];
  for (const edge of path.edges) {
    if (edge.routeId && !routeIds.includes(edge.routeId)) routeIds.push(edge.routeId);
  }

  return {
    type: index === 0 ? "shortest" : "alternative",
    isShortest: index === 0,
    pointIds,
    routeIds,
    coords,
    length: path.lengthPx,
  };
}

/**
 * Кратчайший путь между двумя точками-объектами плюс до двух непохожих
 * альтернатив. Возвращает массив вариантов в формате, который ждут
 * RouteChoiceModal и ActiveRoutePolyline; пустой массив — пути нет.
 */
export function findRouteVariants(graph, fromPointId, toPointId) {
  const startNodeId = graph.pointNodeIds.get(String(fromPointId));
  const targetNodeId = graph.pointNodeIds.get(String(toPointId));
  if (!startNodeId || !targetNodeId) return [];

  const shortest = runDijkstra(graph, startNodeId, targetNodeId);
  if (!shortest) return [];

  const foundPaths = [shortest];
  const penalizedEdgeKeys = new Set(shortest.edges.map((edge) => edgeKeyOf(edge.from, edge.to)));

  while (foundPaths.length < MAX_ROUTE_VARIANTS) {
    const alternative = runDijkstra(graph, startNodeId, targetNodeId, penalizedEdgeKeys);
    if (!alternative) break;

    const overlapCount = alternative.edges.filter((edge) =>
      penalizedEdgeKeys.has(edgeKeyOf(edge.from, edge.to))
    ).length;
    const overlapShare = overlapCount / alternative.edges.length;
    const isTooLong = alternative.lengthPx > shortest.lengthPx * ALTERNATIVE_MAX_LENGTH_RATIO;
    // Штрафы больше не меняются, поэтому следующая итерация вернула бы тот же
    // путь — выходим, как только альтернатива перестала быть интересной.
    if (overlapShare > ALTERNATIVE_MAX_OVERLAP || isTooLong) break;

    foundPaths.push(alternative);
    alternative.edges.forEach((edge) => penalizedEdgeKeys.add(edgeKeyOf(edge.from, edge.to)));
  }

  return foundPaths.map((path, index) => toVariant(graph, path, index));
}
