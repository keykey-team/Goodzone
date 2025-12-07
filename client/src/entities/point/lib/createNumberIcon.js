import L from "leaflet";

export const createNumberIcon = (number, active) =>
  L.divIcon({
    className: active ? "marker-number marker-number--active" : "marker-number",
    html: `<div class="marker-number__circle"><span>${number}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });