import { Polyline } from "react-leaflet";

const ActiveRoutePolyline = ({ coords }) => {
  if (!coords || coords.length <= 1) return null;

  return (
    <Polyline positions={coords} color="#ffffff" weight={6} dashArray="6 8" />
  );
};

export default ActiveRoutePolyline;
