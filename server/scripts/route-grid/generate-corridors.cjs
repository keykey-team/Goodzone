/* Шаг 2 генерации сетки: скелет маски -> коридоры (рёбра скелет-графа, каждый
   ровно один раз) + «подход» от каждого маркера точки к ближайшему пикселю
   скелета. Такой набор не имеет наложений, и клиентская сетка строится быстро.

   Вход (в output/): mask.raw и mask.meta.json из extract-mask.cjs,
   goodzone-data.json — экспорт точек из БД ({ points: [{id, number, name, coords}] }).
   Запуск:  node server/scripts/route-grid/generate-corridors.cjs
   Выход:   output/routes.generated.json, corridors-overlay.jpg (проверка глазами),
            dead-ends-overlay.jpg (оставшиеся тупики — аудит разрывов сетки) */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const OUTPUT = path.join(__dirname, "output");
const IMAGE = path.join(__dirname, "../../../client/public/1793011231118-IMG_4808_ukryttia_v3.jpg");
const IMG_H = 10293;

// Все размеры ниже — в пикселях маски (масштаб 0.25 от картинки карты).
// Тупик скелета смыкается с дорожкой впереди, если до неё не дальше этого:
// разрывы скелета под кронами и на стыках покрытий бывают до ~100px карты.
const GAP_CLOSE_RADIUS_PX = 30;
// ...и только если по самой сетке туда идти намного дальше, чем напрямую:
// иначе это не разрыв, а соседняя ветка той же развилки.
const GAP_CLOSE_DETOUR_RATIO = 3;
// ...и только впереди по ходу дорожки (косинус угла с направлением тупика).
const GAP_CLOSE_MIN_COS = 0.5;
// Доля перемычки, которая обязана лежать на проходимой маске: сквозь газон и
// стены не смыкаем.
const GAP_CLOSE_MIN_MASK_SHARE = 0.9;
// Ветка «развилка -> тупик» короче этого — ус от неровного края площадки.
// Длинные тупики (отростки к коттеджам) сохраняются целиком.
const SPUR_MAX_LENGTH_PX = 25;

const { W, H, SCALE } = JSON.parse(fs.readFileSync(path.join(OUTPUT, "mask.meta.json"), "utf8"));
const mask = new Uint8Array(fs.readFileSync(path.join(OUTPUT, "mask.raw")));

let raw = fs.readFileSync(path.join(OUTPUT, "goodzone-data.json"));
let text = raw[0] === 0xff && raw[1] === 0xfe ? raw.toString("utf16le").slice(1) : raw.toString("utf8").replace(/^\uFEFF/, "");
const { points } = JSON.parse(text);

const idx = (x, y) => y * W + x;

/* ---------- 0. Мосты между компонентами (минимальный лес) ---------- */
function bridgeComponents() {
  const comp = new Int32Array(W * H).fill(-1);
  let compCount = 0;
  const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || comp[s] !== -1) continue;
    stack.push(s);
    comp[s] = compCount;
    while (stack.length) {
      const i = stack.pop();
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (mask[ni] && comp[ni] === -1) { comp[ni] = compCount; stack.push(ni); }
        }
    }
    compCount++;
  }

  const label = new Int32Array(W * H).fill(-1);
  const srcPx = new Int32Array(W * H).fill(-1);
  const waveDist = new Uint16Array(W * H);
  let queue = [];
  for (let i = 0; i < W * H; i++) if (mask[i]) { label[i] = comp[i]; srcPx[i] = i; queue.push(i); }
  const bridges = new Map();
  for (let step = 1; queue.length; step++) {
    const next = [];
    for (const i of queue) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (label[ni] === -1) {
          label[ni] = label[i]; srcPx[ni] = srcPx[i]; waveDist[ni] = step;
          next.push(ni);
        } else if (label[ni] !== label[i]) {
          const a = Math.min(label[ni], label[i]), b = Math.max(label[ni], label[i]);
          const key = `${a}|${b}`;
          const gap = waveDist[ni] + step;
          const known = bridges.get(key);
          if (!known || gap < known.gap) bridges.set(key, { gap, srcA: srcPx[i], srcB: srcPx[ni] });
        }
      }
    }
    queue = next;
  }
  const parent = Array.from({ length: compCount }, (_, i) => i);
  const find = (v) => (parent[v] === v ? v : (parent[v] = find(parent[v])));
  let built = 0;
  for (const [key, bridge] of [...bridges.entries()].sort((p, q) => p[1].gap - q[1].gap)) {
    const [a, b] = key.split("|").map(Number);
    if (find(a) === find(b)) continue;
    parent[find(a)] = find(b);
    const ax = bridge.srcA % W, ay = (bridge.srcA / W) | 0;
    const bx = bridge.srcB % W, by = (bridge.srcB / W) | 0;
    const steps = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay)));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(ax + ((bx - ax) * k) / steps);
      const y = Math.round(ay + ((by - ay) * k) / steps);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H) mask[yy * W + xx] = 1;
        }
    }
    built++;
  }
  console.log(`компонент маски: ${compCount}, мостов: ${built}`);
}
bridgeComponents();
// сшитая маска нужна аудиту (audit-detours.cjs) как эталон проходимости
fs.writeFileSync(path.join(OUTPUT, "mask-bridged.raw"), Buffer.from(mask));

