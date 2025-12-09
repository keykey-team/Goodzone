// src/RouteChoiceModal.jsx
import React from "react";
import Cross from "../../../shared/ui/Cross";

const RouteChoiceModal = ({
  open,
  variants,
  points,
  fromPoint,
  toPoint,
  onClose,
  onChoose,
}) => {
  if (!open || !variants || !variants.length) return null;

  const getPointLabel = (id) => {
    const p = points.find((pt) => pt.id === id);
    if (!p) return id;
    return `#${p.number} ${p.name}`;
  };

  const buildTitle = (variant, index) => {
    const names = (variant.pointIds || []).map(getPointLabel);
    const pathStr = names.join(" → ");

    const parts = [];
    if (variant.type === "direct") parts.push("Прямий маршрут");
    if (variant.type === "alternative") parts.push("Альтернативний маршрут");
    if (variant.type === "shortest") parts.push("Маршрут");

    const base = parts.join(" · ") || `Маршрут ${index + 1}`;
    return { base, pathStr };
  };

  return (
    <div className="gz-modal-backdrop" onClick={onClose}>
      <div className="gz-route-modal" onClick={(e) => e.stopPropagation()}>
        <button className="gz-modal-close" onClick={onClose}>
          <Cross/>
        </button>
        <h3 className="gz-route-modal-title">Оберіть маршрут</h3>

        {fromPoint && toPoint && (
          <p style={{ fontSize: 13, marginTop: 0, marginBottom: 10 }}>
            Від{" "}
            <strong>
              #{fromPoint.number} {fromPoint.name}
            </strong>{" "}
            до{" "}
            <strong>
              #{toPoint.number} {toPoint.name}
            </strong>{" "}
            доступно декілька варіантів:
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {variants.map((v, idx) => {
            const { base, pathStr } = buildTitle(v, idx);
            const segmentsCount = (v.routeIds || []).length;

            return (
              <button
                key={idx}
                type="button"
                className="gz-route-option-btn"
                onClick={() => onChoose(v)}
              >
                <div className="gz-route-option-title">
                  {base}
                  {v.isShortest && (
                    <span className="gz-route-badge">Найкоротший</span>
                  )}
                </div>
                <div className="gz-route-option-sub">
                  {pathStr}
                  {" · "}
                  відрізків: {segmentsCount}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RouteChoiceModal;