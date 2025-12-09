import { useState, useEffect, useRef } from "react";

import { MapContainer, ImageOverlay, FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import L from "leaflet";
import { QRCodeCanvas } from "qrcode.react";

import PointMarker from "../../../entities/point/ui/PointMarker";
import ActiveRoutePolyline from "../../../features/map-build-route/ui/ActiveRoutePoline";

import AutoFitBounds from "../../../shared/ui/AutoFitBounds";
import PlaceModal from "../../../features/point-manage/ui/PlaceModal";
import QrSidebar from "../../map-sidebar/ui/QrSidebar";
import RouteCreateModal from "../../../features/route-create/ui/RouteCreateModal";
import RouteChoiceModal from "../../../features/map-route-choice/ui/RouteChoiceModal";
import RouteEditModal from "../../../features/route-edit/ui/RouteEditModal";
import MapImage from "../../../assets/IMG_4378.JPG";
import { bounds } from "../config/mapConfig";
import AddPointController from "../../../features/map-add-point/ui/AddPointController";
import { RoutePolyline } from "../../../entities/route/ui/RoutePoline";
import { useMapWithImageModel } from "../model/useMapWithImageModel";

const MapWithImage = ({ mode = "user" }) => {
  const model = useMapWithImageModel({ mode });

  // 👉 состояние для модалки с большим QR
  const [qrPoint, setQrPoint] = useState(null);
  const qrCanvasRef = useRef(null);

  // реф на карточку с картой — для scrollIntoView
  const mapCardRef = useRef(null);
  // реф на экземпляр Leaflet-карты — для fitBounds
  const mapRef = useRef(null);

  // Базовый URL сайта (для ссылок в QR)
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

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

  // обёртка над построением маршрута: строим + скроллим к карте
  const handleBuildRouteAndScroll = (fromId, toId) => {
    model.handleBuildRoute(fromId, toId);

    if (mapCardRef.current) {
      mapCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  };

  // когда появились coords активного маршрута — приблизиться к ним
  useEffect(() => {
    if (!mapRef.current) return;
    const coords = model.activeRouteCoords;

    if (!coords || coords.length < 2) return;

    try {
      const routeBounds = L.latLngBounds(coords);
      mapRef.current.fitBounds(routeBounds, { padding: [40, 40] });
    } catch (e) {
      console.error("Failed to fit bounds for active route", e);
    }
  }, [model.activeRouteCoords]);

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

  return (
    <div className="gz-layout">
      <div className="gz-map-card" ref={mapCardRef}>
        <MapContainer
          whenCreated={(mapInstance) => {
            mapRef.current = mapInstance;
          }}
          crs={L.CRS.Simple}
          bounds={bounds}
          style={{ width: "100%", height: "100%" }}
          className={
            model.addPointMode ? "leaflet-map add-point-mode" : "leaflet-map"
          }
          maxBounds={bounds}
          maxBoundsViscosity={1.0}
          minZoom={-3}
          maxZoom={4}
          zoom={-3}
        >
          <ImageOverlay url={MapImage} bounds={bounds} />
          <AutoFitBounds bounds={bounds} />

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
              onMove={model.handleMovePoint}
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
        // 👇 новый проп: открыть модалку с большим QR
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
