// server.js
import express from "express";
import cors from "cors";
import { Point } from "./models/point.model.js";
import { Route } from "./models/route.model.js";
import mongoose from "mongoose";

const app = express();
app.use(cors());
app.use(express.json());

const MONGO_URI =
  process.env.MONGO_URI || "mongodb+srv://goodzonemap:uJUHYZrld2ziF6Yx@cluster0.n8ca2ib.mongodb.net/goodzone?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("[Mongo] connected"))
  .catch((err) => console.error("[Mongo] connection error:", err));

let points = [];
let routes = [];

// список объектов
app.get("/api/points", async (req, res) => {
  try {
    const points = await Point.find().sort({ number: 1 });
    res.json(points);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get points" });
  }
});

// создать объект
app.post("/api/points", async (req, res) => {
  try {
    const point = await Point.create(req.body);
    res.status(201).json(point);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Failed to create point", details: e.message });
  }
});

// обновить объект
app.put("/api/points/:id", async (req, res) => {
  try {
    const point = await Point.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!point) return res.status(404).json({ error: "Point not found" });
    res.json(point);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Failed to update point", details: e.message });
  }
});

app.put("/api/routes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fromPointId, toPointId, coords } = req.body;

    const update = {};
    if (name !== undefined) update.name = name;
    if (fromPointId !== undefined) update.fromPointId = fromPointId;
    if (toPointId !== undefined) update.toPointId = toPointId;
    if (coords !== undefined) update.coords = coords;

    const route = await Route.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!route) return res.status(404).json({ error: "Route not found" });

    res.json({ ...route.toObject(), id: route._id.toString() });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Route update failed", details: e.message });
  }
});
// -------- ROUTES API --------

// все маршруты
app.get("/api/routes", async (req, res) => {
  const routes = await Route.find().lean();
  res.json(
    routes.map((r) => ({
      ...r,
      id: r._id.toString(),
    }))
  );
});

// создать маршрут между двумя точками
app.post("/api/routes", async (req, res) => {
  try {
    const { name, coords } = req.body;

    // Поддерживаем и новые, и старые поля с фронта
    const fromPointId = req.body.fromPointId || req.body.startPointId;
    const toPointId = req.body.toPointId || req.body.endPointId;

    if (!fromPointId || !toPointId || !coords || !coords.length) {
      return res
        .status(400)
        .json({ error: "fromPointId, toPointId та coords обов'язкові" });
    }

    const route = await Route.create({
      name,
      fromPointId,
      toPointId,
      coords,
    });

    res.status(201).json(route);
  } catch (e) {
    console.error(e);
    res.status(400).json({
      error: "Failed to create route",
      details: e.message,
    });
  }
});


