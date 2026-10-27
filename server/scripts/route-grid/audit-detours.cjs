/* Шаг 3 генерации сетки: аудит крюков.
   Для каждой пары точек сравнивает длину маршрута по сгенерированной сетке
   с эталоном — кратчайшим путём прямо по пикселям проходимой маски.
   Сетка заметно длиннее эталона = в ней разрыв, маршрут делает крюк.

   Запуск:  node server/scripts/route-grid/audit-detours.cjs
   Вход (в output/): mask-bridged.raw, mask.meta.json, goodzone-data.json,
            routes.generated.json
   Маршруты считаются тем же кодом, что и в браузере: модули клиента
   features/map-routes склеиваются здесь в один скрипт. */
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "output");
const CLIENT_ROUTING_DIR = path.join(__dirname, "../../../client/src/features/map-routes");
const IMG_H = 10293;

// Крюк = сетка длиннее эталона и в DETOUR_RATIO раз, и на DETOUR_MIN_EXCESS_PX.
// Эталон срезает углы внутри ширины дорожки, поэтому 10–15% разницы — норма.
const DETOUR_RATIO = 1.25;
const DETOUR_MIN_EXCESS_PX = 400;

// Клиентские ES-модули без import/export: config + routeGraph + shortestPath.
const clientRoutingSource = ["config/routeGraph.config.js", "model/routeGraph.js", "model/shortestPath.js"]
  .map((file) => fs.readFileSync(path.join(CLIENT_ROUTING_DIR, file), "utf8"))
  .join("\n")
  .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm, "")
  .replace(/^export\s+/gm, "");
eval(clientRoutingSource);

const { W, H, SCALE } = JSON.parse(fs.readFileSync(path.join(OUTPUT, "mask.meta.json"), "utf8"));
const mask = new Uint8Array(fs.readFileSync(path.join(OUTPUT, "mask-bridged.raw")));

let raw = fs.readFileSync(path.join(OUTPUT, "goodzone-data.json"));
const text = raw[0] === 0xff && raw[1] === 0xfe ? raw.toString("utf16le").slice(1) : raw.toString("utf8").replace(/^﻿/, "");
const { points } = JSON.parse(text);
const routes = JSON.parse(fs.readFileSync(path.join(OUTPUT, "routes.generated.json"), "utf8"))
  .map((route, n) => ({ ...route, id: `g${n}` }));

/* --- эталон: Дейкстра по пикселям маски от каждой точки --- */
const toPixel = (coords) => [Math.round(coords[1] * SCALE), Math.round((IMG_H - coords[0]) * SCALE)];
function nearestMaskPixel(cx, cy) {
  for (let r = 0; r < 300; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x]) return { x, y, gap: Math.hypot(dx, dy) };
      }
  return null;
}

const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const dist = new Float64Array(W * H);
const heapCost = new Float64Array(W * H * 2);
const heapNode = new Int32Array(W * H * 2);

function maskDijkstra(startIdx) {
  dist.fill(Infinity);
  let size = 0;
  const push = (cost, node) => {
    let c = size++;
    heapCost[c] = cost; heapNode[c] = node;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heapCost[p] <= heapCost[c]) break;
      [heapCost[p], heapCost[c]] = [heapCost[c], heapCost[p]];
      [heapNode[p], heapNode[c]] = [heapNode[c], heapNode[p]];
      c = p;
    }
  };
  const pop = () => {
    const cost = heapCost[0], node = heapNode[0];
    size--;
    heapCost[0] = heapCost[size]; heapNode[0] = heapNode[size];
    let p = 0;
    for (;;) {
      const l = p * 2 + 1, r = l + 1;
      let s = p;
      if (l < size && heapCost[l] < heapCost[s]) s = l;
      if (r < size && heapCost[r] < heapCost[s]) s = r;
      if (s === p) break;
      [heapCost[p], heapCost[s]] = [heapCost[s], heapCost[p]];
      [heapNode[p], heapNode[s]] = [heapNode[s], heapNode[p]];
      p = s;
    }
    return [cost, node];
  };
  dist[startIdx] = 0;
  push(0, startIdx);
  while (size) {
    const [cost, node] = pop();
    if (cost > dist[node]) continue;
    const x = node % W, y = (node / W) | 0;
    for (const [dx, dy, w] of STEPS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = ny * W + nx;
      if (!mask[ni]) continue;
      const nc = cost + w;
      if (nc < dist[ni]) { dist[ni] = nc; push(nc, ni); }
    }
  }
}

const anchors = points.map((p) => {
  const [px, py] = toPixel(p.coords);
  return { point: p, ...nearestMaskPixel(px, py) };
});

/* --- сравнение --- */
const graph = buildRouteGraph(points, routes);
const detours = [];
let comparedPairs = 0;
for (let i = 0; i < anchors.length; i++) {
  maskDijkstra(anchors[i].y * W + anchors[i].x);
  for (let j = i + 1; j < anchors.length; j++) {
    const maskSteps = dist[anchors[j].y * W + anchors[j].x];
    if (!isFinite(maskSteps)) continue;
    const truthPx = (maskSteps + anchors[i].gap + anchors[j].gap) / SCALE;
    const variants = findRouteVariants(graph, anchors[i].point.id, anchors[j].point.id);
    if (!variants.length) { detours.push({ i, j, truthPx, meshPx: Infinity }); continue; }
    comparedPairs++;
    const meshPx = variants[0].length;
    if (meshPx > truthPx * DETOUR_RATIO && meshPx - truthPx > DETOUR_MIN_EXCESS_PX) {
      detours.push({ i, j, truthPx, meshPx });
    }
  }
}

detours.sort((a, b) => (b.meshPx - b.truthPx) - (a.meshPx - a.truthPx));
console.log(`пар сравнено: ${comparedPairs}; с крюком: ${detours.length}`);
for (const d of detours.slice(0, 40)) {
  const a = anchors[d.i].point, b = anchors[d.j].point;
  console.log(`  #${a.number} -> #${b.number}: эталон ${Math.round(d.truthPx)}px, сетка ${Math.round(d.meshPx)}px (+${Math.round(((d.meshPx / d.truthPx) - 1) * 100)}%)`);
}
fs.writeFileSync(path.join(OUTPUT, "detours.json"), JSON.stringify(detours.map((d) => ({
  from: anchors[d.i].point.number, to: anchors[d.j].point.number, truthPx: d.truthPx, meshPx: d.meshPx,
}))));
