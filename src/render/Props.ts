import type { CupView, ObstacleView } from '../core/types';
import {
  drawHeart,
  drawPencilLine,
  drawShadow,
  makeCanvas,
  paperRectPath,
  roundedRectPath,
  withAlpha,
} from './DrawUtils';

const INK = '#3b281b';
const SPRITE_QUALITY = 2;

interface CachedSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

const obstacleSprites = new Map<string, CachedSprite>();

export function drawObstacleSprite(
  ctx: CanvasRenderingContext2D,
  obstacle: ObstacleView,
  groundY: number,
  time: number,
): void {
  const sprite = getObstacleSprite(obstacle);
  const wobble =
    obstacle.kind === 'bags'
      ? Math.sin(time * 1.5 + obstacle.phase) * 0.007
      : obstacle.kind === 'bean'
        ? Math.sin(time * 2 + obstacle.phase) * 0.012
        : 0;
  drawShadow(
    ctx,
    obstacle.x + 2,
    groundY + 2,
    obstacle.width * 0.52,
    Math.max(3, obstacle.height * 0.075),
    0.18,
  );
  ctx.save();
  ctx.translate(obstacle.x, groundY);
  ctx.rotate(wobble);
  ctx.drawImage(
    sprite.canvas,
    -obstacle.width / 2,
    -obstacle.height,
    obstacle.width,
    obstacle.height,
  );
  ctx.restore();
}

function getObstacleSprite(obstacle: ObstacleView): CachedSprite {
  const key = `${obstacle.kind}:${obstacle.variant}:${Math.round(
    obstacle.width / 4,
  )}:${Math.round(obstacle.height / 4)}`;
  const cached = obstacleSprites.get(key);
  if (cached) return cached;

  const baseWidth = obstacle.width;
  const baseHeight = obstacle.height;
  const { canvas, ctx } = makeCanvas(
    baseWidth,
    baseHeight,
    SPRITE_QUALITY,
  );
  ctx.translate(0, 0);
  switch (obstacle.kind) {
    case 'napkin':
      drawNapkin(ctx, baseWidth, baseHeight, obstacle.variant);
      break;
    case 'box':
      drawBox(ctx, baseWidth, baseHeight, obstacle.variant);
      break;
    case 'bean':
      drawBean(ctx, baseWidth, baseHeight, obstacle.variant);
      break;
    case 'cup':
      drawEmptyCup(ctx, baseWidth, baseHeight, obstacle.variant);
      break;
    case 'bags':
      drawBagStack(ctx, baseWidth, baseHeight, obstacle.variant);
      break;
    case 'sugar':
      drawSugarPackets(ctx, baseWidth, baseHeight, obstacle.variant);
      break;
  }
  const sprite = { canvas, width: baseWidth, height: baseHeight };
  obstacleSprites.set(key, sprite);
  return sprite;
}

