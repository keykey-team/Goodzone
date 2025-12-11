import { useState } from "react";
import { loginAdmin } from "../../../shared/api/authApi";
import { setAdminToken } from "../../../shared/config/authToken";

const AdminLoginModal = ({ open, onSuccess }) => {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 👉 базові перевірки
    if (!login.trim() || !password.trim()) {
      setError("Будь ласка, заповніть усі поля.");
      return;
    }

    try {
      setSubmitting(true);

      const token = await loginAdmin(login, password);
      if (!token) {
        setError("Невідома помилка. Спробуйте ще раз.");
        return;
      }

      setAdminToken(token);
      onSuccess?.();
    } catch (err) {
      console.error(err);

      let msg = "Сталася помилка. Спробуйте пізніше.";

      if (err?.response?.status === 401) {
        msg = "Невірний логін або пароль.";
      } else if (err?.response?.status === 404) {
        msg = "Користувача не знайдено.";
      } else if (err?.message?.includes("Failed to fetch")) {
        msg = "Сервер не відповідає. Перевірте підключення.";
      } else if (err?.message) {
        msg = err.message;
      }

      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gz-modal-backdrop">
      <div
        className="gz-object-modal gz-login-modal"
        style={{ transform: "none" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="gz-login-title">Вхід</h2>

        <form onSubmit={handleSubmit} className="gz-login-form">
          <label className="gz-label">
            Логін
            <input
              className="gz-input"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="gz-label">
            Пароль
            <input
              type="password"
              className="gz-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            {error && <div className="gz-error-text">{error}</div>}
          </label>

          <div className="gz-object-actions">
            <button
              type="submit"
              className="gz-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Вхід..." : "Увійти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginModal;
