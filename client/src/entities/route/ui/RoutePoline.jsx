import { Polyline } from "react-leaflet";

export const RoutePolyline = ({ route, isActive, onClick }) => (
  <Polyline
    positions={route.coords}
    weight={isActive ? 6 : 4}
    eventHandlers={onClick ? { click: () => onClick(route) } : undefined}
  />
);
