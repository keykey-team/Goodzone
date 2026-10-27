import L from "leaflet";
import {
  SHELTER_PIN_HEIGHT_PX,
  SHELTER_PIN_WIDTH_PX,
} from "../config/pointMarker.config";

// Кеш иконок, чтобы не создавать divIcon заново для каждого рендера
// key: `${number}|${active ? 1 : 0}`
const shelterPinIconCache = new Map();

const buildShelterPinSvg = (number) => `
  <svg class="marker-pin__shape" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
    <path class="marker-pin__body" d="M12 1C5.9 1 1 5.9 1 12c0 8.3 11 19 11 19s11-10.7 11-19C23 5.9 18.1 1 12 1z" />
    <circle class="marker-pin__badge" cx="12" cy="12" r="7.5" />
    <text class="marker-pin__number" x="12" y="12" text-anchor="middle" dominant-baseline="central">${number ?? ""}</text>
  </svg>
`;

export const createShelterPinIcon = (number, isActive) => {
  const cacheKey = `${number ?? ""}|${isActive ? 1 : 0}`;
  const cachedIcon = shelterPinIconCache.get(cacheKey);
  if (cachedIcon) return cachedIcon;

  const icon = L.divIcon({
    className: ["marker-pin", isActive && "marker-pin--active"]
      .filter(Boolean)
      .join(" "),
    html: buildShelterPinSvg(number),
    iconSize: [SHELTER_PIN_WIDTH_PX, SHELTER_PIN_HEIGHT_PX],
    // Остриё пина (низ по центру) указывает ровно в координату точки
    iconAnchor: [SHELTER_PIN_WIDTH_PX / 2, SHELTER_PIN_HEIGHT_PX],
  });

  shelterPinIconCache.set(cacheKey, icon);
  return icon;
};
