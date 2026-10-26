import React, { useEffect, useMemo, useRef, useState } from "react";

import { apiBase } from "../../../shared/config/apiBase";
import Cross from "../../../shared/ui/Cross";
import GoodZoneImg from "../../../assets/goodzone.png";
import GoodZoneImgArrow from "../../../assets/external-link-svgrepo-com.svg";
import GoodZoneLogo from "../../../assets/logo-title.svg";

/**
 * ⚠️ API-домен, где реально лежат /uploads
 * если у тебя только http — замени на http
 */
const API_ORIGIN = "https://map.goodzonehotel.com.ua";

/**
 * Превращает imageUrl из базы в корректный src
 */
function resolveImageSrc(imageUrl) {
  if (!imageUrl) return "";

  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/uploads/")) return `${API_ORIGIN}${imageUrl}`;
  if (imageUrl.startsWith("/")) return `${API_ORIGIN}${imageUrl}`;

  return `${API_ORIGIN}/${imageUrl}`;
}

/** =========================
 *  TAGS UTILS (chips)
 *  ========================= */
const normalizeTag = (v) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ");

const uniqTags = (arr) => {
  const set = new Set();

  (arr || []).forEach((t) => {
    const nt = normalizeTag(t);
    if (!nt) return;
    set.add(nt);
  });

  return Array.from(set);
};

/** =========================
 *  NUMBER UTILS (unique check)
 *  ========================= */
const normalizeBaseNumber = (v) =>
  String(v ?? "").replace(/[^\d]/g, "").trim();

const isSamePoint = (a, b) => String(a?.id) === String(b?.id);

