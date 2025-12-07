import { apiBase } from "../../../shared/config/apiBase";
import { normalizeRoute } from "../model/normalizeRoute";

export const fetchRoutes = () =>
  fetch(`${apiBase}/routes`)
    .then((r) => r.json())
    .then((routes) => routes.map(normalizeRoute));

export const createRoute = (body) =>
  fetch(`${apiBase}/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then(normalizeRoute);

export const deleteRoute = (id) =>
  fetch(`${apiBase}/routes/${id}`, { method: "DELETE" });

export const fetchRoutePath = (fromId, toId) =>
  fetch(`${apiBase}/routes/path?fromId=${fromId}&toId=${toId}`).then((r) =>
    r.json()
  );
