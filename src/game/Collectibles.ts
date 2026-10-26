import type { CupView, ObstacleView } from '../core/types';
import { clamp } from './Physics';

interface Cup extends CupView {
  active: boolean;
  bobSeed: number;
}

export class Collectibles {
  readonly items: Cup[] = [];
  private timer = 13.2;
  private cursor = 0;

  constructor() {
    for (let i = 0; i < 10; i++) {
      this.items.push({
        active: false,
        x: 0,
        y: 0,
        phase: 0,
        collected: false,
        bobSeed: 0,
      });
    }
  }

  reset(): void {
    this.timer = 12.5 + Math.random() * 4;
    for (const cup of this.items) {
      cup.active = false;
      cup.collected = false;
    }
  }

  update(
    dt: number,
    speed: number,
    width: number,
    groundY: number,
    obstacles: readonly (ObstacleView & { active?: boolean })[],
  ): void {
    for (const cup of this.items) {
      if (!cup.active) continue;
      cup.x -= speed * dt;
      cup.phase += dt;
      cup.y = cup.bobSeed + Math.sin(cup.phase * 2.4) * 5;
      if (cup.x < -80) cup.active = false;
    }

    this.timer -= dt;
    if (this.timer > 0) return;

    const spawnX = width + Math.max(50, speed * 0.3);
    const collidesWithObstacle = obstacles.some(
      (obstacle) =>
        obstacle.active !== false &&
        Math.abs(obstacle.x - spawnX) < obstacle.width / 2 + 105,
    );
    if (collidesWithObstacle) {
      this.timer = 0.8;
      return;
    }

    const cup = this.freeCup();
    if (!cup) {
      this.timer = 1;
      return;
    }

    const highChance = Math.random();
    const heightAboveGround =
      highChance < 0.56
        ? clamp(100 + Math.random() * 45, 100, 145)
        : 49;
    cup.active = true;
    cup.collected = false;
    cup.x = spawnX;
    cup.bobSeed = groundY - heightAboveGround;
    cup.y = cup.bobSeed;
    cup.phase = Math.random() * 10;
    this.timer = 12 + Math.random() * 8;
  }

  collect(cup: Cup): void {
    cup.active = false;
    cup.collected = true;
  }

  private freeCup(): Cup | null {
    for (let i = 0; i < this.items.length; i++) {
      const index = (this.cursor + i) % this.items.length;
      if (!this.items[index].active) {
        this.cursor = (index + 1) % this.items.length;
        return this.items[index];
      }
    }
    return null;
  }

  get activeCount(): number {
    let count = 0;
    for (const cup of this.items) if (cup.active) count++;
    return count;
  }
}
