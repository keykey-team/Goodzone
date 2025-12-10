// server/routes/authRoutes.js
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

const {
  ADMIN_LOGIN = "admin",
  ADMIN_PASSWORD = "admin",
  JWT_SECRET = "dev-secret",
  JWT_EXPIRES_IN = "7d",
} = process.env;

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { login, password } = req.body || {};

  if (!login || !password) {
    return res
      .status(400)
      .json({ ok: false, message: "Логін і пароль обовʼязкові" });
  }

  if (login !== ADMIN_LOGIN || password !== ADMIN_PASSWORD) {
    return res
      .status(401)
      .json({ ok: false, message: "Невірний логін або пароль" });
  }

  const token = jwt.sign(
    { role: "admin" },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({ ok: true, token });
});

// Для проверки токена (опционально)
router.get("/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const [, token] = auth.split(" ");

  if (!token) {
    return res.status(401).json({ ok: false, message: "Неавторизовано" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ ok: true, role: payload.role });
  } catch {
    res.status(401).json({ ok: false, message: "Токен невалідний" });
  }
});

export default router;
