import React, { useEffect, useState } from "react";

const apiBase = "http://localhost:4000/api";

const PlaceModal = ({ open, point, isAdmin, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    workingHours: "",
    locationText: "",
    type: "",
    imageUrl: "",
  });

  useEffect(() => {
    if (point) {
      setForm({
        name: point.name || "",
        description: point.description || "",
        workingHours: point.workingHours || "",
        locationText: point.locationText || "",
        type: point.type || "",
        imageUrl: point.imageUrl || "",
      });
    }
  }, [point]);

  if (!open || !point) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSave = async () => {
    const body = { ...point, ...form };
    const res = await fetch(`${apiBase}/points/${point.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const updated = await res.json();
    onSave(updated);
    onClose();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm("Видалити об’єкт?")) return;
    await fetch(`${apiBase}/points/${point.id}`, { method: "DELETE" });
    onDelete(point.id);
    onClose();
  };

  return (
    <div className="gz-modal-backdrop" onClick={onClose}>
      <div className="gz-object-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gz-modal-close" onClick={onClose}>
          ×
        </button>

        <div className="gz-object-content">
          <div className="gz-object-image">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt={form.name} />
            ) : (
              <div className="gz-object-image--empty">Немає фото</div>
            )}
          </div>

          <div className="gz-object-text">
            <div className="gz-object-header">
              <div className="gz-object-label">ОБ’ЄКТ №{point.number}</div>
              <div className="gz-object-name">{form.name}</div>
            </div>

            {isAdmin ? (
              <>
                <textarea
                  name="description"
                  className="gz-object-textarea"
                  rows={4}
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Опис об’єкту"
                />
                <div className="gz-object-fields">
                  <label className="gz-label">
                    Час роботи
                    <input
                      name="workingHours"
                      className="gz-input"
                      value={form.workingHours}
                      onChange={handleChange}
                      placeholder="Щодня 09:00–22:00"
                    />
                  </label>
                  <label className="gz-label">
                    Розташування
                    <input
                      name="locationText"
                      className="gz-input"
                      value={form.locationText}
                      onChange={handleChange}
                      placeholder="Наприклад, біля головного корпусу"
                    />
                  </label>
                  <label className="gz-label">
                    URL зображення
                    <input
                      name="imageUrl"
                      className="gz-input"
                      value={form.imageUrl}
                      onChange={handleChange}
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <div className="gz-object-actions">
                  <button className="gz-btn-primary" onClick={handleSave}>
                    ЗБЕРЕГТИ
                  </button>
                  <button className="gz-btn-danger" onClick={handleDelete}>
                    ВИДАЛИТИ
                  </button>
                </div>
              </>
            ) : (
              <>
                {form.description && (
                  <p className="gz-object-desc">{form.description}</p>
                )}
                {form.workingHours && (
                  <p className="gz-object-line">
                    <strong>ЧАС РОБОТИ</strong> {form.workingHours}
                  </p>
                )}
                {form.locationText && (
                  <p className="gz-object-line">
                    <strong>РОЗТАШУВАННЯ</strong> {form.locationText}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlaceModal;