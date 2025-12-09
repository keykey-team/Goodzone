import { useEffect, useRef, useState } from "react";
import { IconWrapper } from "./IconWrapper";

const ObjectSelect = ({ label, value, onChange, points }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const selected = points.find((p) => p.id === value) || null;

  const handleOptionClick = (id) => {
    onChange(id);
    setOpen(false);
  };

  // закрывать по клику мимо
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="input__wrapper">
      <label className="gz-label">{label}</label>

      <div
        ref={wrapperRef}
        className={
          open
            ? "gz-select-wrapper gz-select-wrapper--open"
            : "gz-select-wrapper"
        }
      >
        {/* голова селекта */}
        <button
          type="button"
          className="gz-object-item gz-object-item-select"
          onClick={() => setOpen((v) => !v)}
        >
          {selected ? (
            <>
              <IconWrapper>{selected.number}</IconWrapper>
              <span className="gz-object-name">{selected.name}</span>
            </>
          ) : (
            <span className="gz-object-name">Оберіть об’єкт</span>
          )}

          {/* стрелка, можно оставить пустым спаном, она стилизуется в CSS */}
          <span className="gz-custom-select__arrow" />
        </button>

        {/* выпадающий список */}
        {open && (
          <div className="gz-custom-select__dropdown">
            {points.map((p) => (
              <button
                key={p.id}
                type="button"
                className="gz-object-item gz-custom-select__option"
                onClick={() => handleOptionClick(p.id)}
              >
                <IconWrapper>{p.number}</IconWrapper>
                <span className="gz-object-name">{p.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ObjectSelect;
