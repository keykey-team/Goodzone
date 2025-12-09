import { useEffect, useMemo, useRef, useState } from "react";
import { IconWrapper } from "./IconWrapper";
import SearchIcon from "../../../../shared/icons/SearchIcon";

const ObjectSelect = ({ label, value, onChange, points }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  const selected = points.find((p) => p.id === value) || null;

  const handleOptionClick = (id) => {
    onChange(id);
    setOpen(false);
  };

  // фильтрация по номеру или названию
  const filteredPoints = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return points;
    return points.filter(
      (p) =>
        String(p.number).includes(q) ||
        (p.name || "").toLowerCase().includes(q)
    );
  }, [points, search]);

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

          <span className="gz-custom-select__arrow" />
        </button>

        {/* выпадающий список */}
        {open && (
          <div className="gz-custom-select__dropdown">
            {/* строка поиска как первая "опция" */}
            <div className="gz-search gz-object-item gz-custom-select__search">
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

            {filteredPoints.map((p) => (
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