/* ---------- 1. Скелетизация (Zhang-Suen) ---------- */
const skel = Uint8Array.from(mask);
function thinPass(step) {
  const toRemove = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (!skel[i]) continue;
      const p2 = skel[i - W], p3 = skel[i - W + 1], p4 = skel[i + 1], p5 = skel[i + W + 1];
      const p6 = skel[i + W], p7 = skel[i + W - 1], p8 = skel[i - 1], p9 = skel[i - W - 1];
      const bN = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      if (bN < 2 || bN > 6) continue;
      const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
      let tr = 0;
      for (let k = 0; k < 8; k++) if (seq[k] === 0 && seq[k + 1] === 1) tr++;
      if (tr !== 1) continue;
      if (step === 0) { if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue; }
      else { if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue; }
      toRemove.push(i);
    }
  }
  for (const i of toRemove) skel[i] = 0;
  return toRemove.length;
}
for (let iter = 0; iter < 200; iter++) { if (thinPass(0) + thinPass(1) === 0) break; }

/* ---------- 2. Скелет-граф: вершины и коридоры ---------- */
const neighborsOf = (i) => {
  const x = i % W, y = (i / W) | 0;
  const out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const ni = idx(nx, ny);
      if (skel[ni]) out.push(ni);
    }
  return out;
};
const are8Adjacent = (a, b) => {
  const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
  return Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1;
};

// Прореживание «лестниц»: пиксель с двумя взаимно смежными соседями избыточен —
// без него линия остаётся связной, а степени узлов перестают врать.
function thinStaircases() {
  for (let pass = 0; pass < 50; pass++) {
    let removed = 0;
    for (let i = 0; i < W * H; i++) {
      if (!skel[i]) continue;
      const nbs = neighborsOf(i);
      if (nbs.length === 2 && are8Adjacent(nbs[0], nbs[1])) { skel[i] = 0; removed++; }
    }
    if (!removed) break;
  }
}
thinStaircases();

const listDeadEnds = () => {
  const deadEnds = [];
  for (let i = 0; i < W * H; i++) if (skel[i] && neighborsOf(i).length === 1) deadEnds.push(i);
  return deadEnds;
};

// Ветка от тупика назад до развилки: [тупик, ..., пиксель перед развилкой].
// Возвращает { pixels, reachedJunction }.
function walkBranchFromDeadEnd(deadEnd, maxLength) {
  const pixels = [deadEnd];
  let prev = -1, cur = deadEnd;
  while (pixels.length <= maxLength) {
    const next = neighborsOf(cur).filter((n) => n !== prev);
    if (next.length !== 1) return { pixels, reachedJunction: next.length > 1 };
    prev = cur;
    cur = next[0];
    if (neighborsOf(cur).length > 2) return { pixels, reachedJunction: true };
    pixels.push(cur);
  }
  return { pixels, reachedJunction: false };
}

/* --- Смыкание разрывов ---
   Скелет рвётся там, где маска на пиксель истончилась (тень кроны, стык
   покрытий). Тупик соединяется с ближайшим пикселем скелета впереди по ходу,
   если (а) по сетке туда далеко — значит это не соседняя ветка той же развилки,
   (б) перемычка лежит на проходимой маске — значит это не путь сквозь газон. */
