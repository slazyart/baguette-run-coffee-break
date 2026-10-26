import type { SkinDef } from '../core/types';
import {
  drawHeart,
  drawShadow,
  drawStar,
  mulberry32,
  withAlpha,
} from './DrawUtils';
import { drawTinyPaperCup } from './Props';

export type CharacterMode = 'run' | 'jump' | 'fall' | 'idle' | 'dead';

export interface BaguettePose {
  x: number;
  baseline: number;
  groundY: number;
  scale: number;
  mode: CharacterMode;
  runPhase: number;
  landing: number;
  happy: number;
  deathProgress: number;
  time: number;
  velocity: number;
}

interface LimbPose {
  backHand: [number, number];
  frontHand: [number, number];
  backElbow: [number, number];
  frontElbow: [number, number];
  feet: [
    { x: number; y: number; angle: number },
    { x: number; y: number; angle: number },
  ];
}

export function drawBaguette(
  ctx: CanvasRenderingContext2D,
  skin: SkinDef,
  pose: BaguettePose,
): void {
  const scale = pose.scale;
  const elevation = Math.max(0, pose.groundY - pose.baseline);
  const shadowScale = 1 - Math.min(0.35, elevation / 420);
  drawShadow(
    ctx,
    pose.x + 3,
    pose.groundY + 3,
    28 * scale * shadowScale,
    6.5 * scale * shadowScale,
    pose.mode === 'dead' ? 0.12 : 0.19 * (1 - Math.min(0.72, elevation / 270)),
  );

  const runWave = Math.sin(pose.runPhase * Math.PI * 2);
  const runWave2 = Math.sin(pose.runPhase * Math.PI * 2 + Math.PI);
  const landingT = pose.landing > 0 ? pose.landing / 0.16 : 0;
  const happyT = pose.happy > 0 ? Math.min(1, pose.happy / 0.24) : 0;
  const dead = pose.mode === 'dead' ? pose.deathProgress : 0;

  let squashX = 1;
  let squashY = 1;
  let bob = 0;
  let tilt = 0;
  if (pose.mode === 'run') {
    bob = Math.abs(runWave) * 2.1;
    squashX += Math.abs(runWave) * 0.015;
    squashY -= Math.abs(runWave) * 0.012;
    tilt = runWave * 0.012;
  } else if (pose.mode === 'idle') {
    bob = Math.abs(Math.sin(pose.time * 1.6)) * 2.2;
    squashX = 1 + Math.sin(pose.time * 1.6) * 0.008;
    squashY = 1 - Math.sin(pose.time * 1.6) * 0.006;
    tilt = Math.sin(pose.time * 0.72) * 0.012;
  } else if (pose.mode === 'jump') {
    const takeoff = pose.groundY - pose.baseline < 18;
    squashY = takeoff ? 0.955 : 1.045;
    squashX = takeoff ? 1.055 : 0.968;
    tilt = takeoff ? 0.02 : 0.045;
  } else if (pose.mode === 'fall') {
    squashY = 1.02;
    squashX = 0.988;
    tilt = -0.02;
  }
  if (landingT > 0) {
    squashX += landingT * 0.12;
    squashY -= landingT * 0.15;
  }
  if (happyT > 0) {
    squashX += happyT * 0.02;
    squashY -= Math.sin(happyT * Math.PI) * 0.03;
    bob += Math.sin(happyT * Math.PI) * 5;
  }

  const limbs = getLimbPose(pose, runWave, runWave2);

  ctx.save();
  ctx.translate(pose.x, pose.baseline + dead * 5);
  if (dead > 0) {
    ctx.rotate(dead * 1.28);
    ctx.translate(0, dead * -4);
    squashX += dead * 0.3;
    squashY -= dead * 0.16;
    tilt = 0;
    bob = 0;
  }
  ctx.rotate(tilt);
  ctx.translate(0, -bob);
  ctx.scale(scale * squashX, scale * squashY);

  // Back arm, legs, and front arm are drawn in layers around the body.
  drawArm(ctx, skin, limbs.backHand, limbs.backElbow);
  drawLegs(ctx, skin, limbs.feet);

  drawBody(ctx, skin, pose);

  drawFace(ctx, skin, pose);
  drawAccessory(ctx, skin, pose, limbs);
  drawArm(ctx, skin, limbs.frontHand, limbs.frontElbow);

  // Paper blush bits and a happy coffee-heart.
  if (happyT > 0.2) {
    const alpha = Math.min(1, happyT);
    drawHeart(
      ctx,
      28,
      -143 - Math.sin(pose.time * 9) * 4,
      9 + alpha * 5,
      withAlpha(skin.accent, alpha * 0.9),
    );
    drawStar(
      ctx,
      -31,
      -112 + Math.sin(pose.time * 7) * 4,
      4,
      withAlpha(skin.bodyLight, alpha),
      pose.time,
    );
  }

  if (pose.mode === 'dead') {
    drawDeadStars(ctx, pose, skin);
  }

  ctx.restore();
}