function drawNapkin(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: number,
): void {
  const creams = ['#f0e5ce', '#e8dcc1', '#f5ead8'];
  const base = creams[variant % creams.length];
  ctx.save();
  ctx.translate(w / 2, h / 2 + 2);
  ctx.beginPath();
  ctx.moveTo(-w * 0.44, h * 0.04);
  ctx.lineTo(-w * 0.3, -h * 0.35);
  ctx.lineTo(-w * 0.08, -h * 0.43);
  ctx.lineTo(w * 0.03, -h * 0.31);
  ctx.lineTo(w * 0.22, -h * 0.38);
  ctx.lineTo(w * 0.41, -h * 0.16);
  ctx.lineTo(w * 0.34, h * 0.12);
  ctx.lineTo(w * 0.18, h * 0.35);
  ctx.lineTo(-w * 0.1, h * 0.29);
  ctx.lineTo(-w * 0.3, h * 0.38);
  ctx.closePath();
  ctx.fillStyle = base;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.fillStyle = withAlpha('#a9784b', 0.18);
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 0.35);
  ctx.lineTo(-w * 0.08, -h * 0.43);
  ctx.lineTo(w * 0.03, -h * 0.31);
  ctx.lineTo(-w * 0.14, -h * 0.06);
  ctx.lineTo(-w * 0.34, 0.02 * h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = withAlpha('#ffffff', 0.4);
  ctx.beginPath();
  ctx.moveTo(w * 0.22, -h * 0.38);
  ctx.lineTo(w * 0.41, -h * 0.16);
  ctx.lineTo(w * 0.28, 0.03 * h);
  ctx.lineTo(w * 0.11, -h * 0.15);
  ctx.closePath();
  ctx.fill();

  drawPencilLine(
    ctx,
    [
      [-w * 0.25, -h * 0.08],
      [-w * 0.12, h * 0.02],
      [-w * 0.22, h * 0.21],
    ],
    withAlpha(INK, 0.42),
    1,
    11,
  );
  drawPencilLine(
    ctx,
    [
      [w * 0.12, -h * 0.23],
      [w * 0.04, -h * 0.05],
      [w * 0.22, h * 0.08],
    ],
    withAlpha(INK, 0.36),
    0.9,
    12,
  );
  if (variant === 1) {
    ctx.fillStyle = withAlpha('#7a4b2a', 0.23);
    ctx.beginPath();
    ctx.ellipse(w * 0.16, h * 0.13, w * 0.11, h * 0.1, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: number,
): void {
  const caramels = ['#b8814f', '#c4905e', '#a97447'];
  const box = caramels[variant % caramels.length];
  const top = h * 0.2;
  ctx.save();
  // Back flap.
  ctx.beginPath();
  ctx.moveTo(w * 0.12, top);
  ctx.lineTo(w * 0.38, h * 0.04);
  ctx.lineTo(w * 0.87, h * 0.05);
  ctx.lineTo(w * 0.9, top);
  ctx.closePath();
  ctx.fillStyle = withAlpha('#8b5b34', 0.95);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Box front.
  paperRectPath(ctx, w * 0.08, top, w * 0.84, h - top - 2, 52 + variant, 1.8);
  ctx.fillStyle = box;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Corrugated top edge.
  ctx.strokeStyle = withAlpha(INK, 0.52);
  ctx.lineWidth = 0.8;
  const count = Math.floor(w / 5);
  for (let i = 0; i < count; i++) {
    const x = w * 0.12 + (i / count) * w * 0.76;
    ctx.beginPath();
    ctx.moveTo(x, top + 2);
    ctx.lineTo(x, top + 7);
    ctx.stroke();
  }

  // Tape stripe.
  ctx.fillStyle = 'rgba(239, 217, 175, 0.78)';
  ctx.fillRect(w * 0.44, top - 3, w * 0.16, h - top - 4);
  ctx.strokeStyle = withAlpha(INK, 0.2);
  ctx.lineWidth = 0.7;
  ctx.strokeRect(w * 0.44, top - 3, w * 0.16, h - top - 4);

  // Shipping stamp.
  ctx.save();
  ctx.translate(w * 0.25, h * 0.56);
  ctx.rotate(-0.09);
  ctx.strokeStyle = withAlpha('#5e3b23', 0.62);
  ctx.lineWidth = 1;
  ctx.strokeRect(-w * 0.12, -h * 0.08, w * 0.24, h * 0.16);
  ctx.fillStyle = withAlpha('#4e301c', 0.72);
  ctx.font = '600 4px "Nunito", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(variant === 0 ? 'THIS SIDE UP' : 'FRAGILE', 0, 1);
  ctx.restore();

  // Small coffee bean doodle.
  ctx.save();
  ctx.translate(w * 0.71, h * 0.6);
  ctx.rotate(-0.35);
  ctx.fillStyle = withAlpha('#5f3a22', 0.65);
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.06, w * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = withAlpha('#f0ddba', 0.7);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -w * 0.06);
  ctx.quadraticCurveTo(w * 0.03, 0, 0, w * 0.06);
  ctx.stroke();
  ctx.restore();

  // Pencil fold lines.
  drawPencilLine(
    ctx,
    [
      [w * 0.14, h * 0.33],
      [w * 0.3, h * 0.31],
      [w * 0.38, h * 0.38],
    ],
    withAlpha(INK, 0.22),
    0.9,
    32,
  );
  ctx.restore();
}

function drawBean(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: number,
): void {
  const tones = ['#6e442d', '#7d5032', '#5f3927'];
  ctx.save();
  ctx.translate(w / 2, h * 0.58);
  ctx.rotate(-0.24 + variant * 0.04);
  ctx.beginPath();
  ctx.ellipse(0, 0, w * 0.44, h * 0.48, 0, 0, Math.PI * 2);
  ctx.fillStyle = tones[variant % tones.length];
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(-w * 0.11, -h * 0.1, w * 0.26, h * 0.25, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha('#a47752', 0.36);
  ctx.fill();

  ctx.strokeStyle = withAlpha('#2f1b12', 0.95);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w * 0.08, -h * 0.38);
  ctx.bezierCurveTo(
    w * 0.17,
    -h * 0.12,
    -w * 0.18,
    h * 0.12,
    w * 0.03,
    h * 0.37,
  );
  ctx.stroke();
  ctx.strokeStyle = withAlpha('#f3ddba', 0.75);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.012, -h * 0.31);
  ctx.bezierCurveTo(w * 0.16, -h * 0.07, -w * 0.1, h * 0.12, w * 0.08, h * 0.3);
  ctx.stroke();
  // A little pale edge so the bean reads even on dark worlds.
  ctx.strokeStyle = withAlpha('#efd8af', 0.33);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(-w * 0.04, -h * 0.02, w * 0.32, h * 0.38, -0.24, 3.55, 5.65);
  ctx.stroke();

  if (variant === 2) {
    ctx.strokeStyle = withAlpha('#e5c79a', 0.24);
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(
        -w * 0.05 + i * 2,
        -h * 0.2 + i * 3,
        w * 0.2,
        h * 0.08,
        0.4,
        0,
        Math.PI,
      );
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawEmptyCup(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: number,
): void {
  const accents = ['#a85e42', '#6b7a61', '#84654f'];
  const accent = accents[variant % accents.length];
  ctx.save();
  ctx.translate(w / 2, 0);
  const top = h * 0.13;
  const bottom = h * 0.95;
  const topWidth = w * 0.78;
  const bottomWidth = w * 0.52;

  // A slightly dented, discarded cup body.
  ctx.beginPath();
  ctx.moveTo(-topWidth / 2, top);
  ctx.quadraticCurveTo(-topWidth * 0.26, h * 0.36, -topWidth * 0.32, h * 0.51);
  ctx.quadraticCurveTo(-topWidth * 0.4, h * 0.65, -bottomWidth / 2, bottom);
  ctx.quadraticCurveTo(0, bottom + h * 0.06, bottomWidth / 2, bottom);
  ctx.quadraticCurveTo(topWidth * 0.28, h * 0.6, topWidth * 0.35, h * 0.42);
  ctx.quadraticCurveTo(topWidth * 0.32, h * 0.24, topWidth / 2, top);
  ctx.closePath();
  ctx.fillStyle = '#e6d8bd';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.7;
  ctx.stroke();

  // Muted kraft sleeve, with a plain stitched band instead of the collectible logo.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-topWidth * 0.37, h * 0.43);
  ctx.lineTo(topWidth * 0.37, h * 0.43);
  ctx.lineTo(topWidth * 0.29, h * 0.73);
  ctx.lineTo(-topWidth * 0.32, h * 0.73);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.strokeStyle = withAlpha('#f2e5cb', 0.48);
  ctx.lineWidth = 0.6;
  ctx.setLineDash([1.3, 2.3]);
  ctx.beginPath();
  ctx.moveTo(-topWidth * 0.28, h * 0.57);
  ctx.lineTo(topWidth * 0.27, h * 0.57);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Torn open rim: this cup has definitely already been emptied.
  ctx.beginPath();
  ctx.ellipse(0, top, topWidth / 2, h * 0.055, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d3bfa0';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, top + 1, topWidth * 0.36, h * 0.028, 0, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha('#5d402c', 0.48);
  ctx.fill();
  ctx.strokeStyle = withAlpha(INK, 0.85);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const tearY = top - h * 0.045;
  ctx.moveTo(-topWidth * 0.46, tearY + h * 0.02);
  for (let i = 0; i <= 5; i++) {
    ctx.lineTo(
      -topWidth * 0.46 + (topWidth * 0.92 * i) / 5,
      tearY + (i % 2 === 0 ? 0 : h * 0.035),
    );
  }
  ctx.stroke();

  // Coffee ring on the paper.
  ctx.strokeStyle = withAlpha('#7a4b2a', 0.25);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(topWidth * 0.13, h * 0.86, topWidth * 0.18, h * 0.04, -0.12, 0, Math.PI * 2);
  ctx.stroke();

  // A little discarded lid resting against the cup.
  if (variant !== 1) {
    ctx.save();
    ctx.translate(w * 0.29, h * 0.94);
    ctx.rotate(0.14);
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.17, h * 0.045, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5a3b28';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.09, h * 0.026, 0, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha('#d9c5a1', 0.38);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawBagStack(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: number,
): void {
  const kraft = ['#b78354', '#c39162', '#a87349'];
  ctx.save();
  ctx.translate(w / 2, h);
  // Three bags, back to front.
  const bags = [
    { x: -w * 0.32, y: h * 0.24, bw: w * 0.62, bh: h * 0.65, rot: -0.08 },
    { x: w * 0.02, y: h * 0.12, bw: w * 0.68, bh: h * 0.8, rot: 0.05 },
    { x: -w * 0.09, y: h * 0.38, bw: w * 0.7, bh: h * 0.57, rot: Math.sin(variant) * 0.04 },
  ];
  bags.forEach((bag, index) => {
    ctx.save();
    ctx.translate(bag.x, 0);
    ctx.rotate(bag.rot);
    const top = -bag.y - bag.bh;
    const left = -bag.bw / 2;
    // Folded top.
    ctx.beginPath();
    ctx.moveTo(left, top + 8);
    ctx.lineTo(left + 2, top - 2);
    ctx.lineTo(left + bag.bw * 0.3, top + 2);
    ctx.lineTo(left + bag.bw * 0.45, top - 3);
    ctx.lineTo(left + bag.bw * 0.7, top + 2);
    ctx.lineTo(left + bag.bw - 2, top - 1);
    ctx.lineTo(left + bag.bw, top + 9);
    ctx.closePath();
    ctx.fillStyle = withAlpha('#87603e', 0.9);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    paperRectPath(
      ctx,
      left,
      top + 7,
      bag.bw,
      bag.bh - 6,
      78 + index * 12,
      1.4,
    );
    ctx.fillStyle = kraft[index];
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Fold line.
    ctx.strokeStyle = withAlpha(INK, 0.36);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(left + 3, top + bag.bh * 0.22);
    ctx.lineTo(left + bag.bw - 3, top + bag.bh * 0.19);
    ctx.stroke();

    // Handle.
    ctx.strokeStyle = withAlpha('#5d3b24', 0.72);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, top + 13, bag.bw * 0.18, bag.bh * 0.06, 0, Math.PI, 0);
    ctx.stroke();

    if (index === 1) {
      ctx.fillStyle = '#ead9b9';
      ctx.strokeStyle = withAlpha(INK, 0.6);
      ctx.lineWidth = 0.8;
      ctx.fillRect(-bag.bw * 0.23, top + bag.bh * 0.38, bag.bw * 0.46, bag.bh * 0.17);
      ctx.strokeRect(
        -bag.bw * 0.23,
        top + bag.bh * 0.38,
        bag.bw * 0.46,
        bag.bh * 0.17,
      );
      ctx.fillStyle = '#4e3422';
      ctx.font = '700 5px "Nunito", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BEANS', 0, top + bag.bh * 0.48);
      ctx.font = '500 3.5px "Nunito", sans-serif';
      ctx.fillText('DARK ROAST', 0, top + bag.bh * 0.53);
    }
    ctx.restore();
    ctx.restore();
    ctx.save();
    ctx.translate(w / 2, h);
  });

  // A twine tie.
  ctx.strokeStyle = withAlpha('#4c2f1d', 0.55);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-w * 0.17, -h * 0.47);
  ctx.quadraticCurveTo(-w * 0.35, -h * 0.38, -w * 0.28, -h * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawSugarPackets(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  variant: number,
): void {
  const accents = ['#b65b3b', '#71846b', '#6f7d8c'];
  const accent = accents[variant % accents.length];
  const packets = [
    { x: w * 0.04, y: h * 0.13, pw: w * 0.38, ph: h * 0.72, rot: -0.17 },
    { x: w * 0.35, y: h * 0.08, pw: w * 0.34, ph: h * 0.78, rot: 0.06 },
    { x: w * 0.65, y: h * 0.2, pw: w * 0.34, ph: h * 0.66, rot: 0.16 },
  ];
  for (let index = 0; index < packets.length; index++) {
    const packet = packets[index];
    ctx.save();
    ctx.translate(packet.x + packet.pw / 2, h * 0.96);
    ctx.rotate(packet.rot);
    const top = -packet.ph;
    // Zigzag top.
    ctx.beginPath();
    ctx.moveTo(-packet.pw / 2, top + 4);
    ctx.lineTo(-packet.pw * 0.25, top - 2);
    ctx.lineTo(0, top + 3);
    ctx.lineTo(packet.pw * 0.25, top - 1);
    ctx.lineTo(packet.pw / 2, top + 4);
    ctx.lineTo(packet.pw / 2, 0);
    ctx.lineTo(-packet.pw / 2, 0);
    ctx.closePath();
    ctx.fillStyle = index === 1 ? '#f4e8d2' : '#eee0c7';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.fillStyle = withAlpha(accent, 0.9);
    ctx.fillRect(-packet.pw / 2 + 1, top + packet.ph * 0.3, packet.pw - 2, packet.ph * 0.32);
    ctx.fillStyle = '#f8edda';
    ctx.font = '800 4.5px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SUGAR', 0, top + packet.ph * 0.46);
    ctx.strokeStyle = withAlpha(INK, 0.15);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(-packet.pw / 2 + 2, top + packet.ph * 0.22);
    ctx.lineTo(packet.pw / 2 - 2, top + packet.ph * 0.22);
    ctx.stroke();
    ctx.restore();
  }
  drawPencilLine(
    ctx,
    [
      [w * 0.18, h * 0.74],
      [w * 0.4, h * 0.82],
      [w * 0.58, h * 0.73],
    ],
    withAlpha(INK, 0.2),
    0.8,
    91,
  );
}

export function drawCollectibleCup(
  ctx: CanvasRenderingContext2D,
  cup: CupView,
  time: number,
  accent: string,
  glow: string,
): void {
  ctx.save();
  // The simulation already bobs cup.y; don't add a second offset or the
  // visible cup drifts away from its pickup hitbox.
  ctx.translate(cup.x, cup.y);

  // Paper halo / readable silhouette against every world.
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 33, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#fff8e8';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.rotate(Math.sin(time * 1.8 + cup.phase) * 0.055);
  ctx.translate(0, 2);

  // Steam.
  ctx.strokeStyle = withAlpha('#fff8e6', 0.82);
  ctx.lineWidth = 1.3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const drift = Math.sin(time * 2 + i * 1.7 + cup.phase) * 2.5;
    ctx.beginPath();
    ctx.moveTo(-6 + i * 10, -29);
    ctx.bezierCurveTo(
      -10 + i * 10 + drift,
      -36,
      -3 + i * 10 + drift,
      -39,
      -7 + i * 10 + drift,
      -45,
    );
    ctx.stroke();
  }

  drawTinyPaperCup(ctx, 0, 0, 1, accent);
  ctx.restore();

  // Little paper sparkles around it.
  ctx.fillStyle = withAlpha(glow, 0.9);
  ctx.beginPath();
  ctx.arc(24, -20 + Math.sin(time * 3 + cup.phase) * 3, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-22, 14 + Math.cos(time * 2.2 + cup.phase) * 3, 1.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(-19, -30 + Math.sin(time * 2.5 + cup.phase) * 2);
  ctx.rotate(time * 0.7);
  ctx.fillStyle = withAlpha('#fff8e8', 0.92);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const length = i % 2 === 0 ? 4 : 1.5;
    ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** The cup itself, centred on (x, y), with the lid around -24. */
export function drawTinyPaperCup(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  accent: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Cup body.
  ctx.beginPath();
  ctx.moveTo(-16, -20);
  ctx.lineTo(16, -20);
  ctx.lineTo(11, 22);
  ctx.quadraticCurveTo(0, 28, -11, 22);
  ctx.closePath();
  ctx.fillStyle = '#f4e5ca';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Kraft sleeve with hand-drawn logo.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-14, -3);
  ctx.lineTo(14, -3);
  ctx.lineTo(12, 15);
  ctx.lineTo(-12, 15);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.stroke();
  drawHeart(ctx, 0, 5, 11, withAlpha('#f8ecd6', 0.92));
  ctx.restore();

  // Lid.
  roundedRectPath(ctx, -19, -28, 38, 9, 3);
  ctx.fillStyle = '#543724';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#f0dfc2';
  ctx.fillRect(-15, -20, 30, 2.4);
  ctx.strokeStyle = withAlpha(INK, 0.4);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(-8, -27);
  ctx.lineTo(8, -27);
  ctx.stroke();

  // Tiny sleeve stitch.
  ctx.strokeStyle = withAlpha('#f7e9cd', 0.4);
  ctx.lineWidth = 0.7;
  ctx.setLineDash([1.5, 2.5]);
  ctx.beginPath();
  ctx.moveTo(-11, 12);
  ctx.lineTo(11, 12);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