function closeSkeletonGaps() {
  const radiusSq = GAP_CLOSE_RADIUS_PX * GAP_CLOSE_RADIUS_PX;
  const geodesicLimit = Math.ceil(GAP_CLOSE_RADIUS_PX * GAP_CLOSE_DETOUR_RATIO);
  const bridges = [];

  for (const deadEnd of listDeadEnds()) {
    const endX = deadEnd % W, endY = (deadEnd / W) | 0;

    // направление дорожки у тупика: от пикселя в 6 шагах позади к тупику
    const branch = walkBranchFromDeadEnd(deadEnd, 6).pixels;
    const tail = branch[branch.length - 1];
    let dirX = endX - (tail % W), dirY = endY - ((tail / W) | 0);
    const dirLength = Math.hypot(dirX, dirY);
    if (!dirLength) continue;
    dirX /= dirLength; dirY /= dirLength;

    // геодезические расстояния по скелету от тупика (ограниченный BFS)
    const geodesic = new Map([[deadEnd, 0]]);
    let frontier = [deadEnd];
    for (let step = 1; step <= geodesicLimit && frontier.length; step++) {
      const nextFrontier = [];
      for (const px of frontier)
        for (const nb of neighborsOf(px))
          if (!geodesic.has(nb)) { geodesic.set(nb, step); nextFrontier.push(nb); }
      frontier = nextFrontier;
    }

    let best = null;
    for (let dy = -GAP_CLOSE_RADIUS_PX; dy <= GAP_CLOSE_RADIUS_PX; dy++) {
      for (let dx = -GAP_CLOSE_RADIUS_PX; dx <= GAP_CLOSE_RADIUS_PX; dx++) {
        const distSq = dx * dx + dy * dy;
        if (!distSq || distSq > radiusSq) continue;
        const x = endX + dx, y = endY + dy;
        if (x < 0 || y < 0 || x >= W || y >= H || !skel[idx(x, y)]) continue;
        const dist = Math.sqrt(distSq);
        if ((dx * dirX + dy * dirY) / dist < GAP_CLOSE_MIN_COS) continue;
        const alongSkeleton = geodesic.get(idx(x, y));
        if (alongSkeleton != null && alongSkeleton <= dist * GAP_CLOSE_DETOUR_RATIO) continue;
        if (best && dist >= best.dist) continue;

        // перемычка обязана лежать на маске
        const samples = Math.max(2, Math.ceil(dist));
        let onMask = 0;
        for (let k = 0; k <= samples; k++) {
          const sx = Math.round(endX + (dx * k) / samples);
          const sy = Math.round(endY + (dy * k) / samples);
          if (mask[idx(sx, sy)]) onMask++;
        }
        if (onMask / (samples + 1) < GAP_CLOSE_MIN_MASK_SHARE) continue;
        best = { x, y, dist };
      }
    }
    if (best) bridges.push([endX, endY, best.x, best.y]);
  }

  for (const [x0, y0, x1, y1] of bridges) {
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 0; k <= steps; k++) {
      skel[idx(Math.round(x0 + ((x1 - x0) * k) / steps), Math.round(y0 + ((y1 - y0) * k) / steps))] = 1;
    }
  }
  return bridges.length;
}

/* --- Обрезка усов ---
   Широкие площадки дают скелет-«рыбью кость» с шипом к каждой неровности края.
   Удаляем только ветки «развилка -> тупик» короче SPUR_MAX_LENGTH_PX и
   изолированные огрызки такой же длины. Длинные тупики не трогаем. */
function pruneSpurs() {
  let pruned = 0;
  for (let round = 0; round < 3; round++) {
    let prunedThisRound = 0;
    for (const deadEnd of listDeadEnds()) {
      if (!skel[deadEnd]) continue;
      const { pixels } = walkBranchFromDeadEnd(deadEnd, SPUR_MAX_LENGTH_PX);
      if (pixels.length > SPUR_MAX_LENGTH_PX) continue;
      for (const px of pixels) skel[px] = 0;
      prunedThisRound++;
    }
    pruned += prunedThisRound;
    if (!prunedThisRound) break;
    thinStaircases();
  }
  return pruned;
}