async function fetchPointsSafe() {
  try {
    const res = await fetch(`${apiBase}/goodzone/points`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function getInitialForm(point) {
  const initialTags = uniqTags(
    Array.isArray(point?.manualSearchingTags) ? point.manualSearchingTags : []
  );

  const pointNumberStr = String(point?.number ?? "");
  const baseFromDb = normalizeBaseNumber(pointNumberStr);

  return {
    number: baseFromDb || "",
    name: point?.name || "",
    description: point?.description || "",
    workingHours: point?.workingHours || "",
    locationText: point?.locationText || "",
    type: point?.type || "",
    imageUrl: point?.imageUrl || "",
    manualSearchingTags: initialTags,
    link: point?.link || "",
  };
}

const PlaceModal = ({
  open,
  point,
  isAdmin,
  onClose,
  onSave,
  onDelete,
  onRouteFromReception,
}) => {
  const [form, setForm] = useState(() => getInitialForm(point));

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const [tagInput, setTagInput] = useState("");

  const [allPoints, setAllPoints] = useState([]);
  const [pointsLoaded, setPointsLoaded] = useState(false);

  const [numberTouched, setNumberTouched] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  /** =========================
   *  MEMO
   *  ========================= */
  const baseNumber = useMemo(
    () => normalizeBaseNumber(form.number),
    [form.number]
  );

  const conflictPoint = useMemo(() => {
    if (!baseNumber) return null;
    if (!point) return null;

    return (allPoints || []).find((p) => {
      if (isSamePoint(p, point)) return false;
      return String(p.number ?? "").trim() === baseNumber;
    });
  }, [allPoints, baseNumber, point]);

  const numberError = useMemo(() => {
    if (!isAdmin) return "";
    if (numberTouched && !baseNumber) return "Вкажіть номер об’єкта";

    if (conflictPoint) {
      return `Номер ${baseNumber} вже використовується: ОБ’ЄКТ №${conflictPoint.number} — “${conflictPoint.name}”. Виберіть інший номер.`;
    }

    return "";
  }, [isAdmin, numberTouched, baseNumber, conflictPoint]);

  const canSave = useMemo(() => {
    if (!isAdmin) return false;
    if (!pointsLoaded) return false;
    if (!baseNumber) return false;
    if (conflictPoint) return false;
    return true;
  }, [isAdmin, pointsLoaded, baseNumber, conflictPoint]);

  const currentImageUrl = form.imageUrl || point?.imageUrl || "";
  const resolvedImageSrc = currentImageUrl
    ? resolveImageSrc(currentImageUrl)
    : "";
  const imageKey = `${point?.id || "no-point"}-${resolvedImageSrc || "fallback"}`;

  /** =========================
   *  EFFECTS
   *  ========================= */

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!open) return;
      setPointsLoaded(false);
      const pts = await fetchPointsSafe();
      if (!alive) return;
      setAllPoints(Array.isArray(pts) ? pts : []);
      setPointsLoaded(true);
    })();

    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!point) return;

    setForm(getInitialForm(point));
    setTagInput("");
    setNumberTouched(false);
  }, [point]);

  useEffect(() => {
    if (!open) return;

    if (resolvedImageSrc) {
      setImageLoading(true);
    } else {
      setImageLoading(false);
    }
  }, [open, imageKey, resolvedImageSrc]);

  if (!open || !point) return null;

  /** =========================
   *  handlers
   *  ========================= */
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "number") {
      const onlyDigits = normalizeBaseNumber(value);
      setForm((f) => ({ ...f, number: onlyDigits }));
      return;
    }

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

  const handleOpenConflict = () => {
    if (!conflictPoint?.id) return;

    const url = new URL(window.location.href);
    url.searchParams.set("point", conflictPoint.id);
    window.history.replaceState(null, "", url.toString());
    window.location.reload();
  };

  /** TAGS CHIPS */
  const addTag = (raw) => {
    const t = normalizeTag(raw);
    if (!t) return;

    setForm((f) => ({
      ...f,
      manualSearchingTags: uniqTags([...(f.manualSearchingTags || []), t]),
    }));
  };

  const removeTag = (tag) => {
    setForm((f) => ({
      ...f,
      manualSearchingTags: (f.manualSearchingTags || []).filter((x) => x !== tag),
    }));
  };

  const handleTagKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (tagInput.trim()) {
        e.preventDefault();
        addTag(tagInput);
        setTagInput("");
      }
      return;
    }

    if (e.key === "Backspace" && !tagInput) {
      const last =
        form.manualSearchingTags?.[form.manualSearchingTags.length - 1];
      if (last) removeTag(last);
    }
  };

  const handleTagPaste = (e) => {
    const text = e.clipboardData?.getData("text") || "";
    if (!text) return;

    const parts = text.split(/[,\n;]/g).map(normalizeTag).filter(Boolean);
    if (parts.length <= 1) return;

    e.preventDefault();
    setForm((f) => ({
      ...f,
      manualSearchingTags: uniqTags([...(f.manualSearchingTags || []), ...parts]),
    }));
  };

  /** SAVE */
  const handleSave = async () => {
    setNumberTouched(true);

    if (!canSave) return;

    const body = {
      ...point,
      ...form,
      number: baseNumber,
      manualSearchingTags: Array.isArray(form.manualSearchingTags)
        ? uniqTags(form.manualSearchingTags)
        : [],
    };

    const res = await fetch(`${apiBase}/goodzone/points/${point.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(err);
      return;
    }

    const updatedPoint = await res.json();

    if (typeof onSave === "function") {
      onSave(updatedPoint);
    } else {
      window.location.reload();
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!window.confirm("Видалити об’єкт?")) return;

    await fetch(`${apiBase}/goodzone/points/${point.id}`, { method: "DELETE" });

    onDelete(point.id);
    handleClose();
  };

  /** UPLOAD */
  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      setUploading(true);

      const res = await fetch(`${apiBase}/goodzone/upload/image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error(err);
        return;
      }

      const data = await res.json();
      if (data.url) {
        setForm((f) => ({ ...f, imageUrl: data.url }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="gz-modal-backdrop" onClick={handleClose}>
      <div
        className="gz-object-modal"
        style={{ transform: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="gz-modal-close" onClick={handleClose}>
          <Cross />
        </button>

        <div className="gz-object-content">
          <div className="gz-object-image" style={{ position: "relative" }}>
            {resolvedImageSrc ? (
              <img
                key={imageKey}
                src={resolvedImageSrc}
                alt={form.name || point?.name || "GoodZone"}
                onLoad={() => setImageLoading(false)}
                onError={(e) => {
                  e.currentTarget.src = GoodZoneImg;
                  setImageLoading(false);
                }}
              />
            ) : (
              <img
                key={imageKey}
                src={GoodZoneImg}
                alt="GoodZone"
                onLoad={() => setImageLoading(false)}
              />
            )}

            {imageLoading && (
              <div className="gz-image-loader">
                <img
                  src={GoodZoneLogo}
                  alt="loading"
                  className="gz-logo-loader"
                />
              </div>
            )}

            {isAdmin && (
              <div className="uploading-img-wrapper" style={{ marginTop: 8 }}>
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
              {isAdmin ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    className="gz-object-label"
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    ОБ’ЄКТ №
                    <input
                      name="number"
                      className="gz-input"
                      value={form.number}
                      onChange={handleChange}
                      onBlur={() => setNumberTouched(true)}
                      inputMode="numeric"
                      placeholder="№"
                      style={{ width: 90, padding: "6px 10px" }}
                    />
                  </label>

                  {(!pointsLoaded || numberError) && (
                    <div
                      className="gz-error-text"
                      style={{
                        fontSize: 12,
                        lineHeight: "16px",
                        color: numberError ? "#dc2626" : "#6b7280",
                      }}
                    >
                      {!pointsLoaded ? "Перевіряємо унікальність номера…" : numberError}

                      {conflictPoint && (
                        <button
                          type="button"
                          onClick={handleOpenConflict}
                          style={{
                            marginLeft: 8,
                            border: "none",
                            background: "transparent",
                            color: "#2F6C4F",
                            textDecoration: "underline",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Відкрити
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="gz-object-label">ОБ’ЄКТ №{point.number}</div>
              )}

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
                    />
                  </label>

                  <label className="gz-label">
                    Інформація про точку
                    <input
                      name="link"
                      className="gz-input"
                      value={form.link}
                      onChange={handleChange}
                      placeholder="https://..."
                    />
                  </label>

                  <label className="gz-label">
                    Розташування
                    <textarea
                      name="locationText"
                      className="gz-object-textarea"
                      rows={4}
                      value={form.locationText}
                      onChange={handleChange}
                      placeholder="Опишіть розташування..."
                      style={{ resize: "vertical", marginTop: 6 }}
                    />
                  </label>

                  <label className="gz-label">
                    URL зображення
                    <input
                      name="imageUrl"
                      className="gz-input"
                      value={form.imageUrl}
                      onChange={handleChange}
                      placeholder="/uploads/..."
                    />
                  </label>

                  <label className="gz-label">
                    Слова для пошуку (Enter / “,” щоб додати)
                    <div
                      className="gz-input"
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        alignItems: "center",
                        minHeight: 42,
                        padding: "8px 10px",
                      }}
                      onClick={() =>
                        document.getElementById("gz-tags-input")?.focus()
                      }
                    >
                      {(form.manualSearchingTags || []).map((t) => (
                        <span
                          key={t}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: "rgba(47,108,79,0.12)",
                            fontSize: 12,
                            lineHeight: "16px",
                          }}
                        >
                          {t}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              removeTag(t);
                            }}
                            aria-label="remove tag"
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: 14,
                              lineHeight: "14px",
                              padding: 0,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      <input
                        id="gz-tags-input"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        onPaste={handleTagPaste}
                        placeholder="напр: spa, басейн, ресторан"
                        style={{
                          border: "none",
                          outline: "none",
                          flex: 1,
                          minWidth: 160,
                          background: "transparent",
                          padding: "4px 0",
                        }}
                      />
                    </div>
                  </label>
                </div>

                <div className="gz-object-actions">
                  <button
                    className="gz-btn-primary"
                    onClick={handleSave}
                    disabled={!canSave}
                    style={
                      !canSave ? { opacity: 0.6, cursor: "not-allowed" } : undefined
                    }
                    title={
                      !pointsLoaded
                        ? "Зачекайте, перевіряємо унікальність номера…"
                        : conflictPoint
                          ? "Цей номер вже зайнятий"
                          : !baseNumber
                            ? "Вкажіть номер"
                            : ""
                    }
                  >
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
                    <strong>ЧАС РОБОТИ: </strong>
                    <span>{form.workingHours}</span>
                  </p>
                )}

                {form.link && (
                  <p className="gz-object-line">
                    <a
                      href={form.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="gz-object-link"
                    >
                      ІНФОРМАЦІЯ ПРО ТОЧКУ
                      <img src={GoodZoneImgArrow} alt="" />
                    </a>
                  </p>
                )}

                {form.locationText && (
                  <p className="gz-object-line">
                    <strong>РОЗТАШУВАННЯ: </strong>
                    <span>{form.locationText}</span>
                  </p>
                )}

                {onRouteFromReception && (
                  <button
                    type="button"
                    className="gz-btn-primary gz-object-route-btn"
                    onClick={() => {
                      clearPointQuery();
                      onRouteFromReception();
                    }}
                  >
                    Прокласти найкоротший маршрут з рецепції
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          className="gz-btn-secondary gz-modal-close-mobile"
          onClick={handleClose}
        >
          Закрити
        </button>

        <style>
          {`
            @keyframes gz-spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default PlaceModal;