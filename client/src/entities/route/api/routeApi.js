import { apiBase } from "../../../shared/config/apiBase";
import { normalizeRoute } from "../model/normalizeRoute";

export const fetchRoutes = () =>
  fetch(`${apiBase}/goodzone/routes`)
    .then((r) => r.json())
    .then((routes) => routes.map(normalizeRoute));

export const createRoute = (body) =>
  fetch(`${apiBase}/goodzone/routes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => r.json())
    .then(normalizeRoute);

export const deleteRoute = (id) =>
  fetch(`${apiBase}/goodzone/routes/${id}`, { method: "DELETE" });

export const fetchRoutePath = (fromId, toId) =>
  fetch(`${apiBase}/goodzone/routes/path?fromId=${fromId}&toId=${toId}`).then((r) =>
    r.json()
  );