function drawBody(
  ctx: CanvasRenderingContext2D,
  skin: SkinDef,
  pose: BaguettePose,
): void {
  const bodyPath = new Path2D();
  bodyPath.moveTo(-16, -8);
  bodyPath.bezierCurveTo(-25, -22, -31, -67, -23, -100);
  bodyPath.bezierCurveTo(-19, -119, -5, -134, 9, -128);
  bodyPath.bezierCurveTo(24, -122, 29, -99, 26, -71);
  bodyPath.bezierCurveTo(24, -44, 23, -20, 14, -8);
  bodyPath.bezierCurveTo(4, 1, -7, 1, -16, -8);
  bodyPath.closePath();

  ctx.save();
  ctx.fillStyle = skin.bodyMid;
  ctx.fill(bodyPath);

  // Clip all printed details to the crust silhouette.
  ctx.save();
  ctx.clip(bodyPath);

  // Soft paper highlight down the left side.
  ctx.fillStyle = withAlpha(skin.bodyLight, 0.8);
  ctx.beginPath();
  ctx.moveTo(-24, -19);
  ctx.bezierCurveTo(-31, -66, -23, -103, -15, -122);
  ctx.bezierCurveTo(-1, -127, 7, -117, 5, -105);
  ctx.bezierCurveTo(-2, -90, -3, -64, 1, -43);
  ctx.bezierCurveTo(3, -24, -1, -10, -8, -3);
  ctx.closePath();
  ctx.fill();

  // Warmer toasted edge on the right.
  ctx.fillStyle = withAlpha(skin.crust, 0.38);
  ctx.beginPath();
  ctx.moveTo(13, -127);
  ctx.bezierCurveTo(25, -117, 30, -91, 26, -65);
  ctx.bezierCurveTo(23, -40, 20, -16, 11, -7);
  ctx.bezierCurveTo(19, -31, 20, -57, 20, -81);
  ctx.bezierCurveTo(20, -102, 18, -115, 13, -127);
  ctx.closePath();
  ctx.fill();

  // Flour / roast speckles.
  const speckles = [
    [-18, -112, 1.1], [8, -124, 0.8], [18, -107, 1.2], [-14, -54, 0.9],
    [9, -36, 1.3], [16, -77, 0.7], [-17, -87, 1.1], [2, -58, 0.8],
    [19, -48, 1.0], [-8, -23, 0.7], [13, -15, 0.9], [-21, -37, 0.8],
  ];
  for (const [x, y, radius] of speckles) {
    ctx.fillStyle = withAlpha(
      (x + y) % 2 === 0 ? skin.crustDark : skin.bodyLight,
      0.34,
    );
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 1.6, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPattern(ctx, skin, pose);

  ctx.restore();

  // Real pencil-ish outline, plus a faint second pass.
  ctx.strokeStyle = skin.ink;
  ctx.lineWidth = 2.3;
  ctx.lineJoin = 'round';
  ctx.stroke(bodyPath);
  ctx.strokeStyle = withAlpha(skin.ink, 0.32);
  ctx.lineWidth = 0.8;
  ctx.stroke(bodyPath);

  // A few little crust cracks.
  ctx.strokeStyle = withAlpha(skin.crustDark, 0.68);
  ctx.lineWidth = 1.1;
  ctx.lineCap = 'round';
  const random = mulberry32(41);
  for (let i = 0; i < 4; i++) {
    const x = -20 + random() * 39;
    const y = -122 + random() * 105;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 2, y + 3, x + 4, y + 3.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  skin: SkinDef,
  pose: BaguettePose,
): void {
  const scorePositions = [
    [-2, -91],
    [-1, -68],
    [0, -45],
  ];

  for (let i = 0; i < scorePositions.length; i++) {
    const [x, y] = scorePositions[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.46);
    const width = 26 - i * 1.2;
    ctx.beginPath();
    ctx.moveTo(-width / 2, 0);
    ctx.quadraticCurveTo(0, -6.2, width / 2, -0.5);
    ctx.quadraticCurveTo(0, 4.2, -width / 2, 0);
    ctx.closePath();
    ctx.fillStyle =
      skin.pattern === 'latte'
        ? withAlpha(skin.bodyLight, 0.95)
        : withAlpha(skin.crustDark, 0.74);
    ctx.fill();
    ctx.strokeStyle = withAlpha(skin.ink, 0.5);
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.strokeStyle = withAlpha(skin.bodyLight, 0.65);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-width * 0.35, -1.3);
    ctx.quadraticCurveTo(0, -4.3, width * 0.32, -1.5);
    ctx.stroke();
    ctx.restore();
  }

  if (skin.pattern === 'espresso') {
    ctx.fillStyle = withAlpha(skin.crustDark, 0.55);
    for (const [x, y, rx, ry] of [
      [15, -99, 5, 8],
      [-16, -72, 4, 6],
      [12, -21, 3, 5],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (skin.pattern === 'latte') {
    ctx.strokeStyle = withAlpha(skin.crustDark, 0.42);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(7, -34, 9, 0.3, 4.5);
    ctx.stroke();
    drawHeart(ctx, 8, -55, 10, withAlpha(skin.bodyLight, 0.92));
    drawHeart(ctx, -9, -25, 7, withAlpha(skin.paper, 0.7));
    ctx.strokeStyle = withAlpha(skin.bodyLight, 0.8);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-7, -104, 5, 0.1, 4.8);
    ctx.stroke();
  }

  if (skin.pattern === 'matcha') {
    ctx.save();
    ctx.translate(0, -22);
    ctx.rotate(-0.05);
    ctx.fillStyle = '#e7e0c3';
    ctx.strokeStyle = withAlpha(skin.ink, 0.68);
    ctx.lineWidth = 0.8;
    ctx.fillRect(-21, 0, 42, 17);
    ctx.strokeRect(-21, 0, 42, 17);
    ctx.fillStyle = withAlpha(skin.accent, 0.9);
    ctx.fillRect(-21, 0, 5, 17);
    ctx.fillStyle = skin.ink;
    ctx.font = '800 5px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MATCHA', 2, 8);
    ctx.font = '500 3.2px "Nunito", sans-serif';
    ctx.fillText('STONE GROUND', 2, 12.7);
    ctx.strokeStyle = withAlpha(skin.accent, 0.75);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(15, 4.6, 2.3, 3.4, 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (skin.pattern === 'barista') {
    ctx.save();
    ctx.translate(0, -10);
    // Apron bib and skirt.
    ctx.beginPath();
    ctx.moveTo(-15, -44);
    ctx.quadraticCurveTo(0, -50, 15, -43);
    ctx.lineTo(18, -10);
    ctx.quadraticCurveTo(0, 1, -18, -10);
    ctx.closePath();
    ctx.fillStyle = '#3b5146';
    ctx.fill();
    ctx.strokeStyle = withAlpha(skin.ink, 0.78);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Neck straps.
    ctx.strokeStyle = withAlpha('#d8c29e', 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-12, -43);
    ctx.lineTo(-10, -59);
    ctx.moveTo(12, -43);
    ctx.lineTo(10, -59);
    ctx.stroke();
    // Pocket.
    ctx.fillStyle = withAlpha('#597063', 0.9);
    ctx.fillRect(-10, -29, 20, 12);
    ctx.strokeStyle = withAlpha('#e3d5b7', 0.55);
    ctx.strokeRect(-10, -29, 20, 12);
    // Embroidered bean.
    ctx.fillStyle = '#e4d3b0';
    ctx.beginPath();
    ctx.ellipse(0, -23, 3.4, 4.6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4b3e2b';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.quadraticCurveTo(2, -23, 0, -20);
    ctx.stroke();
    // Towel on a tiny string.
    ctx.fillStyle = '#e7d7ba';
    ctx.fillRect(19, -39, 7, 17);
    ctx.strokeStyle = withAlpha(skin.ink, 0.5);
    ctx.strokeRect(19, -39, 7, 17);
    ctx.restore();
  }

  if (skin.pattern === 'iced') {
    ctx.fillStyle = withAlpha('#c8dde0', 0.46);
    for (const [x, y] of [
      [-15, -112],
      [19, -33],
      [-12, -60],
    ]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(0.4);
      ctx.fillRect(-3, -3, 6, 6);
      ctx.strokeStyle = withAlpha(skin.ink, 0.26);
      ctx.lineWidth = 0.6;
      ctx.strokeRect(-3, -3, 6, 6);
      ctx.restore();
    }
    ctx.strokeStyle = withAlpha('#f4f1e8', 0.6);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(12, -92, 8, 3.6, 5.6);
    ctx.stroke();
  }

  if (skin.pattern === 'cinnamon') {
    ctx.strokeStyle = withAlpha(skin.crustDark, 0.7);
    ctx.lineWidth = 1.5;
    for (const [cx, cy, radius] of [
      [-2, -55, 9],
      [8, -31, 6],
    ]) {
      ctx.beginPath();
      for (let i = 0; i < 28; i++) {
        const angle = (i / 28) * Math.PI * 3;
        const r = (i / 28) * radius;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(15, -83);
    ctx.rotate(0.18);
    ctx.fillStyle = '#f0dfc0';
    ctx.fillRect(-7, -5, 14, 10);
    ctx.strokeStyle = withAlpha(skin.ink, 0.55);
    ctx.strokeRect(-7, -5, 14, 10);
    ctx.fillStyle = skin.crustDark;
    ctx.font = '800 3.4px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CINNAMON', 0, 2);
    ctx.restore();
  }

  if (skin.pattern === 'beans') {
    for (const [x, y, rotation, scale] of [
      [-10, -82, -0.4, 1],
      [12, -57, 0.4, 0.85],
      [-6, -32, -0.2, 0.7],
    ]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);
      ctx.fillStyle = withAlpha(skin.crustDark, 0.78);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.2, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(skin.bodyLight, 0.5);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -4.5);
      ctx.bezierCurveTo(2, -1, -2, 1, 0.4, 4.4);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (skin.pattern === 'croissant') {
    ctx.fillStyle = withAlpha(skin.bodyLight, 0.52);
    for (const [x, y, r] of [
      [-12, -86, 4],
      [15, -68, 3],
      [-8, -31, 3.4],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    drawCroissant(ctx, 17, -109, 0.72, skin.crustDark, skin.bodyLight);
  }

  if (skin.pattern === 'gold') {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = skin.accent;
    ctx.fillRect(-24, -18, 48, 4.5);
    ctx.fillRect(-22, -83, 44, 2.4);
    ctx.fillStyle = withAlpha('#fff5c9', 0.8);
    ctx.fillRect(-22, -18.8, 44, 1.1);
    ctx.restore();
    ctx.save();
    ctx.translate(0, -33);
    ctx.rotate(-0.04);
    ctx.fillStyle = withAlpha('#f8edca', 0.95);
    ctx.fillRect(-15, -7, 30, 14);
    ctx.strokeStyle = skin.crustDark;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-15, -7, 30, 14);
    ctx.fillStyle = skin.crustDark;
    ctx.font = '800 4.4px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOLD ROAST', 0, 1.5);
    ctx.restore();
    for (const [x, y] of [
      [-18, -100],
      [20, -45],
      [-14, -22],
    ]) {
      drawStar(ctx, x, y, 2.4, withAlpha('#fff4b0', 0.9), pose.time * 0.2);
    }
  }
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  skin: SkinDef,
  pose: BaguettePose,
): void {
  const happy = pose.happy > 0.08;
  const jump = pose.mode === 'jump' || pose.mode === 'fall';
  const dead = pose.mode === 'dead';
  const idleBlink =
    pose.mode === 'idle' && pose.time % 4.6 > 4.48;
  const eyeY = -111;
  const eyeColor = skin.ink;
  const eyeWhite = withAlpha(skin.paper, 0.92);

  if (dead) {
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    for (const x of [-6, 9]) {
      ctx.beginPath();
      ctx.moveTo(x - 3.2, eyeY - 3.2);
      ctx.lineTo(x + 3.2, eyeY + 3.2);
      ctx.moveTo(x + 3.2, eyeY - 3.2);
      ctx.lineTo(x - 3.2, eyeY + 3.2);
      ctx.stroke();
    }
  } else if (happy) {
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    for (const x of [-6, 9]) {
      ctx.beginPath();
      ctx.moveTo(x - 4, eyeY + 1.2);
      ctx.quadraticCurveTo(x, eyeY - 3.5, x + 4, eyeY + 1.2);
      ctx.stroke();
    }
  } else if (idleBlink) {
    ctx.strokeStyle = eyeColor;
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    for (const x of [-6, 9]) {
      ctx.beginPath();
      ctx.moveTo(x - 2.6, eyeY);
      ctx.lineTo(x + 2.6, eyeY + 0.4);
      ctx.stroke();
    }
  } else {
    for (const x of [-6, 9]) {
      const eyeW = jump ? 6.2 : 5.6;
      const eyeH = jump ? 7.4 : 6.6;
      ctx.fillStyle = eyeWhite;
      ctx.beginPath();
      ctx.ellipse(x, eyeY, eyeW / 2, eyeH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = withAlpha(skin.ink, 0.64);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      const pupilX = x + 1.1;
      const pupilY = eyeY + (jump ? -0.2 : 0.8);
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.ellipse(
        pupilX,
        pupilY,
        jump ? 1.8 : 2.1,
        jump ? 2.5 : 2.8,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = withAlpha('#fff8e8', 0.9);
      ctx.beginPath();
      ctx.arc(pupilX - 0.7, pupilY - 1, 0.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Eyebrows: two small pencil flicks.
  ctx.strokeStyle = withAlpha(skin.ink, 0.72);
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  if (!dead) {
    ctx.beginPath();
    ctx.moveTo(-9.2, eyeY - (happy ? 8 : 6.5));
    ctx.quadraticCurveTo(-6, eyeY - (happy ? 9 : 8), -3, eyeY - (happy ? 7.5 : 6.4));
    ctx.moveTo(6.8, eyeY - 6.3);
    ctx.quadraticCurveTo(9.2, eyeY - 7.2, 11.5, eyeY - 5.7);
    ctx.stroke();
  }

  // Mouth.
  ctx.strokeStyle = skin.ink;
  ctx.fillStyle = skin.ink;
  ctx.lineWidth = 1.3;
  if (dead) {
    ctx.beginPath();
    ctx.ellipse(3.2, -99.4, 3.2, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (happy) {
    ctx.beginPath();
    ctx.moveTo(-1.5, -100.5);
    ctx.quadraticCurveTo(3, -93.2, 8.8, -100);
    ctx.closePath();
    ctx.fillStyle = withAlpha(skin.ink, 0.92);
    ctx.fill();
    ctx.fillStyle = withAlpha(skin.accent, 0.9);
    ctx.beginPath();
    ctx.ellipse(3.6, -96.8, 2, 1.2, 0, 0, Math.PI);
    ctx.fill();
  } else if (jump) {
    ctx.beginPath();
    ctx.ellipse(3.2, -98.5, 2.2, 2.9, 0, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(skin.ink, 0.78);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(-1, -99.5);
    ctx.quadraticCurveTo(3.5, -94.5, 8, -99.4);
    ctx.strokeStyle = withAlpha(skin.ink, 0.88);
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8.8, -99.8);
    ctx.quadraticCurveTo(10.2, -101.2, 10.8, -99.1);
    ctx.stroke();
  }

  // Blush + flour freckles.
  ctx.fillStyle = withAlpha(skin.accent, 0.2);
  ctx.beginPath();
  ctx.ellipse(-13.2, -104.5, 4, 2.3, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(16.4, -104.2, 3.5, 2, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha(skin.bodyLight, 0.55);
  for (const [x, y] of [
    [-14, -114],
    [16, -113],
    [-11, -95],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAccessory(
  ctx: CanvasRenderingContext2D,
  skin: SkinDef,
  pose: BaguettePose,
  limbs: LimbPose,
): void {
  if (skin.accessory === 'espresso-cup') {
    ctx.save();
    ctx.translate(limbs.frontHand[0] + 2, limbs.frontHand[1] + 2);
    ctx.rotate(0.13);
    drawTinyPaperCup(ctx, 0, 2, 0.38, skin.accent);
    ctx.restore();
  }

  if (skin.accessory === 'matcha-label') {
    ctx.save();
    ctx.translate(27, -56);
    ctx.rotate(0.16);
    ctx.strokeStyle = withAlpha(skin.ink, 0.65);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(4, 2);
    ctx.stroke();
    ctx.fillStyle = '#e6dfc3';
    ctx.strokeStyle = withAlpha(skin.ink, 0.7);
    ctx.fillRect(0, 2, 14, 12);
    ctx.strokeRect(0, 2, 14, 12);
    ctx.fillStyle = skin.accent;
    ctx.font = '800 3.3px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TEA', 7, 8.6);
    ctx.font = '500 2.5px "Nunito", sans-serif';
    ctx.fillText('NO. 04', 7, 11.8);
    ctx.restore();
  }

  if (skin.accessory === 'iced-straw') {
    ctx.save();
    ctx.translate(13, -126);
    ctx.rotate(0.24);
    ctx.fillStyle = '#e9ded0';
    ctx.fillRect(-3, -31, 6, 37);
    ctx.strokeStyle = withAlpha(skin.ink, 0.55);
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-3, -31, 6, 37);
    ctx.fillStyle = withAlpha(skin.accent, 0.9);
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-3, -29 + i * 7, 6, 3);
    }
    ctx.restore();
  }

  if (skin.accessory === 'cinnamon-stick') {
    ctx.save();
    ctx.translate(-25, -45);
    ctx.rotate(-0.55);
    ctx.fillStyle = '#8f5635';
    ctx.strokeStyle = withAlpha(skin.ink, 0.7);
    ctx.lineWidth = 0.7;
    ctx.fillRect(-2.8, -17, 5.6, 29);
    ctx.strokeRect(-2.8, -17, 5.6, 29);
    ctx.strokeStyle = withAlpha('#edc18f', 0.6);
    ctx.beginPath();
    ctx.moveTo(-1, -14);
    ctx.lineTo(-1, 9);
    ctx.stroke();
    ctx.restore();
  }

  if (skin.accessory === 'croissant-pin') {
    drawCroissant(ctx, 23, -115, 0.85, skin.crustDark, skin.bodyLight);
    ctx.fillStyle = withAlpha(skin.accent, 0.8);
    ctx.beginPath();
    ctx.arc(25, -115, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (skin.accessory === 'gold-label') {
    ctx.save();
    ctx.translate(-26, -37);
    ctx.rotate(-0.12);
    ctx.strokeStyle = withAlpha('#fff0ad', 0.8);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.fillStyle = '#e4bd61';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.lineTo(5, 12);
    ctx.lineTo(0, 16);
    ctx.lineTo(-5, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(skin.ink, 0.65);
    ctx.stroke();
    drawStar(ctx, 0, 7, 2.5, withAlpha('#fffbe1', 0.9));
    ctx.restore();
  }

  if (pose.mode === 'run' || pose.mode === 'idle') {
    // Tiny flour dust at the feet to make the paper puppet feel alive.
    const dust = Math.sin(pose.runPhase * Math.PI * 4 + pose.time * 2);
    ctx.fillStyle = withAlpha(skin.paper, 0.18);
    ctx.beginPath();
    ctx.ellipse(-18 + dust * 2, -1, 3.2, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function getLimbPose(
  pose: BaguettePose,
  runWave: number,
  runWave2: number,
): LimbPose {
  const phase = pose.runPhase * Math.PI * 2;
  if (pose.mode === 'run') {
    return {
      backElbow: [-26, -54 + runWave * 4],
      backHand: [-27 + runWave2 * 4, -40 - Math.max(0, runWave2) * 8],
      frontElbow: [25, -54 - runWave * 4],
      frontHand: [28 + runWave * 5, -39 - Math.max(0, runWave) * 8],
      feet: [
        {
          x: -10 + Math.max(0, runWave) * 7,
          y: -Math.max(0, runWave) * 8,
          angle: 0.08 + runWave * 0.1,
        },
        {
          x: 9 + Math.max(0, runWave2) * 8,
          y: -Math.max(0, runWave2) * 8,
          angle: -0.08 - runWave2 * 0.1,
        },
      ],
    };
  }

  if (pose.mode === 'jump' || pose.mode === 'fall') {
    return {
      backElbow: [-27, -65],
      backHand: [-31, -88 + Math.sin(phase) * 2],
      frontElbow: [26, -63],
      frontHand: [31, -84 + Math.cos(phase) * 2],
      feet: [
        { x: -13, y: -9, angle: -0.35 },
        { x: 12, y: -5, angle: 0.3 },
      ],
    };
  }

  if (pose.mode === 'idle') {
    const wave = Math.sin(pose.time * 4.2);
    return {
      backElbow: [-25, -51],
      backHand: [-27, -36],
      frontElbow: [26, -73],
      frontHand: [32 + wave * 3, -96 + Math.abs(wave) * 5],
      feet: [
        { x: -9, y: 0, angle: 0.04 },
        { x: 9, y: 0, angle: -0.04 },
      ],
    };
  }

  return {
    backElbow: [-28, -62],
    backHand: [-34, -43],
    frontElbow: [28, -60],
    frontHand: [34, -48],
    feet: [
      { x: -16, y: -4, angle: 0.4 },
      { x: 13, y: -2, angle: -0.4 },
    ],
  };
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  skin: SkinDef,
  feet: LimbPose['feet'],
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  feet.forEach((foot, index) => {
    const hipX = index === 0 ? -8 : 8;
    const hipY = -9;
    ctx.strokeStyle = withAlpha(skin.ink, 0.8);
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.quadraticCurveTo(
      (hipX + foot.x) / 2 + (index === 0 ? -2 : 2),
      -4,
      foot.x,
      foot.y,
    );
    ctx.stroke();
    ctx.strokeStyle = skin.crustDark;
    ctx.lineWidth = 2.7;
    ctx.stroke();

    ctx.save();
    ctx.translate(foot.x, foot.y);
    ctx.rotate(foot.angle);
    ctx.fillStyle = skin.crustDark;
    ctx.strokeStyle = skin.ink;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.ellipse(index === 0 ? -2 : 2, 0.5, 6.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = withAlpha(skin.bodyLight, 0.6);
    ctx.beginPath();
    ctx.ellipse(index === 0 ? 0 : 4, -0.5, 2, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  skin: SkinDef,
  hand: [number, number],
  elbow: [number, number],
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = withAlpha(skin.ink, 0.8);
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(hand[0] < 0 ? -19 : 19, -73);
  ctx.quadraticCurveTo(elbow[0], elbow[1], hand[0], hand[1]);
  ctx.stroke();
  ctx.strokeStyle = skin.crustDark;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = skin.bodyLight;
  ctx.strokeStyle = withAlpha(skin.ink, 0.75);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hand[0], hand[1], 3.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCroissant(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  crust: string,
  light: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.rotate(-0.3);
  ctx.fillStyle = crust;
  ctx.strokeStyle = '#3b281b';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  ctx.quadraticCurveTo(-5, -6, 0, -2);
  ctx.quadraticCurveTo(5, -6, 10, 2);
  ctx.quadraticCurveTo(3, 8, 0, 4);
  ctx.quadraticCurveTo(-4, 8, -10, 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = withAlpha(light, 0.7);
  ctx.lineWidth = 0.7;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3, -1);
    ctx.lineTo(i * 3.5, 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDeadStars(
  ctx: CanvasRenderingContext2D,
  pose: BaguettePose,
  skin: SkinDef,
): void {
  const t = Math.min(1, pose.deathProgress * 2.2);
  for (let i = 0; i < 3; i++) {
    const angle = pose.time * 2 + i * 2.1;
    drawStar(
      ctx,
      18 + Math.cos(angle) * 23,
      -100 + Math.sin(angle) * 8,
      3.5 * t,
      withAlpha(skin.accent, 0.9 * t),
      angle,
    );
  }
}
