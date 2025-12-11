import React, { useState, useEffect } from "react";
import Cross from "../../../shared/ui/Cross";

const RouteCreateModal = ({ open, points, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [startPointId, setStartPointId] = useState("");
  const [endPointId, setEndPointId] = useState("");

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) {
      setName("");
      setStartPointId("");
      setEndPointId("");
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const validate = () => {
    const newErrors = {};

    if (!name.trim()) newErrors.name = "Вкажіть назву маршруту";
    if (!startPointId) newErrors.start = "Оберіть початкову точку";
    if (!endPointId) newErrors.end = "Оберіть кінцеву точку";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) return;

    onSave({
      name,
      fromPointId: startPointId,
      toPointId: endPointId,
    });

    alert("Маршрут успішно створений!");
    onClose();
  };

  return (
    <div className="gz-modal-backdrop" onClick={onClose}>
      <div className="gz-route-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gz-modal-close" onClick={onClose}>
          <Cross />
        </button>

        <h3 className="gz-route-modal-title">Новий маршрут</h3>

        <form onSubmit={handleSubmit}>
          <label className="gz-label">
            Назва маршруту
            <input
              className={`gz-input ${errors.name ? "gz-input-error" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, від котеджів до пляжу"
            />
            {errors.name && (
              <div className="gz-error-text">{errors.name}</div>
            )}
          </label>

          <label className="gz-label">
            Звідки
            <select
              className={`gz-input ${errors.start ? "gz-input-error" : ""}`}
              value={startPointId}
              onChange={(e) => setStartPointId(e.target.value)}
            >
              <option value="">Оберіть об’єкт</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} — {p.name}
                </option>
              ))}
            </select>
            {errors.start && (
              <div className="gz-error-text">{errors.start}</div>
            )}
          </label>

          <label className="gz-label">
            Куди
            <select
              className={`gz-input ${errors.end ? "gz-input-error" : ""}`}
              value={endPointId}
              onChange={(e) => setEndPointId(e.target.value)}
            >
              <option value="">Оберіть об’єкт</option>
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} — {p.name}
                </option>
              ))}
            </select>
            {errors.end && (
              <div className="gz-error-text">{errors.end}</div>
            )}
          </label>

          <button
            type="submit"
            className="gz-btn-primary"
            style={{ width: "100%", marginTop: 8 }}
          >
            ЗБЕРЕГТИ МАРШРУТ
          </button>
        </form>
      </div>
    </div>
  );
};

export default RouteCreateModal;
