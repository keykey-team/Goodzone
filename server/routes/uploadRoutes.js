// server/uploadRoutes.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";

const router = express.Router();

// Папка для загрузки файлов
const uploadDir = path.join(process.cwd(), "public", "uploads");

// Убедимся, что папка существует
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Храним файлы на диске
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname); // .jpg, .png ...
    const base = path.basename(file.originalname, ext);
    const safeBase = base.replace(/[^a-z0-9\-_]/gi, "_");
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

// Лимит по размеру: 1 ГБ
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1 GB
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Дозволено завантажувати тільки зображення"));
    }
  },
});

// POST /api/upload/image
// POST /api/upload/image
router.post("/image", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Файл не завантажено" });
    }

    const originalPath = req.file.path;          // путь к исходному файлу
    const originalFilename = req.file.filename;  // имя файла на диске
    const ext = path.extname(originalFilename).toLowerCase();
    const baseName = path.basename(originalFilename, ext);

    // Если уже webp – просто возвращаем как есть, без конвертации
    if (ext === ".webp") {
      const fileUrl = `http://192.168.31.182:4000/uploads/${originalFilename}`;
      return res.json({
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        converted: false,
        format: "webp",
      });
    }

    // Иначе конвертируем в ОТДЕЛЬНЫЙ файл *.webp
    const webpFilename = `${baseName}-conv.webp`;      // важно: другое имя
    const webpPath = path.join(uploadDir, webpFilename);

    await sharp(originalPath)
      .webp({ quality: 90 }) // минимальное сжатие
      .toFile(webpPath);

    // Удаляем оригинал (если не нужен)
    fs.unlinkSync(originalPath);

    const fileUrl = `/uploads/${webpFilename}`;

    return res.json({
      url: fileUrl,
      originalName: req.file.originalname,
      size: req.file.size,
      converted: true,
      format: "webp",
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Помилка конвертації зображення" });
  }
});


// Отдельный обработчик ошибок multer (лимит и т.п.)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ message: "Файл занадто великий. Максимальний розмір 1 ГБ" });
    }
    return res.status(400).json({ message: err.message });
  }

  if (err) {
    return res.status(400).json({ message: err.message || "Помилка завантаження файлу" });
  }

  next();
});

export default router;
