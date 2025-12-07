import React, { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const QrSidebar = ({
  isAdmin,
  points,
  selectedPoint,
  onSelectPoint,
  routeFromId,
  routeToId,
  onChangeRouteFrom,
  onChangeRouteTo,
  onBuildRoute,
  addPointMode,
  onToggleAddPointMode,
}) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return points;
    return points.filter(
      (p) =>
        String(p.number).includes(q) ||
        (p.name || "").toLowerCase().includes(q)
    );
  }, [search, points]);

  const handleBuildClick = () => {
    onBuildRoute(routeFromId, routeToId);
  };

  return (
    <aside className="gz-sidebar">
      {/* хедер */}
      <div className="gz-side-header">
        <div className="gz-logo-circle">GZ</div>
        <div>
          <div className="gz-logo-title">GOOD ZONE</div>
          <div className="gz-logo-sub">
            {isAdmin ? "Адмін панель" : "Навігація по комплексу"}
          </div>
        </div>
      </div>

      {/* блок объектов */}
      <section className="gz-side-section">
        <h3 className="gz-side-title">Об’єкти комплексу</h3>
        <div className="gz-search">
          <span className="gz-search-icon">🔍</span>
          <input
            className="gz-search-input"
            placeholder="Пошук за назвою, або номером"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="gz-objects-list">
          {filtered.map((p) => (
            <button
              key={p.id}
              className={
                selectedPoint?.id === p.id
                  ? "gz-object-item gz-object-item--active"
                  : "gz-object-item"
              }
              onClick={() => onSelectPoint(p)}
            >
              <span className="gz-object-num">{p.number}</span>
              <span className="gz-object-name">{p.name}</span>

              {isAdmin && (
                <span className="gz-object-qr">
                  <QRCodeCanvas value={p.id} size={32} />
                </span>
              )}
            </button>
          ))}
        </div>

        <button className="gz-show-all">Показати всі об’єкти</button>

        {/* кнопка для админа: режим добавления точек */}
        {isAdmin && (
          <button
            type="button"
            className={
              addPointMode
                ? "gz-route-btn gz-route-btn--secondary"
                : "gz-route-btn"
            }
            style={{ marginTop: 10 }}
            onClick={onToggleAddPointMode}
          >
            {addPointMode ? "Режим додавання точок: УВІМКНЕНО" : "Режим додавання точок"}
          </button>
        )}
      </section>

      {/* блок "Маршрут" только для пользователя */}
      {!isAdmin && (
        <section className="gz-side-section gz-route-section">
          <h3 className="gz-side-title">Маршрут</h3>

          <label className="gz-label">Звідки ви йдете</label>
          <select
            className="gz-select"
            value={routeFromId}
            onChange={(e) => onChangeRouteFrom(e.target.value)}
          >
            <option value="">Оберіть об’єкт</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} — {p.name}
              </option>
            ))}
          </select>

          <label className="gz-label">Куди потрібно потрапити</label>
          <select
            className="gz-select"
            value={routeToId}
            onChange={(e) => onChangeRouteTo(e.target.value)}
          >
            <option value="">Оберіть об’єкт</option>
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.number} — {p.name}
              </option>
            ))}
          </select>

          <button className="gz-route-btn" onClick={handleBuildClick}>
            ПРОКЛАСТИ МАРШРУТ
          </button>
        </section>
      )}
    </aside>
  );
};

export default QrSidebar;