// Смыкаем до и после обрезки: обрезка может принять огрызок у развилки за ус
// и удлинить разрыв, который до неё был в пару пикселей.
let gapsClosed = closeSkeletonGaps();
thinStaircases();
let spursPruned = pruneSpurs();
gapsClosed += closeSkeletonGaps();
thinStaircases();
spursPruned += pruneSpurs();
console.log(`разрывов скелета сомкнуто: ${gapsClosed}, усов обрезано: ${spursPruned}`);
fs.writeFileSync(path.join(OUTPUT, "skeleton.raw"), Buffer.from(skel));

// Узел = число переходов 0->1 по окружению не равно 2 (развилка или тупик)
const transitions = (i) => {
  const x = i % W, y = (i / W) | 0;
  const ring = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  const vals = ring.map(([dx, dy]) => {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return 0;
    return skel[idx(nx, ny)];
  });
  let t = 0;
  for (let k = 0; k < 8; k++) if (!vals[k] && vals[(k + 1) % 8]) t++;
  return t;
};
const degree = new Uint8Array(W * H);
let skelCount = 0;
for (let i = 0; i < W * H; i++) if (skel[i]) { degree[i] = neighborsOf(i).length; skelCount++; }
console.log(`скелет после прореживания: ${skelCount} px`);

const nodeFlag = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) if (skel[i]) nodeFlag[i] = transitions(i) !== 2 ? 1 : 0;
const isNode = (i) => nodeFlag[i] === 1;
const visitedEdge = new Set(); // "a|b" соседние пиксели, уже пройденные
const corridors = [];

function traceFrom(startPx, firstStep) {
  const chain = [startPx, firstStep];
  let prev = startPx, cur = firstStep;
  while (!isNode(cur)) {
    const next = neighborsOf(cur).filter((n) => n !== prev);
    // на прямой после prev остаётся один сосед; диагональ+прямой — берём любого непройденного
    if (!next.length) break; // тупик из-за прореживания
    let chosen = next[0];
    if (next.length > 1) {
      chosen = next.find((n) => !visitedEdge.has(cur < n ? `${cur}|${n}` : `${n}|${cur}`));
      if (chosen == null) break;
    }
    const ek = cur < chosen ? `${cur}|${chosen}` : `${chosen}|${cur}`;
    if (visitedEdge.has(ek)) break;
    visitedEdge.add(ek);
    chain.push(chosen);
    prev = cur;
    cur = chosen;
    if (chain.length > 500000) break;
  }
  return chain;
}

for (let i = 0; i < W * H; i++) {
  if (!isNode(i)) continue;
  for (const nb of neighborsOf(i)) {
    const ek = i < nb ? `${i}|${nb}` : `${nb}|${i}`;
    if (visitedEdge.has(ek)) continue;
    visitedEdge.add(ek);
    const chain = traceFrom(i, nb);
    if (chain.length >= 2) corridors.push(chain);
  }
}
// чистые циклы (все пиксели степени 2) — разрезаем в произвольном месте
const inCorridor = new Uint8Array(W * H);
for (const c of corridors) for (const i of c) inCorridor[i] = 1;
for (let i = 0; i < W * H; i++) {
  if (!skel[i] || inCorridor[i] || degree[i] !== 2) continue;
  const [nb] = neighborsOf(i);
  const chain = traceFrom(i, nb);
  for (const px of chain) inCorridor[px] = 1;
  if (chain.length >= 3) corridors.push(chain);
}
console.log(`коридоров: ${corridors.length}`);

