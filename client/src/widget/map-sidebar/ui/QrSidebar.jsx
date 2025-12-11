import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import logoImg from "../../../assets/logo.png";
import SearchIcon from "../../../shared/icons/SearchIcon";
import ObjectSelect from "./common/Select";
import { IconWrapper } from "./common/IconWrapper";
import Header from "./Header";

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
  onOpenQr,
}) => {
  const [search, setSearch] = useState("");
  const [error, setError] = useState(""); // ⬅️ ERROR STATE

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

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
    // ❗ Проверяем выбор объектов
    if (!routeFromId || !routeToId) {
      setError("Будь ласка, виберіть обидва об’єкти для маршруту.");
      return;
    }

    // Если ок — убираем ошибку и строим маршрут
    setError("");
    onBuildRoute(routeFromId, routeToId);
  };

  return (
    <aside className="gz-sidebar">
      <Header logoImg={logoImg} isAdmin={isAdmin} />

      <section className="gz-side-section">
        <h3 className="gz-side-title">Об’єкти комплексу</h3>

        <div className="gz-objects-list">
          <div className="gz-search gz-object-item">
            <IconWrapper>
              <SearchIcon />
            </IconWrapper>
            <input
              className="gz-search-input"
              placeholder="Пошук за назвою, або номером"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.map((p) => {
            const qrUrl = `${baseUrl}/?point=${encodeURIComponent(p.id)}`;

            return (
              <button
                key={p.id}
                className={
                  selectedPoint?.id === p.id
                    ? "gz-object-item gz-object-item--active"
                    : "gz-object-item"
                }
                onClick={() => onSelectPoint(p)}
              >
                <IconWrapper>{p.number}</IconWrapper>
                <span className="gz-object-name">{p.name}</span>

                {isAdmin && (
                  <span
                    className="gz-object-qr"
                    title="Відкрити та завантажити QR"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQr && onOpenQr(p);
                    }}
                  >
                    <QRCodeCanvas value={qrUrl} size={32} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

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
            {addPointMode
              ? "Режим додавання точок: УВІМКНЕНО"
              : "Режим додавання точок"}
          </button>
        )}
      </section>

      {!isAdmin && (
        <section className="gz-side-section gz-route-section">
          <h3 className="gz-side-title">Маршрут</h3>

          <ObjectSelect
            label="Звідки ви йдете"
            value={routeFromId}
            onChange={(val) => {
              setError(""); // очищаем ошибку
              onChangeRouteFrom(val);
            }}
            points={points}
          />

          <ObjectSelect
            label="Куди потрібно потрапити"
            value={routeToId}
            onChange={(val) => {
              setError(""); // очищаем ошибку
              onChangeRouteTo(val);
            }}
            points={points}
          />

          <button className="gz-route-btn" onClick={handleBuildClick}>
            ПРОКЛАСТИ МАРШРУТ
          </button>

          {/* ❗ БЛОК С ОШИБКОЙ */}
          {error && (
            <p style={{ color: "red", marginTop: 10, fontSize: 14 }}>
              {error}
            </p>
          )}
        </section>
      )}
    </aside>
  );
};

export default QrSidebar;
