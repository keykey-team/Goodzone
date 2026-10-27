// Построение графа проходимости («сетки») из линий, нарисованных админом.
//
// Старый граф знал только точки-объекты: перейти с одной линии на другую
// можно было лишь в точке, поэтому «кратчайший по графу» не совпадал с
// кратчайшим по карте. Здесь узлами сетки становятся:
//   - каждая вершина каждой полилинии;
//   - геометрические пересечения линий (крестовые перекрёстки);
//   - проекции концов линий на чужие линии рядом (Т-образные перекрёстки).
// Близкие вершины свариваются в один узел, а точка-объект соединяется
// коротким «подходом» с ближайшим концом каждой своей линии. Ориентация
// линии определяется по геометрии, а не по полям fromPointId/toPointId,
// поэтому линия, нарисованная «задом наперёд», не даёт зигзагов.
//
// Координаты всюду — [lat, lng] Leaflet CRS.Simple, то есть [y, x] в пикселях.

import {
  NODE_WELD_RADIUS_PX,
  JUNCTION_SNAP_RADIUS_PX,
  POINT_ATTACH_RADIUS_PX,
  MESH_STITCH_RADIUS_PX,
  SEGMENT_INDEX_CELL_PX,
} from "../config/routeGraph.config";

function distanceBetween(coordA, coordB) {
  const deltaY = coordA[0] - coordB[0];
  const deltaX = coordA[1] - coordB[1];
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

// Пересечение отрезков A и B. Возвращает { coord, tOnFirst, tOnSecond } либо null.
function intersectSegments(aStart, aEnd, bStart, bEnd) {
  const aDeltaY = aEnd[0] - aStart[0];
  const aDeltaX = aEnd[1] - aStart[1];
  const bDeltaY = bEnd[0] - bStart[0];
  const bDeltaX = bEnd[1] - bStart[1];

  const denominator = aDeltaX * bDeltaY - aDeltaY * bDeltaX;
  if (Math.abs(denominator) < 1e-9) return null; // параллельные отрезки

  const startsDeltaY = bStart[0] - aStart[0];
  const startsDeltaX = bStart[1] - aStart[1];

  const tOnFirst = (startsDeltaX * bDeltaY - startsDeltaY * bDeltaX) / denominator;
  const tOnSecond = (startsDeltaX * aDeltaY - startsDeltaY * aDeltaX) / denominator;

  if (tOnFirst < 0 || tOnFirst > 1 || tOnSecond < 0 || tOnSecond > 1) return null;

  return {
    coord: [aStart[0] + aDeltaY * tOnFirst, aStart[1] + aDeltaX * tOnFirst],
    tOnFirst,
    tOnSecond,
  };
}

// Проекция точки на отрезок. Возвращает null, если проекция попадает в вершину
// отрезка — такие случаи закрывает сварка узлов.
function projectOntoSegment(coord, segStart, segEnd) {
  const segDeltaY = segEnd[0] - segStart[0];
  const segDeltaX = segEnd[1] - segStart[1];
  const segLengthSq = segDeltaY * segDeltaY + segDeltaX * segDeltaX;
  if (segLengthSq === 0) return null;

  const t =
    ((coord[0] - segStart[0]) * segDeltaY + (coord[1] - segStart[1]) * segDeltaX) /
    segLengthSq;
  if (t <= 0 || t >= 1) return null;

  const projected = [segStart[0] + segDeltaY * t, segStart[1] + segDeltaX * t];
  return { coord: projected, t, distance: distanceBetween(coord, projected) };
}

// Точка дальше radiusPx от прямоугольника-габарита отрезка: проекцию можно
// не считать — она заведомо дальше. Дешёвая отбраковка кандидатов.
function isOutsideSegmentBox(coord, segment, radiusPx) {
  return (
    coord[0] < Math.min(segment.start[0], segment.end[0]) - radiusPx ||
    coord[0] > Math.max(segment.start[0], segment.end[0]) + radiusPx ||
    coord[1] < Math.min(segment.start[1], segment.end[1]) - radiusPx ||
    coord[1] > Math.max(segment.start[1], segment.end[1]) + radiusPx
  );
}

// То же, но с прижатием к концам отрезка: для привязки маркеров годится
// и ближайшая вершина, не только внутренняя проекция.
function projectOntoSegmentClamped(coord, segStart, segEnd) {
  const inner = projectOntoSegment(coord, segStart, segEnd);
  if (inner) return inner;
  const toStart = distanceBetween(coord, segStart);
  const toEnd = distanceBetween(coord, segEnd);
  return toStart <= toEnd
    ? { coord: segStart, t: 0, distance: toStart }
    : { coord: segEnd, t: 1, distance: toEnd };
}

/**
 * Строит граф проходимости.
 *
 * @returns {{
 *   nodeById: Map<string, {id: string, coord: [number, number], pointId: string|null}>,
 *   adjacency: Map<string, Array<{to: string, weightPx: number, routeId: string|null, isApproach: boolean}>>,
 *   pointNodeIds: Map<string, string>,
 * }}
 */
export function buildRouteGraph(points = [], routes = []) {
  const polylines = routes
    .filter((route) => Array.isArray(route.coords) && route.coords.length >= 2)
    .map((route) => ({
      routeId: String(route.id || route._id),
      fromPointId: route.fromPointId ? String(route.fromPointId) : null,
      toPointId: route.toPointId ? String(route.toPointId) : null,
      coords: route.coords.map((coord) => [Number(coord[0]), Number(coord[1])]),
    }));

  // --- 1. Готовим вставки новых вершин: pendingInserts[линия][отрезок] = [{t, coord}] ---
  const pendingInserts = polylines.map((line) =>
    line.coords.slice(0, -1).map(() => [])
  );

  // Пространственный индекс отрезков: без него поиск пересечений квадратичен
  // по числу отрезков и на сотнях маршрутов занимает секунды.
  const CELL_SIZE_PX = SEGMENT_INDEX_CELL_PX;
  const segments = [];
  const segmentGrid = new Map(); // "ячейкаY:ячейкаX" -> [индексы segments]
  polylines.forEach((line, lineIndex) => {
    for (let seg = 0; seg < line.coords.length - 1; seg++) {
      const start = line.coords[seg];
      const end = line.coords[seg + 1];
      const segmentIndex = segments.length;
      segments.push({ lineIndex, segIndex: seg, start, end });
      const cellYFrom = Math.floor(Math.min(start[0], end[0]) / CELL_SIZE_PX);
      const cellYTo = Math.floor(Math.max(start[0], end[0]) / CELL_SIZE_PX);
      const cellXFrom = Math.floor(Math.min(start[1], end[1]) / CELL_SIZE_PX);
      const cellXTo = Math.floor(Math.max(start[1], end[1]) / CELL_SIZE_PX);
      for (let cellY = cellYFrom; cellY <= cellYTo; cellY++) {
        for (let cellX = cellXFrom; cellX <= cellXTo; cellX++) {
          const cellKey = `${cellY}:${cellX}`;
          if (!segmentGrid.has(cellKey)) segmentGrid.set(cellKey, []);
          segmentGrid.get(cellKey).push(segmentIndex);
        }
      }
    }
  });

  // Крестовые перекрёстки: пересечения отрезков разных линий (кандидаты — из общей ячейки).
  const testedPairs = new Set();
  for (const bucket of segmentGrid.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const segA = segments[bucket[i]];
        const segB = segments[bucket[j]];
        if (segA.lineIndex === segB.lineIndex) continue;
        const pairKey = bucket[i] < bucket[j] ? `${bucket[i]}|${bucket[j]}` : `${bucket[j]}|${bucket[i]}`;
        if (testedPairs.has(pairKey)) continue;
        testedPairs.add(pairKey);
        const crossing = intersectSegments(segA.start, segA.end, segB.start, segB.end);
        if (!crossing) continue;
        pendingInserts[segA.lineIndex][segA.segIndex].push({ t: crossing.tOnFirst, coord: crossing.coord });
        pendingInserts[segB.lineIndex][segB.segIndex].push({ t: crossing.tOnSecond, coord: crossing.coord });
      }
    }
  }

  // Т-образные перекрёстки и стыки «конец к концу»: конец линии «не дотянут»
  // до чужой линии. Для КАЖДОЙ чужой линии в радиусе ищем её ближайшую точку
  // (середину отрезка или вершину) и запоминаем явную связь — после сварки она
  // станет ребром. Одной ближайшей линии мало: если рядом лежит линия-дубль
  // (нарисованная внахлёст), конец свяжется только с ней, а настоящий стык
  // пропадёт.
  const endLinks = []; // { endCoord, targetCoord }
  const junctionSearchCells = Math.ceil(JUNCTION_SNAP_RADIUS_PX / CELL_SIZE_PX);
  polylines.forEach((line, lineIndex) => {
    const lineEnds = [line.coords[0], line.coords[line.coords.length - 1]];
    for (const endCoord of lineEnds) {
      const nearestByLine = new Map(); // lineIndex -> ближайшая проекция на эту линию
      const cellY = Math.floor(endCoord[0] / CELL_SIZE_PX);
      const cellX = Math.floor(endCoord[1] / CELL_SIZE_PX);
      const checkedSegments = new Set();
      for (let offsetY = -junctionSearchCells; offsetY <= junctionSearchCells; offsetY++) {
        for (let offsetX = -junctionSearchCells; offsetX <= junctionSearchCells; offsetX++) {
          const bucket = segmentGrid.get(`${cellY + offsetY}:${cellX + offsetX}`);
          if (!bucket) continue;
          for (const segmentIndex of bucket) {
            if (checkedSegments.has(segmentIndex)) continue;
            checkedSegments.add(segmentIndex);
            const candidate = segments[segmentIndex];
            if (candidate.lineIndex === lineIndex) continue;
            if (isOutsideSegmentBox(endCoord, candidate, JUNCTION_SNAP_RADIUS_PX)) continue;
            const projection = projectOntoSegmentClamped(endCoord, candidate.start, candidate.end);
            if (projection.distance > JUNCTION_SNAP_RADIUS_PX) continue;
            const known = nearestByLine.get(candidate.lineIndex);
            if (!known || projection.distance < known.distance) {
              nearestByLine.set(candidate.lineIndex, { ...projection, segIndex: candidate.segIndex });
            }
          }
        }
      }
      for (const [targetLineIndex, projection] of nearestByLine) {
        if (projection.t > 0 && projection.t < 1) {
          pendingInserts[targetLineIndex][projection.segIndex].push({ t: projection.t, coord: projection.coord });
        }
        endLinks.push({ endCoord, targetCoord: projection.coord });
      }
    }
  });

  // --- 1.5. Привязка маркеров точек к ближайшей линии ---
  // Маркер соединяется «подходом» с проекцией на ближайший отрезок любой линии
  // в радиусе POINT_ATTACH_RADIUS_PX. Поля fromPointId/toPointId для привязки
  // больше не нужны — только геометрия, поэтому сетку можно рисовать свободно.
  const pointAttachments = []; // { pointId, pointCoord, attachCoord }
  const attachSearchCells = Math.ceil(POINT_ATTACH_RADIUS_PX / CELL_SIZE_PX) + 1;
  for (const point of points) {
    if (!Array.isArray(point.coords) || point.coords.length !== 2) continue;
    const pointCoord = [Number(point.coords[0]), Number(point.coords[1])];
    const cellY = Math.floor(pointCoord[0] / CELL_SIZE_PX);
    const cellX = Math.floor(pointCoord[1] / CELL_SIZE_PX);
    let nearest = null;
    const checkedSegments = new Set();
    for (let ring = 0; ring <= attachSearchCells; ring++) {
      // всё, что ближе уже найденного, лежит в пройденных кольцах — можно выходить
      if (nearest && nearest.distance < (ring - 1) * CELL_SIZE_PX) break;
      for (let offsetY = -ring; offsetY <= ring; offsetY++) {
        for (let offsetX = -ring; offsetX <= ring; offsetX++) {
          if (Math.max(Math.abs(offsetY), Math.abs(offsetX)) !== ring) continue;
          const bucket = segmentGrid.get(`${cellY + offsetY}:${cellX + offsetX}`);
          if (!bucket) continue;
          for (const segmentIndex of bucket) {
            if (checkedSegments.has(segmentIndex)) continue;
            checkedSegments.add(segmentIndex);
            const candidate = segments[segmentIndex];
            const projection = projectOntoSegmentClamped(pointCoord, candidate.start, candidate.end);
            if (projection.distance > POINT_ATTACH_RADIUS_PX) continue;
            if (!nearest || projection.distance < nearest.distance) {
              nearest = { ...projection, segmentIndex };
            }
          }
        }
      }
    }
    if (!nearest) continue; // точка слишком далеко от сетки — останется недостижимой
    const segment = segments[nearest.segmentIndex];
    if (nearest.t > 0 && nearest.t < 1) {
      pendingInserts[segment.lineIndex][segment.segIndex].push({ t: nearest.t, coord: nearest.coord });
    }
    pointAttachments.push({ pointId: String(point.id || point._id), pointCoord, attachCoord: nearest.coord });
  }

  // --- 2. Пересобираем полилинии с вставленными перекрёстками ---
  const densifiedPolylines = polylines.map((line, lineIndex) => {
    const coords = [];
    for (let seg = 0; seg < line.coords.length - 1; seg++) {
      coords.push(line.coords[seg]);
      const inserts = pendingInserts[lineIndex][seg].slice().sort((a, b) => a.t - b.t);
      for (const insert of inserts) coords.push(insert.coord);
    }
    coords.push(line.coords[line.coords.length - 1]);
    return { ...line, coords };
  });

  // --- 3. Сварка вершин в узлы (пространственная сетка для поиска соседей) ---
  const nodeById = new Map();
  const weldGrid = new Map(); // "ячейкаY:ячейкаX" -> [nodeId]
  let nodeCounter = 0;

  const findOrCreateNode = (coord) => {
    const cellY = Math.floor(coord[0] / NODE_WELD_RADIUS_PX);
    const cellX = Math.floor(coord[1] / NODE_WELD_RADIUS_PX);
    // именно ближайший узел, а не первый попавшийся: иначе соседние вершины
    // разъезжаются по разным узлам в зависимости от порядка линий
    let nearestNodeId = null;
    let nearestDistance = Infinity;
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      for (let offsetX = -1; offsetX <= 1; offsetX++) {
        const bucket = weldGrid.get(`${cellY + offsetY}:${cellX + offsetX}`);
        if (!bucket) continue;
        for (const nodeId of bucket) {
          const distance = distanceBetween(nodeById.get(nodeId).coord, coord);
          if (distance <= NODE_WELD_RADIUS_PX && distance < nearestDistance) {
            nearestNodeId = nodeId;
            nearestDistance = distance;
          }
        }
      }
    }
    if (nearestNodeId) return nearestNodeId;
    const nodeId = `n${nodeCounter++}`;
    nodeById.set(nodeId, { id: nodeId, coord, pointId: null });
    const cellKey = `${cellY}:${cellX}`;
    if (!weldGrid.has(cellKey)) weldGrid.set(cellKey, []);
    weldGrid.get(cellKey).push(nodeId);
    return nodeId;
  };

  const adjacency = new Map();
  const edgePairKeys = new Set();

  const addEdge = (nodeIdA, nodeIdB, routeId, isApproach = false) => {
    if (nodeIdA === nodeIdB) return;
    const pairKey = nodeIdA < nodeIdB ? `${nodeIdA}|${nodeIdB}` : `${nodeIdB}|${nodeIdA}`;
    if (edgePairKeys.has(pairKey)) return;
    edgePairKeys.add(pairKey);

    const weightPx = distanceBetween(nodeById.get(nodeIdA).coord, nodeById.get(nodeIdB).coord);
    if (!adjacency.has(nodeIdA)) adjacency.set(nodeIdA, []);
    if (!adjacency.has(nodeIdB)) adjacency.set(nodeIdB, []);
    adjacency.get(nodeIdA).push({ to: nodeIdB, weightPx, routeId, isApproach });
    adjacency.get(nodeIdB).push({ to: nodeIdA, weightPx, routeId, isApproach });
  };

  // --- 4. Рёбра коридоров ---
  // Сначала каждая уникальная координата получает свой узел, и только потом
  // строятся рёбра. Иначе одна и та же точка (общий конец двух линий) в разных
  // линиях сваривается в разные узлы — смотря что успело появиться рядом, — и
  // стык молча рвётся.
  const nodeIdByVertex = new Map(); // "lat,lng" -> nodeId
  const vertexKeyOf = (coord) => `${coord[0]},${coord[1]}`;
  for (const line of densifiedPolylines) {
    for (const coord of line.coords) {
      const vertexKey = vertexKeyOf(coord);
      if (!nodeIdByVertex.has(vertexKey)) nodeIdByVertex.set(vertexKey, findOrCreateNode(coord));
    }
  }
  const nodeIdOfVertex = (coord) => nodeIdByVertex.get(vertexKeyOf(coord)) || findOrCreateNode(coord);

  const polylineNodeIds = densifiedPolylines.map((line) => line.coords.map(nodeIdOfVertex));
  polylineNodeIds.forEach((nodeIds, lineIndex) => {
    for (let i = 1; i < nodeIds.length; i++) {
      addEdge(nodeIds[i - 1], nodeIds[i], densifiedPolylines[lineIndex].routeId);
    }
  });

  // Явные рёбра стыков из шага 1: конец линии -> ближайшая точка чужой линии.
  for (const link of endLinks) {
    addEdge(nodeIdOfVertex(link.endCoord), nodeIdOfVertex(link.targetCoord), null);
  }

  // --- 5. Сшивка разорванных кусков сетки ---
  // Находим компоненты связности; каждый кусок, отстоящий от другого куска
  // не больше чем на MESH_STITCH_RADIUS_PX, соединяем кратчайшим ребром.
  const componentOf = new Map();
  let componentCount = 0;
  for (const nodeId of nodeById.keys()) {
    if (componentOf.has(nodeId)) continue;
    const queue = [nodeId];
    componentOf.set(nodeId, componentCount);
    while (queue.length) {
      const current = queue.pop();
      for (const edge of adjacency.get(current) || []) {
        if (!componentOf.has(edge.to)) {
          componentOf.set(edge.to, componentCount);
          queue.push(edge.to);
        }
      }
    }
    componentCount++;
  }

  if (componentCount > 1) {
    // все достаточно близкие пары узлов из разных компонент, от коротких к длинным;
    // кандидаты — только из соседних ячеек размером в радиус сшивки
    const stitchGrid = new Map();
    for (const node of nodeById.values()) {
      const cellKey = `${Math.floor(node.coord[0] / MESH_STITCH_RADIUS_PX)}:${Math.floor(node.coord[1] / MESH_STITCH_RADIUS_PX)}`;
      if (!stitchGrid.has(cellKey)) stitchGrid.set(cellKey, []);
      stitchGrid.get(cellKey).push(node);
    }
    const stitchCandidates = [];
    for (const node of nodeById.values()) {
      const cellY = Math.floor(node.coord[0] / MESH_STITCH_RADIUS_PX);
      const cellX = Math.floor(node.coord[1] / MESH_STITCH_RADIUS_PX);
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          for (const other of stitchGrid.get(`${cellY + offsetY}:${cellX + offsetX}`) || []) {
            if (other.id <= node.id) continue; // каждую пару — один раз
            if (componentOf.get(node.id) === componentOf.get(other.id)) continue;
            const gap = distanceBetween(node.coord, other.coord);
            if (gap <= MESH_STITCH_RADIUS_PX) stitchCandidates.push({ gap, a: node.id, b: other.id });
          }
        }
      }
    }
    stitchCandidates.sort((p, q) => p.gap - q.gap);
    const componentParent = new Map();
    const findComponent = (c) => {
      let root = c;
      while (componentParent.has(root)) root = componentParent.get(root);
      return root;
    };
    for (const candidate of stitchCandidates) {
      const rootA = findComponent(componentOf.get(candidate.a));
      const rootB = findComponent(componentOf.get(candidate.b));
      if (rootA === rootB) continue;
      componentParent.set(rootA, rootB);
      addEdge(candidate.a, candidate.b, null, true);
    }
  }

  // --- 6. Узлы точек-объектов и «подходы» к сетке ---
  // Вершина проекции уже вставлена в полилинию (шаг 1.5) и сварена в узел —
  // берём именно его.
  const pointNodeIds = new Map();
  for (const attachment of pointAttachments) {
    const nodeId = `p_${attachment.pointId}`;
    nodeById.set(nodeId, { id: nodeId, coord: attachment.pointCoord, pointId: attachment.pointId });
    pointNodeIds.set(attachment.pointId, nodeId);
    addEdge(nodeId, nodeIdOfVertex(attachment.attachCoord), null, true);
  }

  return { nodeById, adjacency, pointNodeIds };
}
