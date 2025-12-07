import { apiBase } from "../../../shared/config/apiBase";

export const fetchPoints = () =>
  fetch(`${apiBase}/points`).then((r) => r.json());

export const createPoint = (body) =>
  fetch(`${apiBase}/points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export const updatePoint = (id, body) =>
  fetch(`${apiBase}/points/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

export const deletePoint = (id) =>
  fetch(`${apiBase}/points/${id}`, { method: "DELETE" });
