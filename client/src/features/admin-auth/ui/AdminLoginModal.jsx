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

    try {
      setSubmitting(true);
      const token = await loginAdmin(login, password);
      setAdminToken(token);
      onSuccess?.();
    } catch (err) {
      setError(err.message || "Помилка входу");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="gz-modal-backdrop">
      <div
        className="gz-object-modal gz-login-modal"
        style={{transform:"none"}}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="gz-login-title">Вхід в адмін-панель</h2>

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
          </label>

          {error && <div className="gz-error-text">{error}</div>}

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
