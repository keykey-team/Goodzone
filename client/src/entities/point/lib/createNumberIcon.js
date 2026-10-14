import L from "leaflet";

// Кеш иконок, чтобы не создавать divIcon заново для каждого рендера
// key: `${number}|${active ? 1 : 0}|${type}`
const iconCache = new Map();

export const createNumberIcon = (number, active, type) => {
  const key = `${number ?? ""}|${active ? 1 : 0}|${type ?? ""}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    className: [
      "marker-number",
      active && "marker-number--active",
      type === "shelter" && "marker-number--shelter",
    ]
      .filter(Boolean)
      .join(" "),
    html: `<div class="marker-number__circle"><span>${number ?? ""}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  iconCache.set(key, icon);
  return icon;
};
