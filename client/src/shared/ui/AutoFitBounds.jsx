import { useEffect } from "react";
import { useMap } from "react-leaflet";

const AutoFitBounds = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.fitBounds(bounds, { padding: [0, 0], animate: false });
  }, [map, bounds]);

  return null;
};

export default AutoFitBounds;