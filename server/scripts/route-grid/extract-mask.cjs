/* Шаг 1 генерации сетки маршрутов: маска проходимых дорожек из картинки карты.
   Классы покрытий: брусчатка, асфальт, жёлтые дорожки, лесные тропы.

   Запуск:  node server/scripts/route-grid/extract-mask.cjs
   Выход:   server/scripts/route-grid/output/mask.raw (+ mask.meta.json)
            и mask-overlay.jpg — проверить глазами, что дорожки накрыты.
   После смены картинки карты пороги цветов ниже нужно перепроверить. */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SCRATCH = path.join(__dirname, "output");
fs.mkdirSync(SCRATCH, { recursive: true });
const IMAGE = path.join(__dirname, "../../../client/public/1793011231118-IMG_4808_ukryttia_v3.jpg");
const SCALE = 0.25;

// Замеры на этой карте: синий канал крыш выше красного на 5–8, у брусчатки и
// асфальта разница 0. Порог 3 — запас на JPEG-шум и усреднение при уменьшении.
const MAX_PAVEMENT_BLUE_TINT = 3;
// Средний градиент яркости: брусчатка 15–24, гладкие светлые крыши ~0.
const MIN_COBBLE_TEXTURE = 6;
// Асфальт гладкий (градиент 0–1.4), тёмные крыши из профнастила — полосатые (8–19).
const MAX_ASPHALT_TEXTURE = 4;

const dilate = (src, W, H, iter) => {
  let cur = src;
  for (let k = 0; k < iter; k++) {
    const out = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        out[i] = cur[i] | cur[i - 1] | cur[i + 1] | cur[i - W] | cur[i + W] ? 1 : 0;
      }
    cur = out;
  }
  return cur;
};
const erode = (src, W, H, iter) => {
  let cur = src;
  for (let k = 0; k < iter; k++) {
    const out = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        out[i] = cur[i] & cur[i - 1] & cur[i + 1] & cur[i - W] & cur[i + W] ? 1 : 0;
      }
    cur = out;
  }
  return cur;
};

(async () => {
  const meta = await sharp(IMAGE).metadata();
  const W = Math.round(meta.width * SCALE);
  const H = Math.round(meta.height * SCALE);
  const { data } = await sharp(IMAGE).resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  console.log(`image ${meta.width}x${meta.height} -> ${W}x${H}`);

  // Фактура: средний модуль градиента яркости по блоку 4x4 полного разрешения.
  // Брусчатка — камни, градиент ~15–24; гладкие светлые крыши — ~0.
  const texture = new Float32Array(W * H);
  {
    const { data: gray, info } = await sharp(IMAGE).greyscale().raw().toBuffer({ resolveWithObject: true });
    const fullW = info.width, fullH = info.height;
    const blockCount = new Uint16Array(W * H);
    for (let y = 0; y < fullH - 1; y++) {
      const rowOffset = y * fullW;
      const blockRow = Math.min(H - 1, Math.floor(y * SCALE)) * W;
      for (let x = 0; x < fullW - 1; x++) {
        const i = rowOffset + x;
        const gradient = Math.abs(gray[i + 1] - gray[i]) + Math.abs(gray[i + fullW] - gray[i]);
        const blockIndex = blockRow + Math.min(W - 1, Math.floor(x * SCALE));
        texture[blockIndex] += gradient;
        blockCount[blockIndex]++;
      }
    }
    for (let i = 0; i < W * H; i++) if (blockCount[i]) texture[i] /= blockCount[i];
  }

  const hard = new Uint8Array(W * H); // брусчатка/асфальт/жёлтые
  const trail = new Uint8Array(W * H); // лесные тропы
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx - mn;
    // Крыши на этой карте синеватые (синий выше красного на 5–8), покрытия —
    // нейтральные (брусчатка 163,163,163; асфальт 42,42,42). Отсекаем по b-r.
    const isNeutralGray = b - r <= MAX_PAVEMENT_BLUE_TINT;
    // брусчатка: светло-серая, нейтральная и с фактурой камня
    if (mn > 125 && sat < 35 && isNeutralGray && texture[i] >= MIN_COBBLE_TEXTURE) hard[i] = 1;
    // асфальт: тёмно-серый, нейтральный и гладкий (полосатое — профнастил крыш)
    else if (mx < 115 && mn > 25 && sat < 22 && isNeutralGray && texture[i] <= MAX_ASPHALT_TEXTURE) hard[i] = 1;
    // жёлтые дорожки (песок светлее и b выше — не попадает)
    else if (r > 170 && g > 130 && b < 130 && r - b > 70 && g - b > 40) hard[i] = 1;
    // лесные тропы: тёмно-оливковые (r~40..115, g чуть меньше r, синего мало)
    else if (r >= 35 && r <= 115 && g >= 28 && g <= 95 && b < 42 && r - g >= -6 && r - b >= 22) trail[i] = 1;
  }

  // тропы рвутся под кронами — сшиваем агрессивно; твёрдые покрытия — слегка
  const trailClosed = erode(dilate(trail, W, H, 6), W, H, 5);
  const hardClosed = erode(dilate(hard, W, H, 2), W, H, 2);
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mask[i] = hardClosed[i] | trailClosed[i];

  // убрать мелкие компоненты
  const labels = new Int32Array(W * H).fill(-1);
  const sizes = [];
  const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || labels[s] !== -1) continue;
    const label = sizes.length;
    let size = 0;
    stack.push(s);
    labels[s] = label;
    while (stack.length) {
      const i = stack.pop();
      size++;
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const ni = ny * W + nx;
          if (mask[ni] && labels[ni] === -1) { labels[ni] = label; stack.push(ni); }
        }
    }
    sizes.push(size);
  }
  let kept = 0;
  for (let i = 0; i < W * H; i++) {
    if (mask[i] && sizes[labels[i]] < 150) mask[i] = 0;
    else if (mask[i]) kept++;
  }
  console.log(`маска: ${kept} px (${((kept / (W * H)) * 100).toFixed(1)}%), компонент >=150px: ${sizes.filter((s) => s >= 150).length}`);

  fs.writeFileSync(path.join(SCRATCH, "mask.raw"), Buffer.from(mask));
  fs.writeFileSync(path.join(SCRATCH, "mask.meta.json"), JSON.stringify({ W, H, SCALE }));

  const overlay = Buffer.alloc(W * H * 3);
  for (let i = 0; i < W * H; i++) {
    if (mask[i]) { overlay[i * 3] = 255; overlay[i * 3 + 1] = 30; overlay[i * 3 + 2] = 30; }
    else { overlay[i * 3] = data[i * 3] >> 1; overlay[i * 3 + 1] = data[i * 3 + 1] >> 1; overlay[i * 3 + 2] = data[i * 3 + 2] >> 1; }
  }
  await sharp(overlay, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 82 }).toFile(path.join(SCRATCH, "mask-overlay.jpg"));
  console.log("overlay saved");
})();