/* ---------- 3. Упрощение и фильтрация коротких усов ---------- */
function simplify(chain, tolerance) {
  if (chain.length < 3) return chain;
  const keep = new Uint8Array(chain.length);
  keep[0] = keep[chain.length - 1] = 1;
  const stack = [[0, chain.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, maxI = -1;
    const [ax, ay] = chain[a], [bx, by] = chain[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const [x, y] = chain[i];
      const d = Math.abs(dy * x - dx * y + bx * ay - by * ax) / len;
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > tolerance) { keep[maxI] = 1; stack.push([a, maxI], [maxI, b]); }
  }
  return chain.filter((_, i) => keep[i]);
}

// --- слияние цепочек и чистка мусора ---
// 1) выбрасываем микропетли (начало == конец, короткие) и усы;
// 2) сливаем коридоры через узлы, в которых сходятся ровно два коридора.
let working = corridors.filter((chain) => {
  const endA = chain[0], endB = chain[chain.length - 1];
  if (endA === endB && chain.length < 40) return false; // микропетля текстуры
  if (chain.length < 12 && (degree[endA] === 1 || degree[endB] === 1)) return false; // ус
  return true;
});

for (;;) {
  const byEnd = new Map(); // пиксель-узел -> [индексы коридоров]
  working.forEach((chain, n) => {
    for (const end of [chain[0], chain[chain.length - 1]]) {
      if (!byEnd.has(end)) byEnd.set(end, []);
      byEnd.get(end).push(n);
    }
  });
  let merged = false;
  for (const [end, list] of byEnd) {
    if (list.length !== 2) continue;
    const [aIdx, bIdx] = list;
    if (aIdx === bIdx) continue; // петля
    const a = working[aIdx], b = working[bIdx];
    const aChain = a[a.length - 1] === end ? a : [...a].reverse();
    const bChain = b[0] === end ? b : [...b].reverse();
    if (aChain[a.length - 1] !== end || bChain[0] !== end) continue;
    working[aIdx] = aChain.concat(bChain.slice(1));
    working.splice(bIdx, 1);
    merged = true;
    break; // byEnd устарел — пересобираем
  }
  if (!merged) break;
}

/* --- удаление коридоров-дублей ---
   На «лестницах» и стыках скелета трассировка иногда проводит две цепочки по
   одним и тем же пикселям. Дубль не добавляет путей, но мешает упрощению
   (каждая точка касания становится обязательной вершиной) и раздувает сетку.
   Идём от длинных к коротким; коридор, который почти весь лежит на пикселях
   уже принятых (с допуском в 1 пиксель), отбрасываем. */
const DUPLICATE_COVERED_SHARE = 0.8;
{
  const covered = new Uint8Array(W * H);
  const isCovered = (px) => {
    const x = px % W, y = (px / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H && covered[ny * W + nx]) return true;
      }
    return false;
  };
  const before = working.length;
  working = working
    .slice()
    .sort((a, b) => b.length - a.length)
    .filter((chain) => {
      let coveredCount = 0;
      for (const px of chain) if (isCovered(px)) coveredCount++;
      if (chain.length >= 3 && coveredCount / chain.length >= DUPLICATE_COVERED_SHARE) return false;
      for (const px of chain) covered[px] = 1;
      return true;
    });
  console.log(`коридоров-дублей удалено: ${before - working.length}`);
}

/* --- ремонт связности набора коридоров ---
   Трассировка может потерять отдельные рёбра на сложных стыках. Объединяем
   коридоры, касающиеся друг друга (общие/соседние пиксели), в компоненты и
   соединяем компоненты минимальными мостами по фактическим пикселям цепочек. */
{
  const parent = Array.from({ length: working.length }, (_, i) => i);
  const find = (v) => (parent[v] === v ? v : (parent[v] = find(parent[v])));
  const union = (a, b) => { parent[find(a)] = find(b); };

  const owner = new Int32Array(W * H).fill(-1);
  working.forEach((chain, n) => {
    for (const px of chain) {
      if (owner[px] === -1) owner[px] = n;
      else union(owner[px], n);
    }
  });
  // касание по соседним пикселям
  working.forEach((chain, n) => {
    for (const px of chain) {
      const x = px % W, y = (px / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const o = owner[ny * W + nx];
          if (o !== -1 && find(o) !== find(n)) union(o, n);
        }
    }
  });

  const compIds = new Set(parent.map((_, i) => find(i)));
  if (compIds.size > 1) {
    // BFS-волны от пикселей каждой компоненты
    const label = new Int32Array(W * H).fill(-1);
    const srcPx = new Int32Array(W * H).fill(-1);
    const waveDist = new Uint16Array(W * H);
    let queue = [];
    working.forEach((chain, n) => {
      for (const px of chain) {
        if (label[px] === -1) { label[px] = find(n); srcPx[px] = px; queue.push(px); }
      }
    });
    const bridges = new Map();
    for (let step = 1; queue.length; step++) {
      const next = [];
      for (const i of queue) {
        const x = i % W, y = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (label[ni] === -1) {
            label[ni] = label[i]; srcPx[ni] = srcPx[i]; waveDist[ni] = step;
            next.push(ni);
          } else if (label[ni] !== label[i]) {
            const a = Math.min(label[ni], label[i]), b = Math.max(label[ni], label[i]);
            const key = `${a}|${b}`;
            const gap = waveDist[ni] + step;
            const known = bridges.get(key);
            if (!known || gap < known.gap) bridges.set(key, { gap, srcA: srcPx[i], srcB: srcPx[ni] });
          }
        }
      }
      queue = next;
    }
    const compParent = new Map([...compIds].map((c) => [c, c]));
    const cFind = (v) => (compParent.get(v) === v ? v : (compParent.set(v, cFind(compParent.get(v))), compParent.get(v)));
    let repairs = 0;
    for (const [key, bridge] of [...bridges.entries()].sort((p, q) => p[1].gap - q[1].gap)) {
      const [a, b] = key.split("|").map(Number);
      if (cFind(a) === cFind(b)) continue;
      compParent.set(cFind(a), cFind(b));
      working.push([bridge.srcA, bridge.srcB]);
      repairs++;
    }
    console.log(`ремонт связности: компонент было ${compIds.size}, добавлено мостов-коридоров ${repairs}`);
  }
}

