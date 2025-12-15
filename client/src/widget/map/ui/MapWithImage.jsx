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
import PlaceModal from "../../../features/point-manage/ui/PlaceModal";
import QrSidebar from "../../map-sidebar/ui/QrSidebar";
import RouteCreateModal from "../../../features/route-create/ui/RouteCreateModal";
import RouteChoiceModal from "../../../features/map-route-choice/ui/RouteChoiceModal";
import RouteEditModal from "../../../features/route-edit/ui/RouteEditModal";
import MapImage from "../../../assets/goodzoneMap8.jpg";
import { bounds } from "../config/mapConfig";
import AddPointController from "../../../features/map-add-point/ui/AddPointController";
import { RoutePolyline } from "../../../entities/route/ui/RoutePoline";
import { useMapWithImageModel } from "../model/useMapWithImageModel";

const MarkerScaleByZoom = () => {
  const map = useMap();

  useEffect(() => {
    const apply = () => {
      const z = map.getZoom();

      const scale =
        z <= -4 ? 0.4 :
          z <= -3 ? 0.65 :
            z <= -2 ? 0.8 :
              1;

      const el = map.getContainer();
      el.style.setProperty("--marker-scale", String(scale));
    };

    apply();
    map.on("zoomend", apply);
    return () => map.off("zoomend", apply);
  }, [map]);

  return null;
};


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
 * Центровка на выбранную точку:
 * - НЕ увеличиваем зум (чтобы не было резкого приближения)
 * - можно ограничить максимум зума, если вдруг текущий слишком большой
 */
const PointAutoZoom = ({ point, isMobile, maxZoomOnSelect = 0 }) => {
  const map = useMap();
  const interactingRef = UseUserInteractingFlag();

  useEffect(() => {
    if (!point?.coords) return;
    if (interactingRef.current) return;

    const latlng = L.latLng(point.coords);

    // оставляем текущий зум, но не выше maxZoomOnSelect
    const currentZoom = map.getZoom();
    const nextZoom =
      typeof maxZoomOnSelect === "number"
        ? Math.min(currentZoom, maxZoomOnSelect)
        : currentZoom;

    map.setView(latlng, nextZoom, {
      animate: !isMobile,
    });
  }, [point?.id, map, isMobile, maxZoomOnSelect, interactingRef]);

  return null;
};

const MapWithImage = ({ mode = "user" }) => {
  const model = useMapWithImageModel({ mode });

  const [qrPoint, setQrPoint] = useState(null);
  const qrCanvasRef = useRef(null);

  const [lastMove, setLastMove] = useState(null);
  const mapCardRef = useRef(null);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const imgBounds = useMemo(() => L.latLngBounds(bounds), []);
  const bottomLeft = imgBounds.getSouthWest();
  const bottomRight = imgBounds.getSouthEast();

  const initialCenter = useMemo(() => {
    if (!isMobile) return bottomLeft;
    const centerLng = (bottomLeft.lng + bottomRight.lng) / 2;
    return L.latLng(bottomLeft.lat, centerLng);
  }, [isMobile, bottomLeft, bottomRight]);

  const minZoomValue = isMobile ? -4 : -3;

  // ✅ уменьшаем максимальный зум
  const maxZoomValue = isMobile ? -1.5 : -1.5;

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

  const onSelectPoint = useCallback((p) => model.handleSelectPoint(p), [model]);

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

  useEffect(() => {
    const coords = model.activeRouteCoords;
    if (!coords || coords.length < 2) return;
    if (!mapCardRef.current) return;

    mapCardRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [model.activeRouteCoords]);

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
          maxZoom={maxZoomValue}
          preferCanvas={true}
          zoomAnimation={!isMobile}
          markerZoomAnimation={!isMobile}
          fadeAnimation={!isMobile}
          scrollWheelZoom={!isMobile}
          doubleClickZoom={!isMobile}
          touchZoom={true}
          updateWhenZooming={false}
          updateWhenIdle={true}
        >
          <ImageOverlay url={MapImage} bounds={bounds} />
          <MarkerScaleByZoom />
          <RouteAutoZoom coords={model.activeRouteCoords} isMobile={isMobile} />

          {/* ✅ При выборе точки НЕ зумим, только центрируем.
              maxZoomOnSelect можно поставить -1/0/1 как тебе комфортно */}
          <PointAutoZoom
            point={model.selectedPoint}
            isMobile={isMobile}
            maxZoomOnSelect={0}
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

          <ActiveRoutePolyline coords={model.activeRouteCoords} />
        </MapContainer>

        {model.isAdmin && (
          <div className="gz-toolbar">
            <button
              className={`gz-tool-btn ${model.addPointMode ? "active" : ""}`}
              onClick={model.toggleAddPointMode}
            >
              Додати об&apos;єкт
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
