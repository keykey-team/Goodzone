import { useState, useEffect, useRef } from "react";

import {
  MapContainer,
  ImageOverlay,
  FeatureGroup,
  useMap,
} from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import { QRCodeCanvas } from "qrcode.react";

import PointMarker from "../../../entities/point/ui/PointMarker";
import ActiveRoutePolyline from "../../../features/map-build-route/ui/ActiveRoutePoline";
// import AutoFitBounds from "../../../shared/ui/AutoFitBounds"; // не используем
import PlaceModal from "../../../features/point-manage/ui/PlaceModal";
import QrSidebar from "../../map-sidebar/ui/QrSidebar";
import RouteCreateModal from "../../../features/route-create/ui/RouteCreateModal";
import RouteChoiceModal from "../../../features/map-route-choice/ui/RouteChoiceModal";
import RouteEditModal from "../../../features/route-edit/ui/RouteEditModal";
import MapImage from "../../../assets/goodzoneMap8.webp";
import { bounds } from "../config/mapConfig";
import AddPointController from "../../../features/map-add-point/ui/AddPointController";
import { RoutePolyline } from "../../../entities/route/ui/RoutePoline";
import { useMapWithImageModel } from "../model/useMapWithImageModel";

/**
 * Внутренний компонент, который сам зумит карту по маршруту
 */
const RouteAutoZoom = ({ coords }) => {
  const map = useMap();

  useEffect(() => {
    if (!coords || coords.length < 2) return;

    try {
      const routeBounds = L.latLngBounds(coords);
      map.fitBounds(routeBounds, {
        padding: [80, 80],
      });
    } catch (e) {
      console.error("RouteAutoZoom fitBounds error:", e);
    }
  }, [coords, map]);

  return null;
};

