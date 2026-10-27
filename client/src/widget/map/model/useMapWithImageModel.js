// widgets/map/model/useMapWithImageModel.js
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchPoints } from "../../../entities/point/api/pointApi";
import { fetchRoutes } from "../../../entities/route/api/routeApi";
import { normalizeRoute } from "../../../entities/route/model/normalizeRoute";
import {
  addPointOnMap,
  movePointOnMap,
  deletePointOnMap,
} from "../../../features/map-points/model/mapPointsService";

import {
  createRouteFromDraw,
  deleteRouteById,
  getRouteVariants,
} from "../../../features/map-routes/model/mapRoutesService";

// Порядок точки в списках: сперва числовая база номера («12» и «12(1)» → 12),
// при равенстве — номер дубля. Старое сравнение `a.number - b.number` на
// строковых номерах давало NaN и непредсказуемый порядок.
const pointSortValue = (point) => {
  if (Number.isFinite(point.numberBase)) return point.numberBase;
  const parsedNumber = parseInt(point.number, 10);
  return Number.isFinite(parsedNumber) ? parsedNumber : 0;
};

export const useMapWithImageModel = ({ mode = "user" }) => {
  const isAdmin = mode === "admin";

  const [points, setPoints] = useState([]);
  const [routes, setRoutes] = useState([]);

  const [addPointMode, setAddPointMode] = useState(false);

  const [selectedPoint, setSelectedPoint] = useState(null);
  const [isPointModalOpen, setIsPointModalOpen] = useState(false);

  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [pendingRouteCoords, setPendingRouteCoords] = useState(null);

  const [routeFromId, setRouteFromId] = useState("");
  const [routeToId, setRouteToId] = useState("");
  const [activeRouteCoords, setActiveRouteCoords] = useState([]);

  const [routeChoiceOpen, setRouteChoiceOpen] = useState(false);
  const [routeVariants, setRouteVariants] = useState([]);
  const [routeNotFound, setRouteNotFound] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isRouteEditOpen, setIsRouteEditOpen] = useState(false);

  const featureGroupRef = useRef(null);

  useEffect(() => {
    Promise.all([fetchPoints(), fetchRoutes()]).then(([p, r]) => {
      setPoints(p);
      setRoutes(r.map(normalizeRoute));
    });
  }, []);

  const sortedPoints = useMemo(
    () =>
      [...points].sort(
        (a, b) =>
          pointSortValue(a) - pointSortValue(b) ||
          (a.numberDup || 0) - (b.numberDup || 0)
      ),
    [points]
  );

  // ===== ХЕНДЛЕРЫ =====

  const handleAddPoint = async (latlng) => {
    if (!isAdmin) return;

    const saved = await addPointOnMap(latlng, sortedPoints);

    setPoints((prev) => [...prev, saved]);
    setAddPointMode(false);
    setSelectedPoint(saved);
    setIsPointModalOpen(true);
  };

  const handleMovePoint = async (point, coords) => {
    const updated = await movePointOnMap(point, coords);

    setPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (selectedPoint?.id === updated.id) setSelectedPoint(updated);
  };

  const handleDeletePoint = async (id) => {
    await deletePointOnMap(id);

    setPoints((prev) => prev.filter((p) => p.id !== id));
    setRoutes((prev) =>
      prev.filter((r) => r.fromPointId !== id && r.toPointId !== id)
    );
    setSelectedPoint(null);
  };

  const handleRouteCreatedByDraw = (e) => {
    if (!isAdmin) return;
    if (e.layerType !== "polyline") return;

    const coords = e.layer.getLatLngs().map((pt) => [pt.lat, pt.lng]);
    setPendingRouteCoords(coords);
    setIsRouteModalOpen(true);
  };

  const handleSaveRoute = async ({ name, fromPointId, toPointId }) => {
    if (!pendingRouteCoords || !fromPointId || !toPointId) return;

    try {
      const normalized = await createRouteFromDraw(pendingRouteCoords, {
        name,
        fromPointId,
        toPointId,
      });

      setRoutes((prev) => [...prev, normalized]);
      setPendingRouteCoords(null);
    } catch (e) {
      console.error("Error saving route", e);
    }
  };

  const handleDeleteRoute = async (id) => {
    await deleteRouteById(id);
    setRoutes((prev) => prev.filter((r) => r.id !== id && r._id !== id));
  };

  const handleSelectPoint = (p) => {
    setSelectedPoint(p);
    setIsPointModalOpen(true);
  };

  const handlePointUpdated = (updated) => {
    setPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedPoint(updated);
  };

  const handleRouteUpdated = (updated) => {
    const normalized = normalizeRoute(updated);
    setRoutes((prev) =>
      prev.map((r) => (r.id === normalized.id ? normalized : r))
    );
  };

  const handleRouteDeleted = (id) => {
    handleDeleteRoute(id);
  };

  const handleChooseRouteVariant = (variant) => {
    setRouteChoiceOpen(false);
    if (!variant) return;
    setActiveRouteCoords(variant.coords || []);
  };

  // pickShortest: сразу показать кратчайший вариант, без модалки выбора
  const handleBuildRoute = (fromId, toId, { pickShortest = false } = {}) => {
    setRouteFromId(fromId);
    setRouteToId(toId);
    setActiveRouteCoords([]);
    setRouteChoiceOpen(false);
    setRouteVariants([]);
    setRouteNotFound(false);

    if (!fromId || !toId || fromId === toId) return;

    try {
      const variants = getRouteVariants(fromId, toId, { points, routes });

      if (!variants.length) {
        // Пути по нарисованным дорожкам нет. Прямую линию «сквозь стены»
        // больше не рисуем — честно сообщаем, что маршрут не найден.
        setRouteNotFound(true);
        return;
      }

      // варианты уже отсортированы по длине — первый самый короткий
      if (variants.length === 1 || pickShortest) {
        setActiveRouteCoords(variants[0].coords || []);
        return;
      }

      setRouteVariants(variants);
      setRouteChoiceOpen(true);
    } catch (e) {
      console.error(e);
    }
  };

  const fromPoint = points.find((p) => p.id === routeFromId);
  const toPoint = points.find((p) => p.id === routeToId);

  // Рецепция — точка "Головний корпус / Reception" (№31)
  const receptionPoint = useMemo(
    () =>
      points.find((p) => /reception|рецепц/i.test(p.name || "")) ||
      points.find((p) => String(p.number) === "31") ||
      null,
    [points]
  );

  const handleBuildRouteFromReception = (toId) => {
    if (!receptionPoint || !toId) return;
    setIsPointModalOpen(false);
    handleBuildRoute(receptionPoint.id, toId, { pickShortest: true });
  };

  const toggleAddPointMode = () => {
    if (!isAdmin) return;
    setAddPointMode((v) => !v);
  };

  return {
    isAdmin,
    points,
    routes,
    sortedPoints,
    addPointMode,
    selectedPoint,
    isPointModalOpen,
    isRouteModalOpen,
    pendingRouteCoords,
    routeFromId,
    routeToId,
    activeRouteCoords,
    routeChoiceOpen,
    routeVariants,
    routeNotFound,
    selectedRoute,
    isRouteEditOpen,
    fromPoint,
    toPoint,
    receptionPoint,
    featureGroupRef,

    setRouteFromId,
    setRouteToId,
    setIsPointModalOpen,
    setIsRouteModalOpen,
    setSelectedRoute,
    setIsRouteEditOpen,
    setRouteChoiceOpen,

    handleAddPoint,
    handleMovePoint,
    handleDeletePoint,
    handleRouteCreatedByDraw,
    handleSaveRoute,
    handleDeleteRoute,
    handleSelectPoint,
    handlePointUpdated,
    handleRouteUpdated,
    handleRouteDeleted,
    handleChooseRouteVariant,
    handleBuildRoute,
    handleBuildRouteFromReception,
    toggleAddPointMode,
  };
};
