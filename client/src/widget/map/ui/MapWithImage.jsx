import { useState, useEffect, useRef, useMemo, useCallback } from "react";

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
 * Отслеживаем, взаимодействует ли пользователь с картой (drag/zoom/pinch),
 * чтобы не конфликтовать программным pan/fitBounds.
 */
const UseUserInteractingFlag = () => {
  const map = useMap();
  const ref = useRef(false);

  useEffect(() => {
    const onStart = () => (ref.current = true);
    const onEnd = () => (ref.current = false);

    map.on("movestart zoomstart dragstart", onStart);
    map.on("moveend zoomend dragend", onEnd);

    return () => {
      map.off("movestart zoomstart dragstart", onStart);
      map.off("moveend zoomend dragend", onEnd);
    };
  }, [map]);

  return ref;
};

/**
 * Авто-зум по маршруту (с дебаунсом + без конфликтов с жестами)
 */
const RouteAutoZoom = ({ coords, isMobile }) => {
  const map = useMap();
  const interactingRef = UseUserInteractingFlag();

  useEffect(() => {
    if (!coords || coords.length < 2) return;

    // дебаунсим, чтобы не фитить bounds "по шагам"
    const t = setTimeout(() => {
      if (interactingRef.current) return;

      try {
        const routeBounds = L.latLngBounds(coords);
        map.fitBounds(routeBounds, {
          padding: isMobile ? [40, 40] : [80, 80],
          animate: !isMobile,
        });
      } catch (e) {
        console.error("RouteAutoZoom fitBounds error:", e);
      }
    }, 200);

    return () => clearTimeout(t);
  }, [coords, map, isMobile, interactingRef]);

  return null;
};

/**
 * Авто-центровка на выбранную точку (без конфликтов с жестами)
 */
const PointAutoZoom = ({ point, zoom = 1, isMobile }) => {
  const map = useMap();
  const interactingRef = UseUserInteractingFlag();

  useEffect(() => {
    if (!point?.coords) return;
    if (interactingRef.current) return;

    const latlng = L.latLng(point.coords);

    // setView легче, чем panTo + animate
    map.setView(latlng, zoom ?? map.getZoom(), {
      animate: !isMobile,
    });
  }, [point?.id, map, zoom, isMobile, interactingRef]);

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

  // 📱 проверяем мобилу
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // 📍 Границы картинки (мемо, чтобы не пересоздавать)
  const imgBounds = useMemo(() => L.latLngBounds(bounds), []);
  const bottomLeft = imgBounds.getSouthWest();
  const bottomRight = imgBounds.getSouthEast();

  // 📍 Центр — разный для мобилки и десктопа (мемо)
  const initialCenter = useMemo(() => {
    if (!isMobile) return bottomLeft;
    const centerLng = (bottomLeft.lng + bottomRight.lng) / 2;
    return L.latLng(bottomLeft.lat, centerLng);
  }, [isMobile, bottomLeft, bottomRight]);

  const minZoomValue = isMobile ? -4 : -3;

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

  // стабилизируем колбэки (важно для React.memo PointMarker)
  const onSelectPoint = useCallback(
    (p) => model.handleSelectPoint(p),
    [model]
  );

  const handleMovePointWithHistory = useCallback(
    async (point, coords) => {
      setLastMove({
        pointId: point.id,
        prevCoords: point.coords,
      });

      await model.handleMovePoint(point, coords);
    },
    [model]
  );

  const handleBuildRouteAndScroll = useCallback(
    (fromId, toId) => {
      model.handleBuildRoute(fromId, toId);
    },
    [model]
  );

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

  const handleDownloadQr = useCallback(() => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    const namePart = qrPoint?.number || qrPoint?.id || "qr";
    link.href = dataUrl;
    link.download = `point-${namePart}-qr.png`;
    link.click();
  }, [qrPoint]);

  const handleCloseQrModal = useCallback(() => setQrPoint(null), []);

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
          preferCanvas={true}
          // важные оптимизации под мобилки
          zoomAnimation={!isMobile}
          markerZoomAnimation={!isMobile}
          fadeAnimation={!isMobile}
          // UX на мобилке часто лучше так:
          scrollWheelZoom={!isMobile}
          doubleClickZoom={!isMobile ? true : false}
          touchZoom={true}
        >
          <ImageOverlay url={MapImage} bounds={bounds} />

          {/* 👇 Авто-зум по активному маршруту */}
          <RouteAutoZoom
            coords={model.activeRouteCoords}
            isMobile={isMobile}
          />

          {/* 👇 Авто-центровка на точку */}
          <PointAutoZoom
            point={model.selectedPoint}
            zoom={isMobile ? 0 : 1}
            isMobile={isMobile}
          />

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
              onSelect={onSelectPoint}
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
        onSelectPoint={onSelectPoint}
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
