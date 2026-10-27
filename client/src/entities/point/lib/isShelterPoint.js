import { SHELTER_POINT_TYPE } from "../config/pointMarker.config";

export const isShelterPoint = (point) => point?.type === SHELTER_POINT_TYPE;
