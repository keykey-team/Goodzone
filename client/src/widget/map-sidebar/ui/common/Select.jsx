import { useEffect, useMemo, useRef, useState } from "react";
import { IconWrapper } from "./IconWrapper";
import SearchIcon from "../../../../shared/icons/SearchIcon";
import { isShelterPoint } from "../../../../entities/point/lib/isShelterPoint";

const ObjectSelect = ({ label, value, onChange, points }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef(null);

  const selected = points.find((p) => p.id === value) || null;

  // ✅ утилита: нормализуем массив тегов в строку для поиска
  const tagsToSearchString = (tags) => {
    if (!Array.isArray(tags)) return "";
    return tags
      .map((t) => (t == null ? "" : String(t)))
      .join(" ")
      .toLowerCase();
  };

  // когда выбрали точку — подставляем в инпут её текст
  useEffect(() => {
    if (selected) {
      setQuery(`${selected.number} — ${selected.name}`);
    } else {
      setQuery("");
    }
  }, [selected]);

  // закрытие по клику мимо
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

  const filteredPoints = useMemo(() => {
    const q = query.toLowerCase().trim();

    // если ничего не ввели или оставили ровно текст выбранного – показываем весь список
    if (
      !q ||
      (selected && q === `${selected.number} — ${selected.name}`.toLowerCase())
    ) {
      return points;
    }

    // ✅ поддержка поиска по нескольким словам + по тегам
    const tokens = q.split(/\s+/).filter(Boolean);

    return points.filter((p) => {
      const numberStr = String(p.number ?? "").toLowerCase();
      const nameStr = String(p.name ?? "").toLowerCase();
      const tagsStr = tagsToSearchString(p.manualSearchingTags);

      // ✅ каждая часть запроса должна где-то совпасть
      return tokens.every(
        (t) =>
          numberStr.includes(t) || nameStr.includes(t) || tagsStr.includes(t)
      );
    });
  }, [query, points, selected]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  const handleSelect = (p) => {
    onChange(p.id);
    setQuery(`${p.number} — ${p.name}`);
    setOpen(false);
  };

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
        {/* “шапка” селекта: иконка + инпут + стрелка */}
        <div
          className={
            isShelterPoint(selected)
              ? "gz-object-item gz-object-item-select gz-object-item--shelter"
              : "gz-object-item gz-object-item-select"
          }
          onClick={() => setOpen(true)}
        >
          {selected && <IconWrapper>{selected.number}</IconWrapper>}
          {!selected && (
            <span className="wrapper-icon-search">
              <IconWrapper>
                <SearchIcon />
              </IconWrapper>
            </span>
          )}

          {/* 🔽 обёртка для ellipsis */}
          <div
            style={{
              width: "83%",
              overflow: "hidden",
              whiteSpace: "nowrap",
            }}
          >
            <input
              placeholder="Оберіть об’єкт"
              value={query}
              onChange={handleInputChange}
              onFocus={() => setOpen(true)}
              style={{
                all: "unset",
                width: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "block",
                cursor: "text",
              }}
            />
          </div>

          <span className="gz-custom-select__arrow" />
        </div>

        {/* выпадающий список */}
        {open && (
          <div className="gz-custom-select__dropdown">
            {filteredPoints.map((p) => (
              <button
                key={p.id}
                type="button"
                className={
                  isShelterPoint(p)
                    ? "gz-object-item gz-custom-select__option gz-object-item--shelter"
                    : "gz-object-item gz-custom-select__option"
                }
                onClick={() => handleSelect(p)}
              >
                <IconWrapper>{p.number}</IconWrapper>
                <span className="gz-object-name">{p.name}</span>
              </button>
            ))}

            {filteredPoints.length === 0 && (
              <div className="gz-custom-select__empty">Нічого не знайдено</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ObjectSelect;