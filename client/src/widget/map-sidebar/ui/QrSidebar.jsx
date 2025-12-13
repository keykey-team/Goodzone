import { useEffect, useMemo, useRef, useState } from "react";
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
  const [error, setError] = useState("");

  // open / close списка объектов
  const [objectsOpen, setObjectsOpen] = useState(false);
  const objectsRef = useRef(null);

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

  // закрытие селекта по клику мимо
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!objectsRef.current) return;
      if (!objectsRef.current.contains(e.target)) {
        setObjectsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBuildClick = () => {
    if (!routeFromId || !routeToId) {
      setError("Будь ласка, виберіть обидва об’єкти для маршруту.");
      return;
    }
    setError("");
    onBuildRoute(routeFromId, routeToId);
  };

  const handleResetRoute = () => {
    setError("");
    onChangeRouteFrom(null);
    onChangeRouteTo(null);
    onBuildRoute(null, null);
  };

  return (
    <aside className="gz-sidebar">
      <Header logoImg={logoImg} isAdmin={isAdmin} />

      {/* ================= ОБЪЕКТЫ ================= */}
      <section className="gz-side-section">
        <h3 className="gz-side-title">Об’єкти комплексу</h3>

        <div
          ref={objectsRef}
          className={
            objectsOpen
              ? "gz-select-wrapper gz-select-wrapper--open"
              : "gz-select-wrapper"
          }
        >
          {/* поиск */}
          <div
            className="gz-object-item gz-object-item-select search-in-select"
            onClick={() => setObjectsOpen((v) => !v)}
          >
            <IconWrapper>
              <SearchIcon />
            </IconWrapper>

            <input
              className="gz-select-input"
              placeholder="Пошук за назвою, або номером"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setObjectsOpen(true);
              }}
              onFocus={() => setObjectsOpen(true)}
              onClick={(e) => e.stopPropagation()}
            />

            <span className="gz-custom-select__arrow" />
          </div>

          {/* dropdown */}
          {objectsOpen && (
            <div className="gz-custom-select__dropdown gz-objects-list">
              {filtered.map((p) => {
                const qrUrl = `${baseUrl}/?point=${encodeURIComponent(p.id)}`;
                const isActive = selectedPoint?.id === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      isActive
                        ? "gz-object-item gz-object-item--active"
                        : "gz-object-item"
                    }
                    onClick={() => {
                      onSelectPoint(p);
                      setObjectsOpen(false);
                    }}
                  >
                    <IconWrapper>{p.number}</IconWrapper>
                    <span className="gz-object-name">{p.name}</span>

                    {isAdmin && (
                      <span
                        className="gz-object-qr"
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

              {filtered.length === 0 && (
                <div className="gz-custom-select__empty">
                  Нічого не знайдено
                </div>
              )}
            </div>
          )}
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

      {/* ================= МАРШРУТ ================= */}
      {!isAdmin && (
        <section className="gz-side-section gz-route-section">
          <h3 className="gz-side-title">Маршрут</h3>

          <div className="objectSelect__wrapper">
            <ObjectSelect
              label="Від"
              value={routeFromId}
              onChange={(val) => {
                setError("");
                onChangeRouteFrom(val);
              }}
              points={points}
            />

            <ObjectSelect
              label="Куди"
              value={routeToId}
              onChange={(val) => {
                setError("");
                onChangeRouteTo(val);
              }}
              points={points}
            />
          </div>

          <button className="gz-route-btn" onClick={handleBuildClick}>
            ПРОКЛАСТИ МАРШРУТ
          </button>

          {/* 🔥 КНОПКА СБРОСА */}
          {(routeFromId || routeToId) && (
            <button
              className="gz-route-btn gz-route-btn--secondary"
              style={{ marginTop: 10 }}
              onClick={handleResetRoute}
            >
              СКИНУТИ МАРШРУТ
            </button>
          )}

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