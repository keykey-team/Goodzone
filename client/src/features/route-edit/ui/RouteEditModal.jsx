// src/RouteEditModal.jsx
import React, { useEffect, useState } from "react";
import Cross from "../../../shared/ui/Cross";

const apiBase = "http://localhost:4000/api";

const RouteEditModal = ({
  open,
  route,
  points,
  onClose,
  onUpdated,
  onDeleted,
}) => {
  const [form, setForm] = useState({
    name: "",
    fromPointId: "",
    toPointId: "",
  });

  useEffect(() => {
    if (route) {
      setForm({
        name: route.name || "",
        fromPointId: route.fromPointId || "",
        toPointId: route.toPointId || "",
      });
    }
  }, [route]);

  if (!open || !route) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`${apiBase}/goodzone/routes/${route.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        console.error("Route update failed", await res.text());
        return;
      }

      const updated = await res.json();
      onUpdated(updated);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Видалити маршрут?")) return;
    try {
      const res = await fetch(`${apiBase}/goodzone/routes/${route.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Route delete failed", await res.text());
        return;
      }
      onDeleted(route.id);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="gz-modal-backdrop" onClick={onClose}>
      <div className="gz-route-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gz-modal-close" onClick={onClose}>
          <Cross />
        </button>
        <h3 className="gz-route-modal-title">Маршрут #{route.id}</h3>

        <label className="gz-label">
          Назва маршруту
          <input
            name="name"
            className="gz-input"
            value={form.name}
            onChange={handleChange}
            placeholder="Наприклад, від котеджів до пляжу"
          />
        </label>

        <label className="gz-label">
          Звідки
          <select
            name="fromPointId"
            className="gz-input"
            value={form.fromPointId}
            onChange={handleChange}
          >
            <option value="">Оберіть об’єкт</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} — {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="gz-label">
          Куди
          <select
            name="toPointId"
            className="gz-input"
            value={form.toPointId}
            onChange={handleChange}
          >
            <option value="">Оберіть об’єкт</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} — {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="gz-object-actions">
          <button className="gz-btn-primary" onClick={handleSave}>
            ЗБЕРЕГТИ
          </button>
          <button className="gz-btn-danger" onClick={handleDelete}>
            ВИДАЛИТИ
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteEditModal;