/* --- упрощение с сохранением контактных вершин ---
   Пиксель, где коридор касается чужого коридора, обязан остаться вершиной:
   иначе упрощение разорвёт стык, который на пикселях существует. */
const ownerFinal = new Int32Array(W * H).fill(-1);
working.forEach((chain, n) => { for (const px of chain) if (ownerFinal[px] === -1) ownerFinal[px] = n; });

function keepIndicesOf(chain, selfIdx) {
  const keep = [];
  for (let k = 0; k < chain.length; k++) {
    const px = chain[k];
    const x = px % W, y = (px / W) | 0;
    let isContact = ownerFinal[px] !== selfIdx; // пиксель делят два коридора
    for (let dy = -1; dy <= 1 && !isContact; dy++)
      for (let dx = -1; dx <= 1 && !isContact; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const o = ownerFinal[ny * W + nx];
        if (o !== -1 && o !== selfIdx) isContact = true;
      }
    if (isContact) keep.push(k);
  }
  return keep;
}

const toXY = (chain) => chain.map((i) => [i % W, (i / W) | 0]);
function simplifyWithKeeps(chain, selfIdx, tolerance) {
  const xy = toXY(chain);
  const anchors = new Set([0, chain.length - 1, ...keepIndicesOf(chain, selfIdx)]);
  const anchorList = [...anchors].sort((a, b) => a - b);
  const out = [];
  for (let a = 0; a < anchorList.length - 1; a++) {
    const part = simplify(xy.slice(anchorList[a], anchorList[a + 1] + 1), tolerance);
    if (a > 0) part.shift();
    out.push(...part);
  }
  return out.length >= 2 ? out : xy;
}

const corridorsXY = working.map((chain, n) => simplifyWithKeeps(chain, n, 2.2));
console.log(`коридоров после слияния и чистки: ${corridorsXY.length}`);
console.log(`вершин после упрощения: ${corridorsXY.reduce((s, c) => s + c.length, 0)}`);

/* ---------- 4. Подходы от маркеров и метаданные from/to ---------- */
const pts = points.map((p) => ({
  ...p,
  px: Math.round(p.coords[1] * SCALE),
  py: Math.round((IMG_H - p.coords[0]) * SCALE),
}));
function nearestSkeleton(cx, cy, maxR = 200) {
  for (let r = 1; r <= maxR; r++) {
    let best = null;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= W || y >= H || !skel[idx(x, y)]) continue;
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { x, y, d };
      }
    if (best) return best;
  }
  return null;
}
const approaches = [];
for (const p of pts) {
  const near = nearestSkeleton(p.px, p.py);
  if (!near) { console.log(`!! точка #${p.number} без подхода`); continue; }
  approaches.push({ point: p, chain: [[p.px, p.py], [near.x, near.y]] });
}

// ближайшая точка к пикселю (для метаданных from/to коридоров)
function nearestPointTo(x, y) {
  let best = null;
  for (const p of pts) {
    const d = (p.px - x) ** 2 + (p.py - y) ** 2;
    if (!best || d < best.d) best = { p, d };
  }
  return best.p;
}

