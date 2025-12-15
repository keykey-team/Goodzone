// controllers/route.controller.js
import { Route } from "../models/route.model.js";

/**
 * GET /api/goodzone/routes
 * Все маршруты
 */
export async function getRoutes(req, res) {
  try {
    const routes = await Route.find().lean();
    res.json(
      routes.map((r) => ({
        ...r,
        id: r._id.toString(),
      }))
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to get routes" });
  }
}

/**
 * POST /api/goodzone/routes
 * Создать маршрут между двумя точками
 */
export async function createRoute(req, res) {
  try {
    const { name, coords } = req.body;

    // поддерживаем старые поля startPointId/endPointId
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
}

/**
 * PUT /api/goodzone/routes/:id
 * Обновить маршрут
 */
export async function updateRoute(req, res) {
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

    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }

    res.json({ ...route.toObject(), id: route._id.toString() });
  } catch (e) {
    console.error(e);
    res
      .status(400)
      .json({ error: "Route update failed", details: e.message });
  }
}

/**
 * DELETE /api/goodzone/routes/:id
 */
export async function deleteRoute(req, res) {
  try {
    const { id } = req.params;
    const route = await Route.findByIdAndDelete(id);
    if (!route) {
      return res.status(404).json({ error: "Route not found" });
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res
      .status(400)
      .json({ error: "Route delete failed", details: e.message });
  }
}

/**
 * GET /api/goodzone/routes/path?fromId=...&toId=...
 * Построение комбинированного маршрута по графу
 */
export async function getRoutePath(req, res) {
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
    const adj = {}; // nodeId -> [{ to, routeId }]
    const byId = {}; // routeId -> route

    for (const r of routes) {
      const a = r.fromPointId;
      const b = r.toPointId;

      byId[r._id] = r;

      if (!adj[a]) adj[a] = [];
      if (!adj[b]) adj[b] = [];

      adj[a].push({ to: b, routeId: r._id });
      adj[b].push({ to: a, routeId: r._id }); // двусторонние
    }

    // BFS
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

    // Утилка: собрать coords/routeIds/pointIds
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

        // привести к направлению from -> to
        if (rf === to && rt === from) {
          seg = [...seg].reverse();
        }

        if (index === 0) coords.push(...seg);
        else coords.push(...seg.slice(1)); // без дублирования точки
      });

      return { routeIds, pointIds, coords };
    }

    // 3) прямые маршруты
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

    // 4) самый короткий путь
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

    // сначала прямые
    for (const v of directVariants) {
      variants.push(v);
    }

    // добавляем shortest, если он уникален
    if (shortestVariant) {
      const shortestKey = shortestVariant.routeIds.join("|");
      const already = variants.some(
        (v) => v.routeIds.join("|") === shortestKey
      );
      if (!already) {
        variants.push(shortestVariant);
      }
    }

    // добавляем альтернативный, если он есть и уникален
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
    res
      .status(500)
      .json({ error: "Failed to build routes", details: e.message });
  }
}
