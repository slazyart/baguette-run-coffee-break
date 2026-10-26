export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((char) => char + char)
          .join('')
      : clean;
  const parsed = Number.parseInt(full, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function makeCanvas(
  width: number,
  height: number,
  quality = 1,
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width * quality));
  canvas.height = Math.max(1, Math.ceil(height * quality));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available.');
  ctx.scale(quality, quality);
  return { canvas, ctx };
}

export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | [number, number, number, number],
): void {
  const [tl, tr, br, bl] = Array.isArray(radius)
    ? radius
    : [radius, radius, radius, radius];
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
}

/** Slightly irregular paper rectangle, deterministic for a given seed. */
export function paperRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number,
  jitter = 1.7,
): void {
  const random = mulberry32(seed);
  const j = () => (random() - 0.5) * 2 * jitter;
  ctx.beginPath();
  ctx.moveTo(x + j(), y + j() * 0.6);
  ctx.lineTo(x + width * 0.42 + j(), y + j() * 0.5);
  ctx.lineTo(x + width + j() * 0.6, y + j());
  ctx.lineTo(x + width + j() * 0.4, y + height * 0.46 + j());
  ctx.lineTo(x + width + j() * 0.6, y + height + j() * 0.4);
  ctx.lineTo(x + width * 0.56 + j(), y + height + j() * 0.6);
  ctx.lineTo(x + j() * 0.5, y + height + j() * 0.4);
  ctx.lineTo(x + j() * 0.3, y + height * 0.52 + j());
  ctx.closePath();
}

export function fillPaperRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  ink?: string,
  seed = 1,
  lineWidth = 1.4,
  jitter = 1.4,
): void {
  paperRectPath(ctx, x, y, width, height, seed, jitter);
  ctx.fillStyle = fill;
  ctx.fill();
  if (ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function drawPencilLine(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color: string,
  width = 1.2,
  seed = 2,
): void {
  if (points.length < 2) return;
  const random = mulberry32(seed);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (i === 0) ctx.moveTo(x, y);
    else {
      const previous = points[i - 1];
      ctx.quadraticCurveTo(
        (previous[0] + x) / 2 + (random() - 0.5) * 0.8,
        (previous[1] + y) / 2 + (random() - 0.5) * 0.8,
        x,
        y,
      );
    }
  }
  ctx.stroke();
  ctx.restore();
}

export function drawTape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  angle: number,
  color = 'rgba(234, 213, 170, 0.62)',
  seed = 4,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  paperRectPath(ctx, -width / 2, -8, width, 16, seed, 2.2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(88, 60, 38, 0.13)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.restore();
}

export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha = 0.2,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(54, 34, 20, ${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  rotation = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const length = i % 2 === 0 ? radius : radius * 0.38;
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 20, size / 20);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 7);
  ctx.bezierCurveTo(-11, -1, -10, -11, -3, -11);
  ctx.bezierCurveTo(1, -11, 3, -8, 0, -5);
  ctx.bezierCurveTo(3, -8, 7, -11, 10, -9);
  ctx.bezierCurveTo(16, -3, 8, 5, 0, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawTornStripPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  amplitude: number,
  segment: number,
  seed: number,
  includeBottom = false,
  height = 0,
  bottomY = 0,
): void {
  const random = mulberry32(seed);
  ctx.beginPath();
  ctx.moveTo(x, y + (random() - 0.5) * amplitude);
  const count = Math.max(3, Math.ceil(width / segment));
  for (let i = 1; i <= count; i++) {
    const px = x + (i / count) * width;
    const py = y + (random() - 0.5) * amplitude * 2;
    ctx.lineTo(px, py);
  }
  if (includeBottom) {
    ctx.lineTo(x + width, bottomY + height);
    ctx.lineTo(x, bottomY + height);
  }
  ctx.closePath();
}

export function dashedRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  dash = [3, 6],
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
