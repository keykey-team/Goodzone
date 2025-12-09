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
    () => [...points].sort((a, b) => (a.number || 0) - (b.number || 0)),
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

  const handleBuildRoute = async (fromId, toId) => {
  setRouteFromId(fromId);
  setRouteToId(toId);
  setActiveRouteCoords([]);
  setRouteChoiceOpen(false);
  setRouteVariants([]);

  if (!fromId || !toId || fromId === toId) return;

  try {
    // ПЕРЕДАЁМ ВСЕ МАРШРУТЫ
    const variants = await getRouteVariants(fromId, toId, routes, {
      maxDepth: 10,      // можно подправить под свои масштабы
      maxVariants: 200,  // лимит на количество найденных путей
    });

    if (!variants.length) {
      const from = points.find((p) => p.id === fromId);
      const to = points.find((p) => p.id === toId);
      if (from && to) {
        setActiveRouteCoords([from.coords, to.coords]);
      }
      return;
    }

    if (variants.length === 1) {
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
    selectedRoute,
    isRouteEditOpen,
    fromPoint,
    toPoint,
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
    toggleAddPointMode,
  };
};
