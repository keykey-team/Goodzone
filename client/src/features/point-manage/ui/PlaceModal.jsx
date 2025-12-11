import React, { useEffect, useState, useRef } from "react";

import { apiBase } from "../../../shared/config/apiBase";
import Cross from "../../../shared/ui/Cross";

const PlaceModal = ({ open, point, isAdmin, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    workingHours: "",
    locationText: "",
    type: "",
    imageUrl: "",
  });

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (point) {
      setForm({
        name: point.name || "Локація комплексу",
        description:
          point.description ||
          "Затишна локація на території комплексу. Тут можна відпочити, провести час з родиною або зробити гарні фото.",
        workingHours: point.workingHours || "Щодня 09:00 – 22:00",
        locationText: point.locationText || "Центральна частина комплексу",
        type: point.type || "",
        imageUrl:
          point.imageUrl ||
          "https://placehold.co/600x400/eee/ccc?text=Фото+тимчасово+відсутнє",
      });
    }
  }, [point]);

  if (!open || !point) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const clearPointQuery = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("point");
    window.history.replaceState(null, "", url.toString());
  };

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

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setUploading(true);
      const res = await fetch(`${apiBase}/upload/image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.message || "Помилка завантаження файлу");
        return;
      }

      const data = await res.json();
      if (data.url) {
        setForm((f) => ({ ...f, imageUrl: data.url }));
      }
    } catch (error) {
      console.error(error);
      alert("Помилка під час завантаження файлу");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="gz-modal-backdrop" onClick={handleClose}>
      <div className="gz-object-modal"  style={{ transform: "none" }} onClick={(e) => e.stopPropagation()}>
        <button className="gz-modal-close" onClick={handleClose}>
          <Cross />
        </button>

        <div className="gz-object-content">
          <div className="gz-object-image">
            {form.imageUrl ? (
              <img src={form.imageUrl} alt={form.name} />
            ) : (
              <div className="gz-object-image--empty">Немає фото</div>
            )}

            {isAdmin && (
              <div
                className="uploading-img-wrapper"
                style={{ marginTop: "8px" }}
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  onChange={handleFileChange}
                />

                <button
                  type="button"
                  className="gz-upload-btn"
                  onClick={handleUploadClick}
                  disabled={uploading}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="18"
                    viewBox="0 0 16 18"
                    fill="none"
                  >
                    <path
                      d="M14.1311 9.5188L8.47863 15.1128C6.92877 16.6466 4.46724 16.6466 3.00855 15.1128C1.45869 13.5789 1.45869 11.1429 3.00855 9.69925L10.302 2.4812C11.2137 1.66917 12.5812 1.66917 13.4929 2.4812C14.4046 3.38346 14.4046 4.82707 13.4929 5.6391L7.20228 11.8647C6.92878 12.1353 6.47293 12.1353 6.19943 11.8647C5.92593 11.594 5.92593 11.1429 6.19943 10.8722L10.849 6.27068C11.2137 5.90978 11.2137 5.36842 10.849 5.00752C10.4843 4.64662 9.93732 4.64662 9.57265 5.00752L4.92308 9.69925C3.92023 10.6917 3.92023 12.2256 4.92308 13.218C5.92593 14.1203 7.47578 14.1203 8.47863 13.218L14.7692 6.99248C16.4103 5.36842 16.4103 2.84211 14.7692 1.21805C13.1282 -0.406015 10.5755 -0.406015 8.93447 1.21805L1.64103 8.43609C0.547009 9.5188 0 10.9624 0 12.406C0 15.5639 2.55271 18 5.74359 18C7.29345 18 8.66097 17.3684 9.75499 16.3759L15.4074 10.782C15.7721 10.4211 15.7721 9.8797 15.4074 9.5188C15.0427 9.1579 14.4957 9.1579 14.1311 9.5188Z"
                      fill="#2F6C4F"
                    />
                  </svg>
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
                <p className="gz-object-desc">{form.description}</p>

                <p className="gz-object-line">
                  <strong>ЧАС РОБОТИ: </strong>
                  <span>{form.workingHours}</span>
                </p>

                <p className="gz-object-line">
                  <strong>РОЗТАШУВАННЯ: </strong>
                  <span>{form.locationText}</span>
                </p>
              </>
            )}
          </div>
        </div>

        {/* Мобильная кнопка "Закрити" (показывается только на мобиле через CSS) */}
        <button
          type="button"
          className="gz-btn-secondary gz-modal-close-mobile"
          onClick={handleClose}
        >
          Закрити
        </button>
      </div>
    </div>
  );
};

export default PlaceModal;
