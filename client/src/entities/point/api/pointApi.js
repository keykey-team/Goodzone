import { apiBase } from "../../../shared/config/apiBase";

export const fetchPoints = () =>
  fetch(`${apiBase}/goodzone/points`).then((r) => r.json());

export const createPoint = (body) =>
  fetch(`${apiBase}/goodzone/points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export const updatePoint = (id, body) =>
  fetch(`${apiBase}/goodzone/points/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export const deletePoint = (id) =>
  fetch(`${apiBase}/goodzone/points/${id}`, { method: "DELETE" });
