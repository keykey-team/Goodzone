import React, { useEffect, useState, useRef } from "react";

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

  // 👇 для доступа к file input
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

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

  // 👇 helper: чистим ?point из URL
  const clearPointQuery = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("point");
    window.history.replaceState(null, "", url.toString());
  };

  // 👇 единый обработчик закрытия модалки
  const handleClose = () => {
    clearPointQuery();
    onClose();
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
    handleClose();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm("Видалити об’єкт?")) return;
    await fetch(`${apiBase}/points/${point.id}`, { method: "DELETE" });
    onDelete(point.id);
    handleClose();
  };

  // 👇 клик по кнопке "Завантажити фото"
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 👇 отправка файла на сервер
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setUploading(true);
      const res = await fetch(`${apiBase}/upload/image`, {
        method: "POST",
        body: formData, // без Content-Type, его поставит браузер
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "Помилка завантаження файлу");
        return;
      }

      const data = await res.json();
      // Ожидаем, что бек вернёт { url: "/uploads/xxx.webp" }
      if (data.url) {
        setForm((f) => ({ ...f, imageUrl: data.url }));
      }
    } catch (error) {
      console.error(error);
      alert("Помилка під час завантаження файлу");
    } finally {
      setUploading(false);
      // сбросим value, чтобы повторно можно было выбрать тот же файл
      e.target.value = "";
    }
  };

  return (
    <div className="gz-modal-backdrop" onClick={handleClose}>
      <div className="gz-object-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gz-modal-close" onClick={handleClose}>
          ×
        </button>

        <div className="gz-object-content">
          <div className="gz-object-image">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt={form.name} />
            ) : (
              <div className="gz-object-image--empty">Немає фото</div>
            )}

            {isAdmin && (
              <div style={{ marginTop: "8px" }}>
                {/* скрытый инпут для выбора файла */}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  className="gz-btn-secondary"
                  onClick={handleUploadClick}
                  disabled={uploading}
                >
                  {uploading ? "Завантаження..." : "Завантажити фото"}
                </button>
              </div>
            )}
          </div>

          <div className="gz-object-text">
            <div className="gz-object-header">
              <div className="gz-object-label">ОБ’ЄКТ №{point.number}</div>

              {isAdmin ? (
                <input
                  name="name"
                  className="gz-input gz-object-name-input"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Назва об’єкта"
                />
              ) : (
                <div className="gz-object-name">{form.name}</div>
              )}
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