const toLatLng = (xy) => xy.map(([x, y]) => [IMG_H - y / SCALE, x / SCALE]);
const generated = [];
corridorsXY.forEach((chainXY, n) => {
  const [sx, sy] = chainXY[0];
  const [ex, ey] = chainXY[chainXY.length - 1];
  const fromPoint = nearestPointTo(sx, sy);
  const toPoint = nearestPointTo(ex, ey);
  generated.push({
    name: `сетка ${n + 1} (${fromPoint.number}..${toPoint.number})`,
    fromPointId: fromPoint.id,
    toPointId: toPoint.id,
    coords: toLatLng(chainXY),
  });
});
for (const a of approaches) {
  generated.push({
    name: `підхід ${a.point.number}`,
    fromPointId: a.point.id,
    toPointId: a.point.id,
    coords: toLatLng(a.chain),
  });
}
console.log(`итого маршрутов: ${generated.length} (коридоров ${corridorsXY.length} + подходов ${approaches.length})`);
const totalVerts = generated.reduce((s, r) => s + r.coords.length, 0);
console.log(`всего вершин: ${totalVerts}`);
fs.writeFileSync(path.join(OUTPUT, "routes.generated.json"), JSON.stringify(generated));

/* ---------- 5. Аудит тупиков ----------
   Тупик рядом с маркером точки — норма (отросток к коттеджу). Тупик вдали от
   маркеров — либо настоящая тупиковая дорожка, либо разрыв сетки: их
   выводим списком и обводим на dead-ends-overlay.jpg для проверки глазами. */
const MARKER_NEAR_PX = 40; // 160px карты: тупик «у объекта»
const suspiciousDeadEnds = listDeadEnds().filter((px) => {
  const x = px % W, y = (px / W) | 0;
  return !pts.some((p) => (p.px - x) ** 2 + (p.py - y) ** 2 <= MARKER_NEAR_PX ** 2);
});
console.log(`тупиков вдали от объектов: ${suspiciousDeadEnds.length}`);
for (const px of suspiciousDeadEnds) {
  const x = px % W, y = (px / W) | 0;
  console.log(`  тупик [lat ${Math.round(IMG_H - y / SCALE)}, lng ${Math.round(x / SCALE)}]`);
}

/* ---------- 6. Визуальная проверка ---------- */
(async () => {
  const { data } = await sharp(IMAGE)
    .resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const overlay = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    overlay[i * 3] = data[i * 3] >> 1;
    overlay[i * 3 + 1] = data[i * 3 + 1] >> 1;
    overlay[i * 3 + 2] = data[i * 3 + 2] >> 1;
  }
  const drawLine = (x0, y0, x1, y1, r, g, b) => {
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 0; k <= steps; k++) {
      const x = Math.round(x0 + ((x1 - x0) * k) / steps);
      const y = Math.round(y0 + ((y1 - y0) * k) / steps);
      for (let dy = 0; dy <= 1; dy++)
        for (let dx = 0; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const i = idx(xx, yy) * 3;
          overlay[i] = r; overlay[i + 1] = g; overlay[i + 2] = b;
        }
    }
  };
  const palette = [[255,60,60],[60,200,255],[255,220,50],[120,255,120],[255,120,255],[255,160,60]];
  generated.forEach((route, n) => {
    const [r, g, b] = route.name.startsWith("підхід") ? [255, 255, 255] : palette[n % palette.length];
    for (let s = 1; s < route.coords.length; s++) {
      const [latA, lngA] = route.coords[s - 1];
      const [latB, lngB] = route.coords[s];
      drawLine(lngA * SCALE, (IMG_H - latA) * SCALE, lngB * SCALE, (IMG_H - latB) * SCALE, r, g, b);
    }
  });
  await sharp(overlay, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 85 }).toFile(path.join(OUTPUT, "corridors-overlay.jpg"));

  // те же коридоры + красные кольца вокруг подозрительных тупиков
  for (const px of suspiciousDeadEnds) {
    const cx = px % W, cy = (px / W) | 0;
    for (let angle = 0; angle < 360; angle += 3) {
      for (const radius of [9, 10, 11]) {
        const x = Math.round(cx + radius * Math.cos((angle * Math.PI) / 180));
        const y = Math.round(cy + radius * Math.sin((angle * Math.PI) / 180));
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = idx(x, y) * 3;
        overlay[i] = 255; overlay[i + 1] = 0; overlay[i + 2] = 0;
      }
    }
  }
  await sharp(overlay, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 85 }).toFile(path.join(OUTPUT, "dead-ends-overlay.jpg"));
  console.log("corridors-overlay.jpg, dead-ends-overlay.jpg saved");
})();
