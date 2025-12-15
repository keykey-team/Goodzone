import L from "leaflet";

// Кеш иконок, чтобы не создавать divIcon заново для каждого рендера
// key: `${number}|${active ? 1 : 0}`
const iconCache = new Map();

export const createNumberIcon = (number, active) => {
  const key = `${number ?? ""}|${active ? 1 : 0}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    className: active
      ? "marker-number marker-number--active"
      : "marker-number",
    html: `<div class="marker-number__circle"><span>${number ?? ""}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  iconCache.set(key, icon);
  return icon;
};
