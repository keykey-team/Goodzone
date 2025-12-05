// src/MapWithImage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  ImageOverlay,
  Marker,
  Polyline,
  FeatureGroup,
  useMapEvents,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";

import AutoFitBounds from "./AutoFitBounds";
import PlaceModal from "./PlaceModal";
import QrSidebar from "./QrSidebar";
import RouteCreateModal from "./RouteCreateModal";
import RouteChoiceModal from "./RouteChoiceModal";
import RouteEditModal from "./RouteEditModal";
import MapImage from "./assets/IMG_4378.JPG";

const apiBase = "http://localhost:4000/api";

const imageWidth = 9643;
const imageHeight = 10293;
const bounds = [
  [0, 0],
  [imageHeight, imageWidth],
];

// ===== иконка номера точки =====
const createNumberIcon = (number, active) =>
  L.divIcon({
    className: active ? "marker-number marker-number--active" : "marker-number",
    html: `<div class="marker-number__circle"><span>${number}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

// ===== мобилка =====
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth <= 900);
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
};

// ===== контрол добавления точки =====
const AddPointController = ({ enabled, onAdd }) => {
  const map = useMapEvents({
    click(e) {
      if (enabled) onAdd(e.latlng);
    },
  });

  useEffect(() => {
    if (!map) return;
    if (enabled) {
      map.dragging.disable();
      map.doubleClickZoom.disable();
      map.scrollWheelZoom.disable();
      map.boxZoom.disable();
      map.touchZoom.disable();
      map.keyboard.disable();
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.scrollWheelZoom.enable();
      map.boxZoom.enable();
      map.touchZoom.enable();
      map.keyboard.enable();
    }
  }, [enabled, map]);

  return null;
};

// нормализация маршрута из БД (objectId → string)
const normalizeRoute = (r) => ({
  ...r,
  id: r.id || r._id,
  fromPointId:
    typeof r.fromPointId === "object"
      ? r.fromPointId.id || r.fromPointId._id || String(r.fromPointId)
      : r.fromPointId,
  toPointId:
    typeof r.toPointId === "object"
      ? r.toPointId.id || r.toPointId._id || String(r.toPointId)
      : r.toPointId,
});

const MapWithImage = ({ mode = "user" }) => {
  const isAdmin = mode === "admin";
  const isMobile = useIsMobile();

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

  // выбор одного из нескольких маршрутов
  const [routeChoiceOpen, setRouteChoiceOpen] = useState(false);
  const [routeVariants, setRouteVariants] = useState([]);

  // редактирование маршрута
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [isRouteEditOpen, setIsRouteEditOpen] = useState(false);

  const featureGroupRef = useRef(null);

  // ===== загрузка точек и маршрутов =====
  useEffect(() => {
    Promise.all([
      fetch(`${apiBase}/points`).then((r) => r.json()),
      fetch(`${apiBase}/routes`).then((r) => r.json()),
    ]).then(([p, r]) => {
      setPoints(p);
      setRoutes(r.map(normalizeRoute));
    });
  }, []);

  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => (a.number || 0) - (b.number || 0)),
    [points]
  );

  // ===== добавление точки =====
  const handleAddPoint = async (latlng) => {
    if (!isAdmin) return;

    const maxNumber = sortedPoints.reduce(
      (m, p) => Math.max(m, p.number || 0),
      0
    );

    const body = {
      number: maxNumber + 1,
      name: `Об'єкт ${maxNumber + 1}`,
      description: "",
      workingHours: "",
      locationText: "",
      type: "",
      imageUrl: "",
      coords: [latlng.lat, latlng.lng],
    };

    const res = await fetch(`${apiBase}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const saved = await res.json();

    setPoints((prev) => [...prev, saved]);
    setAddPointMode(false);
    setSelectedPoint(saved);
    setIsPointModalOpen(true);
  };

  // ===== перемещение точки =====
  const handleMovePoint = async (point, coords) => {
    const res = await fetch(`${apiBase}/points/${point.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...point, coords }),
    });
    const updated = await res.json();
    setPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    if (selectedPoint?.id === updated.id) setSelectedPoint(updated);
  };

  // ===== удаление точки =====
  const handleDeletePoint = async (id) => {
    await fetch(`${apiBase}/points/${id}`, { method: "DELETE" });
    setPoints((prev) => prev.filter((p) => p.id !== id));
    setRoutes((prev) =>
      prev.filter((r) => r.fromPointId !== id && r.toPointId !== id)
    );
    setSelectedPoint(null);
  };

  // ===== новый маршрут через рисовалку =====
  const handleRouteCreatedByDraw = (e) => {
    if (!isAdmin) return;
    if (e.layerType !== "polyline") return;

    const coords = e.layer.getLatLngs().map((pt) => [pt.lat, pt.lng]);
    setPendingRouteCoords(coords);
    setIsRouteModalOpen(true);
  };

  const handleSaveRoute = async ({ name, fromPointId, toPointId }) => {
    if (!pendingRouteCoords || !fromPointId || !toPointId) return;

    const body = {
      name,
      fromPointId,
      toPointId,
      coords: pendingRouteCoords,
    };

    try {
      const res = await fetch(`${apiBase}/routes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error("Failed to save route", await res.text());
        return;
      }

      const saved = await res.json();
      const normalized = normalizeRoute(saved);

      setRoutes((prev) => [...prev, normalized]);
      setPendingRouteCoords(null);
    } catch (e) {
      console.error("Error saving route", e);
    }
  };

  const handleDeleteRoute = async (id) => {
    await fetch(`${apiBase}/routes/${id}`, { method: "DELETE" });
    setRoutes((prev) => prev.filter((r) => r.id !== id && r._id !== id));
  };

  // ===== выбор точки =====
  const handleSelectPoint = (p) => {
    setSelectedPoint(p);
    setIsPointModalOpen(true);
  };

  const handlePointUpdated = (updated) => {
    setPoints((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setSelectedPoint(updated);
  };

  // ===== обновление/удаление маршрута через модалку =====
  const handleRouteUpdated = (updated) => {
    const normalized = normalizeRoute(updated);
    setRoutes((prev) =>
      prev.map((r) => (r.id === normalized.id ? normalized : r))
    );
  };

  const handleRouteDeleted = (id) => {
    handleDeleteRoute(id);
  };

  // ===== выбор конкретного маршрута из нескольких =====
  const handleChooseRouteVariant = (variant) => {
    setRouteChoiceOpen(false);
    if (!variant) return;
    setActiveRouteCoords(variant.coords || []);
  };

  // ===== построение маршрута А→Б =====
  const handleBuildRoute = async (fromId, toId) => {
    setRouteFromId(fromId);
    setRouteToId(toId);
    setActiveRouteCoords([]);
    setRouteChoiceOpen(false);
    setRouteVariants([]);

    if (!fromId || !toId || fromId === toId) return;

    try {
      const res = await fetch(
        `${apiBase}/routes/path?fromId=${fromId}&toId=${toId}`
      );
      if (!res.ok) {
        console.error("path error", await res.text());
        return;
      }

      const data = await res.json();
      const variants = data.variants || [];

      if (!variants.length) {
        // вообще нет маршрутов -> прямая линия
        const from = points.find((p) => p.id === fromId);
        const to = points.find((p) => p.id === toId);
        if (from && to) {
          setActiveRouteCoords([from.coords, to.coords]);
        }
        return;
      }

      if (variants.length === 1) {
        // один вариант — рисуем сразу
        setActiveRouteCoords(variants[0].coords || []);
        return;
      }

      // есть несколько вариантов — даем выбрать
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

  return (
    <div className="gz-layout">
      {/* карта */}
      <div className="gz-map-card">
        <MapContainer
          crs={L.CRS.Simple}
          bounds={bounds}
          style={{ width: "100%", height: "100%" }}
          className={addPointMode ? "leaflet-map add-point-mode" : "leaflet-map"}
          maxBounds={bounds}
          maxBoundsViscosity={1.0}
          minZoom={-3}
          maxZoom={4}
          zoom={-3}
        >
          <ImageOverlay url={MapImage} bounds={bounds} />
          <AutoFitBounds bounds={bounds} />

          <AddPointController
            enabled={isAdmin && addPointMode}
            onAdd={handleAddPoint}
          />

          {isAdmin && (
            <FeatureGroup ref={featureGroupRef}>
              <EditControl
                position="topright"
                onCreated={handleRouteCreatedByDraw}
                draw={{
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  polygon: false,
                  marker: false,
                }}
              />
            </FeatureGroup>
          )}

          {sortedPoints.map((p) => (
            <Marker
              key={p.id}
              position={p.coords}
              icon={createNumberIcon(p.number, selectedPoint?.id === p.id)}
              draggable={isAdmin}
              eventHandlers={{
                click: () => handleSelectPoint(p),
                dragend: (e) => {
                  if (!isAdmin) return;
                  const { lat, lng } = e.target.getLatLng();
                  handleMovePoint(p, [lat, lng]);
                },
              }}
            />
          ))}

          {/* сохранённые маршруты только админу */}
          {isAdmin &&
            routes.map((r) => (
              <Polyline
                key={r.id}
                positions={r.coords}
                color="#f7d34a"
                weight={4}
                eventHandlers={{
                  click: () => {
                    setSelectedRoute(r);
                    setIsRouteEditOpen(true);
                  },
                }}
              />
            ))}

          {/* активный маршрут А→Б */}
          {activeRouteCoords.length > 1 && (
            <Polyline
              positions={activeRouteCoords}
              color="#ffffff"
              weight={6}
              dashArray="6 8"
            />
          )}
        </MapContainer>

        {/* нижняя панель — тот же режим добавления точек */}
        {isAdmin && (
          <div className="gz-toolbar">
            <button
              className={`gz-tool-btn ${addPointMode ? "active" : ""}`}
              onClick={toggleAddPointMode}
            >
              Додати об'єкт
            </button>
          </div>
        )}
      </div>

      {/* правая панель */}
      <QrSidebar
        isAdmin={isAdmin}
        points={sortedPoints}
        selectedPoint={selectedPoint}
        onSelectPoint={handleSelectPoint}
        routeFromId={routeFromId}
        routeToId={routeToId}
        onChangeRouteFrom={setRouteFromId}
        onChangeRouteTo={setRouteToId}
        onBuildRoute={handleBuildRoute}
        addPointMode={addPointMode}
        onToggleAddPointMode={toggleAddPointMode}
      />

      {/* модалки */}
      <PlaceModal
        open={isPointModalOpen}
        point={selectedPoint}
        isAdmin={isAdmin}
        onClose={() => setIsPointModalOpen(false)}
        onSave={handlePointUpdated}
        onDelete={handleDeletePoint}
      />

      <RouteCreateModal
        open={isRouteModalOpen}
        points={sortedPoints}
        onClose={() => setIsRouteModalOpen(false)}
        onSave={handleSaveRoute}
      />

      <RouteChoiceModal
        open={routeChoiceOpen}
        variants={routeVariants}
        points={sortedPoints}
        fromPoint={fromPoint}
        toPoint={toPoint}
        onClose={() => setRouteChoiceOpen(false)}
        onChoose={handleChooseRouteVariant}
      />


      <RouteEditModal
        open={isRouteEditOpen}
        route={selectedRoute}
        points={sortedPoints}
        onClose={() => setIsRouteEditOpen(false)}
        onUpdated={handleRouteUpdated}
        onDeleted={handleRouteDeleted}
      />
    </div>
  );
};

export default MapWithImage;
