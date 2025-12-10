// server/middleware/requireAdmin.js
import jwt from "jsonwebtoken";

const { JWT_SECRET = "dev-secret" } = process.env;

export const requireAdmin = (req, res, next) => {
  const auth = req.headers.authorization || "";
  const [, token] = auth.split(" ");

  if (!token) {
    return res.status(401).json({ ok: false, message: "Неавторизовано" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ ok: false, message: "Доступ заборонено" });
    }
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: "Токен невалідний" });
  }
};