// получить "комбинированный" маршрут (t1 -> ... -> tN) по графу
app.get("/api/routes/path", async (req, res) => {
  try {
    const { fromId, toId } = req.query;
    if (!fromId || !toId) {
      return res
        .status(400)
        .json({ error: "fromId та toId обов'язкові" });
    }

    const fromStr = String(fromId);
    const toStr = String(toId);

    // 1) все маршруты из БД
    const routesRaw = await Route.find({
      fromPointId: { $exists: true, $ne: null },
      toPointId: { $exists: true, $ne: null },
    }).lean();

    // нормализуем id-шники
    const routes = routesRaw.map((r) => ({
      ...r,
      _id: r._id.toString(),
      fromPointId: r.fromPointId.toString(),
      toPointId: r.toPointId.toString(),
    }));

    // 2) строим граф
    const adj = {}; // nodeId -> [{to, routeId}]
    const byId = {}; // routeId -> route

    for (const r of routes) {
      const a = r.fromPointId;
      const b = r.toPointId;

      byId[r._id] = r;

      if (!adj[a]) adj[a] = [];
      if (!adj[b]) adj[b] = [];

      adj[a].push({ to: b, routeId: r._id });
      adj[b].push({ to: a, routeId: r._id }); // считаем двусторонними
    }

    // утиль: BFS, возвращает массив шагов {from, to, route}
    function bfs(start, target, bannedRouteIds = new Set()) {
      const q = [start];
      const visited = new Set([start]);
      const prev = {}; // node -> { prevNode, routeId }

      while (q.length) {
        const cur = q.shift();
        if (cur === target) break;

        for (const edge of adj[cur] || []) {
          if (bannedRouteIds.has(edge.routeId)) continue;

          const nxt = edge.to;
          if (!visited.has(nxt)) {
            visited.add(nxt);
            prev[nxt] = { prevNode: cur, routeId: edge.routeId };
            q.push(nxt);
          }
        }
      }

      if (!visited.has(target)) return null;

      const steps = [];
      let cur = target;
      while (cur !== start) {
        const info = prev[cur];
        if (!info) return null;
        steps.push({
          from: info.prevNode,
          to: cur,
          route: byId[info.routeId],
        });
        cur = info.prevNode;
      }
      steps.reverse();
      return steps;
    }

    // утиль: из шагов строим coords/routeIds/pointIds
    function buildVariant(steps, start) {
      if (!steps || !steps.length) return null;

      const coords = [];
      const routeIds = [];
      const pointIds = [start];

      steps.forEach((step, index) => {
        const { from, to, route } = step;
        routeIds.push(route._id);
        pointIds.push(to);

        let seg = route.coords || [];
        const rf = route.fromPointId;
        const rt = route.toPointId;

        // приводим к направлению from -> to
        if (rf === to && rt === from) {
          seg = [...seg].reverse();
        }

        if (index === 0) coords.push(...seg);
        else coords.push(...seg.slice(1)); // чтобы не дублировать вершину
      });

      return { routeIds, pointIds, coords };
    }

    // 3) прямые маршруты между from/to
    const directSteps = routes
      .filter((r) => {
        const a = r.fromPointId;
        const b = r.toPointId;
        return (
          (a === fromStr && b === toStr) || (a === toStr && b === fromStr)
        );
      })
      .map((r) => [
        {
          from: r.fromPointId === fromStr ? fromStr : toStr,
          to: r.fromPointId === fromStr ? toStr : fromStr,
          route: r,
        },
      ]);

    const directVariants = directSteps
      .map((steps) => buildVariant(steps, fromStr))
    .filter(Boolean)
      .map((v) => ({ ...v, type: "direct" }));

    // 4) самый короткий путь (по числу маршрутов)
    const shortestSteps = bfs(fromStr, toStr);
    const shortestVariant = shortestSteps
      ? { ...buildVariant(shortestSteps, fromStr), type: "shortest" }
      : null;

    // 5) альтернативный путь без прямых маршрутов
    const bannedDirectIds = new Set(
      directSteps.map((s) => s[0]?.route?._id).filter(Boolean)
    );
    let altVariant = null;
    if (bannedDirectIds.size > 0) {
      const altSteps = bfs(fromStr, toStr, bannedDirectIds);
      if (altSteps) {
        altVariant = {
          ...buildVariant(altSteps, fromStr),
          type: "alternative",
        };
      }
    }

    // 6) собираем варианты
    const variants = [];

    // сначала все прямые
    for (const v of directVariants) {
      variants.push(v);
    }

    // добавляем shortest, если он есть и отличается от уже добавленных
    if (shortestVariant) {
      const shortestKey = shortestVariant.routeIds.join("|");
      const already = variants.some(
        (v) => v.routeIds.join("|") === shortestKey
      );
      if (!already) {
        variants.push(shortestVariant);
      }
    }

    // добавляем альтернативный, если он есть и отличается от остальных
    if (altVariant) {
      const altKey = altVariant.routeIds.join("|");
      const already = variants.some(
        (v) => v.routeIds.join("|") === altKey
      );
      if (!already) {
        variants.push(altVariant);
      }
    }

    // помечаем самый короткий
    if (shortestVariant) {
      const shortestKey = shortestVariant.routeIds.join("|");
      for (const v of variants) {
        v.isShortest = v.routeIds.join("|") === shortestKey;
      }
    }

    res.json({ variants });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to build routes", details: e.message });
  }
});

app.delete("/api/routes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const route = await Route.findByIdAndDelete(id);
    if (!route) return res.status(404).json({ error: "Route not found" });
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: "Route delete failed", details: e.message });
  }
});

app.delete("/api/points/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const point = await Point.findByIdAndDelete(id);
    if (!point) {
      return res.status(404).json({ error: "Point not found" });
    }

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(400).json({
      error: "Failed to delete point",
      details: e.message,
    });
  }
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API http://localhost:${PORT}`));