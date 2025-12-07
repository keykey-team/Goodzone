// src/entities/point/ui/PointMarker.jsx
import { Marker } from "react-leaflet";
import { createNumberIcon } from "../lib/createNumberIcon";

const PointMarker = ({ point, isActive, isDraggable, onSelect, onMove }) => {
  return (
    <Marker
      position={point.coords}
      icon={createNumberIcon(point.number, isActive)}
      draggable={isDraggable}
      eventHandlers={{
        click: () => onSelect && onSelect(point),
        dragend: (e) => {
          if (!isDraggable || !onMove) return;
          const { lat, lng } = e.target.getLatLng();
          onMove(point, [lat, lng]);
        },
      }}
    />
  );
};

export default PointMarker;