const MapWithImage = ({ mode = "user" }) => {
  const model = useMapWithImageModel({ mode });

  // 👉 состояние для модалки с большим QR
  const [qrPoint, setQrPoint] = useState(null);
  const qrCanvasRef = useRef(null);

  // 👉 для undo последнего перетаскивания точки
  const [lastMove, setLastMove] = useState(null);

  // реф на карточку с картой — для scrollIntoView
  const mapCardRef = useRef(null);

  // Базовый URL сайта (для ссылок в QR)
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // 📍 Границы картинки
  const imgBounds = L.latLngBounds(bounds);
  const bottomLeft = imgBounds.getSouthWest();
  const bottomRight = imgBounds.getSouthEast();

  // 📱 проверяем мобилу
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // 📍 Центр — разный для мобилки и десктопа
  let initialCenter = bottomLeft;
  if (isMobile) {
    const centerLng = (bottomLeft.lng + bottomRight.lng) / 2;
    initialCenter = L.latLng(bottomLeft.lat, centerLng);
  }

  // 🔍 Стартовый зум — НЕ отдаляем
  const initialZoom = -3;

  

  // 👉 Автооткрытие модалки точки по ?point=ID
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!model.sortedPoints.length) return;

    const params = new URLSearchParams(window.location.search);
    const pointId = params.get("point");
    if (!pointId) return;

    const p = model.sortedPoints.find((pt) => pt.id === pointId);
    if (p) {
      model.handleSelectPoint(p);
      model.setIsPointModalOpen(true);
    }
  }, [model.sortedPoints, model]);

  // обёртка над построением маршрута:
  // ❗ ТОЛЬКО строим маршрут, зум делает RouteAutoZoom
  const handleBuildRouteAndScroll = (fromId, toId) => {
    model.handleBuildRoute(fromId, toId);
  };

  // когда появился активный маршрут → просто скроллим к карте
  useEffect(() => {
    const coords = model.activeRouteCoords;
    if (!coords || coords.length < 2) return;
    if (!mapCardRef.current) return;

    mapCardRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [model.activeRouteCoords]);

  // 👉 обёртка над перемещением точки — сохраняем предыдущие координаты
  const handleMovePointWithHistory = async (point, coords) => {
    setLastMove({
      pointId: point.id,
      prevCoords: point.coords,
    });

    await model.handleMovePoint(point, coords);
  };

  // 👉 Ctrl+Z / Cmd+Z — откат последнего перетаскивания точки
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isUndoKey =
        (e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey);

      if (!isUndoKey) return;
      if (!lastMove) return;

      const { pointId, prevCoords } = lastMove;
      const point = model.sortedPoints.find((p) => p.id === pointId);
      if (!point) return;

      model.handleMovePoint(point, prevCoords);

      setLastMove(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lastMove, model, model.sortedPoints]);

  const handleDownloadQr = () => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const namePart = qrPoint?.number || qrPoint?.id || "qr";
    link.href = dataUrl;
    link.download = `point-${namePart}-qr.png`;
    link.click();
  };

  const handleCloseQrModal = () => setQrPoint(null);

  const minZoomValue = isMobile ? -4 : -3;

  return (
    <div className="gz-layout">
      <div className="gz-map-card" ref={mapCardRef}>
        <MapContainer
          crs={L.CRS.Simple}
          center={initialCenter}
          zoom={minZoomValue}
          style={{ width: "100%", height: "100%" }}
          className={
            model.addPointMode ? "leaflet-map add-point-mode" : "leaflet-map"
          }
          maxBounds={bounds}
          maxBoundsViscosity={1.0}
          minZoom={minZoomValue}
          maxZoom={4}
        >
          <ImageOverlay url={MapImage} bounds={bounds} />

          {/* 👇 Авто-зум по активному маршруту */}
          <RouteAutoZoom coords={model.activeRouteCoords} />

          <AddPointController
            enabled={model.isAdmin && model.addPointMode}
            onAdd={model.handleAddPoint}
          />

          {model.isAdmin && (
            <FeatureGroup ref={model.featureGroupRef}>
              <EditControl
                position="topright"
                onCreated={model.handleRouteCreatedByDraw}
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

          {model.sortedPoints.map((p) => (
            <PointMarker
              key={p.id}
              point={p}
              isActive={model.selectedPoint?.id === p.id}
              isDraggable={model.isAdmin}
              onSelect={model.handleSelectPoint}
              onMove={handleMovePointWithHistory}
            />
          ))}

          {model.isAdmin &&
            model.routes.map((r) => (
              <RoutePolyline
                key={r.id}
                route={r}
                onClick={(route) => {
                  model.setSelectedRoute(route);
                  model.setIsRouteEditOpen(true);
                }}
              />
            ))}

          {/* активный маршрут А→Б */}
          <ActiveRoutePolyline coords={model.activeRouteCoords} />
        </MapContainer>

        {model.isAdmin && (
          <div className="gz-toolbar">
            <button
              className={`gz-tool-btn ${model.addPointMode ? "active" : ""}`}
              onClick={model.toggleAddPointMode}
            >
              Додати об'єкт
            </button>
          </div>
        )}
      </div>

      <QrSidebar
        isAdmin={model.isAdmin}
        points={model.sortedPoints}
        selectedPoint={model.selectedPoint}
        onSelectPoint={model.handleSelectPoint}
        routeFromId={model.routeFromId}
        routeToId={model.routeToId}
        onChangeRouteFrom={model.setRouteFromId}
        onChangeRouteTo={model.setRouteToId}
        onBuildRoute={handleBuildRouteAndScroll}
        addPointMode={model.addPointMode}
        onToggleAddPointMode={model.toggleAddPointMode}
        onOpenQr={setQrPoint}
      />

      <PlaceModal
        open={model.isPointModalOpen}
        point={model.selectedPoint}
        isAdmin={model.isAdmin}
        onClose={() => model.setIsPointModalOpen(false)}
        onSave={model.handlePointUpdated}
        onDelete={model.handleDeletePoint}
      />

      <RouteCreateModal
        open={model.isRouteModalOpen}
        points={model.sortedPoints}
        onClose={() => model.setIsRouteModalOpen(false)}
        onSave={model.handleSaveRoute}
      />

      <RouteChoiceModal
        open={model.routeChoiceOpen}
        variants={model.routeVariants}
        points={model.sortedPoints}
        fromPoint={model.fromPoint}
        toPoint={model.toPoint}
        onClose={() => model.setRouteChoiceOpen(false)}
        onChoose={model.handleChooseRouteVariant}
      />

      <RouteEditModal
        open={model.isRouteEditOpen}
        route={model.selectedRoute}
        points={model.sortedPoints}
        onClose={() => model.setIsRouteEditOpen(false)}
        onUpdated={model.handleRouteUpdated}
        onDeleted={model.handleRouteDeleted}
      />

      {/* 👉 Модалка с большим QR для админа */}
      {model.isAdmin && qrPoint && (
        <div className="gz-modal-backdrop" onClick={handleCloseQrModal}>
          <div className="gz-qr-modal" onClick={(e) => e.stopPropagation()}>
            <button className="gz-modal-close" onClick={handleCloseQrModal}>
              ×
            </button>

            <h3 className="gz-qr-title">
              QR-код об’єкта №{qrPoint.number}
              {qrPoint.name ? ` — ${qrPoint.name}` : ""}
            </h3>

            <div className="gz-qr-preview">
              <QRCodeCanvas
                ref={qrCanvasRef}
                value={`${baseUrl}/?point=${encodeURIComponent(qrPoint.id)}`}
                size={256}
              />
            </div>

            <p className="gz-qr-link">
              Посилання: {baseUrl}/?point={qrPoint.id}
            </p>

            <button className="gz-btn-primary" onClick={handleDownloadQr}>
              Завантажити QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapWithImage;
