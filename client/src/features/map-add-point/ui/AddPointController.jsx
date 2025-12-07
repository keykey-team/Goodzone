import { useEffect } from "react";
import { useMapEvents } from "react-leaflet";

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

export default AddPointController;
