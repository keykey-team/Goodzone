import React, { useState, useEffect } from "react";

const RouteCreateModal = ({ open, points, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [startPointId, setStartPointId] = useState("");
  const [endPointId, setEndPointId] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
      setStartPointId("");
      setEndPointId("");
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !startPointId || !endPointId) return;
    onSave({
      name,
      fromPointId: startPointId,
      toPointId: endPointId,
    });

    onClose();
  };

  return (
    <div className="gz-modal-backdrop" onClick={onClose}>
      <div className="gz-route-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gz-modal-close" onClick={onClose}>
          ×
        </button>
        <h3 className="gz-route-modal-title">Новий маршрут</h3>
        <form onSubmit={handleSubmit}>
          <label className="gz-label">
            Назва маршруту
            <input
              className="gz-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, від котеджів до пляжу"
            />
          </label>
          <label className="gz-label">
            Звідки
            <select
              className="gz-input"
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
          </label>
          <label className="gz-label">
            Куди
            <select
              className="gz-input"
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
