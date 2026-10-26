import type { ObstacleView } from '../core/types';

export const PHYSICS = {
  gravity: 2820,
  jumpVelocity: 1030,
  fixedStep: 1 / 60,
  maxFrameDelta: 0.05,
} as const;

export interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Vector {
  x: number;
  y: number;
}

export function getPlayerHitbox(
  x: number,
  groundY: number,
  heightAboveGround: number,
): Rect {
  const baseline = groundY - heightAboveGround;
  return {
    left: x - 14,
    right: x + 14,
    top: baseline - 92,
    bottom: baseline - 8,
  };
}

const HIT_INSETS: Record<
  ObstacleView['kind'],
  { x: number; top: number }
> = {
  napkin: { x: 9, top: 8 },
  box: { x: 6, top: 5 },
  bean: { x: 8, top: 7 },
  cup: { x: 7, top: 6 },
  bags: { x: 7, top: 4 },
  sugar: { x: 8, top: 7 },
};

export function getObstacleHitbox(
  obstacle: ObstacleView,
  groundY: number,
): Rect {
  const inset = HIT_INSETS[obstacle.kind];
  return {
    left: obstacle.x - obstacle.width / 2 + inset.x,
    right: obstacle.x + obstacle.width / 2 - inset.x,
    top: groundY - obstacle.height + inset.top,
    bottom: groundY,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

export function circleIntersectsRect(
  cx: number,
  cy: number,
  radius: number,
  rect: Rect,
): boolean {
  const closestX = clamp(cx, rect.left, rect.right);
  const closestY = clamp(cy, rect.top, rect.bottom);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= radius * radius;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}
