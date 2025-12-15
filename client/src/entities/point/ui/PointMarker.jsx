import React, { memo, useMemo, useRef } from "react";
import { Marker } from "react-leaflet";
import { createNumberIcon } from "../lib/createNumberIcon";


const PointMarker = ({ point, isActive, isDraggable, onSelect, onMove }) => {
  const icon = useMemo(() => {
    return createNumberIcon(point.number, isActive);
  }, [point.number, isActive]);

  const lastCoordsRef = useRef(point.coords);

  const eventHandlers = useMemo(
    () => ({
      click: () => {
        if (onSelect) onSelect(point);
      },

      dragend: (e) => {
        if (!isDraggable || !onMove) return;

        const { lat, lng } = e.target.getLatLng();
        const next = [lat, lng];

        // маленькая защита от микродрожания координат
        const prev = lastCoordsRef.current;
        const eps = 1e-9;
        const changed =
          !prev ||
          Math.abs(prev[0] - next[0]) > eps ||
          Math.abs(prev[1] - next[1]) > eps;

        if (!changed) return;

        lastCoordsRef.current = next;
        onMove(point, next);
      },
    }),
    [onSelect, onMove, isDraggable, point]
  );

  return (
    <Marker
      position={point.coords}
      icon={icon}
      draggable={isDraggable}
      eventHandlers={eventHandlers}
      // По желанию: если используешь клавиатуру/фокус — можно оставить
      // keyboard={false}
    />
  );
};


function areEqual(prev, next) {
  const p1 = prev.point;
  const p2 = next.point;

  const coordsEqual =
    (p1.coords === p2.coords) ||
    (Array.isArray(p1.coords) &&
      Array.isArray(p2.coords) &&
      p1.coords[0] === p2.coords[0] &&
      p1.coords[1] === p2.coords[1]);

  return (
    coordsEqual &&
    p1.number === p2.number &&
    prev.isActive === next.isActive &&
    prev.isDraggable === next.isDraggable
  );
}

export default memo(PointMarker, areEqual);
