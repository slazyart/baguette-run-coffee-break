import type { CupView, ObstacleKind, ObstacleView } from '../core/types';
import { clamp, lerp } from './Physics';

interface Obstacle extends ObstacleView {
  active: boolean;
}

interface KindSpec {
  width: number;
  height: number;
  tier: number;
  weight: number;
}

const KINDS: Record<ObstacleKind, KindSpec> = {
  napkin: { width: 58, height: 42, tier: 0, weight: 17 },
  sugar: { width: 62, height: 36, tier: 0, weight: 16 },
  cup: { width: 44, height: 56, tier: 0.08, weight: 16 },
  bean: { width: 68, height: 47, tier: 0.2, weight: 15 },
  box: { width: 66, height: 67, tier: 0.2, weight: 16 },
  bags: { width: 59, height: 92, tier: 0.42, weight: 12 },
};

const LOW_KINDS: ObstacleKind[] = ['napkin', 'sugar', 'cup'];

export class ObstacleSpawner {
  readonly items: Obstacle[] = [];
  elapsed = 0;
  difficulty = 0;
  private poolCursor = 0;
  private spawnTimer = 2.15;
  private lastKind: ObstacleKind | null = null;
  private repeatCount = 0;

  constructor() {
    for (let i = 0; i < 22; i++) {
      this.items.push({
        active: false,
        kind: 'napkin',
        x: 0,
        width: 0,
        height: 0,
        variant: 0,
        phase: 0,
      });
    }
  }

  reset(): void {
    this.elapsed = 0;
    this.difficulty = 0;
    this.spawnTimer = 2.15;
    this.lastKind = null;
    this.repeatCount = 0;
    for (const item of this.items) item.active = false;
  }

  update(
    dt: number,
    speed: number,
    width: number,
    cups: readonly CupView[],
    running: boolean,
  ): void {
    for (const item of this.items) {
      if (!item.active) continue;
      item.x -= speed * dt;
      item.phase += dt;
      if (item.x < -140) item.active = false;
    }

    if (!running) return;
    this.elapsed += dt;
    this.difficulty = clamp(this.elapsed / 95, 0, 1);
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    const spawnX = width + Math.max(36, speed * 0.28);
    if (this.cupNear(spawnX, cups, 110)) {
      this.spawnTimer = 0.35;
      return;
    }

    const kind = this.pickKind();
    this.spawn(kind, spawnX);

    let extraWidth = 0;
    if (this.elapsed > 24 && this.difficulty > 0.16 && Math.random() < 0.19) {
      const partner = LOW_KINDS[Math.floor(Math.random() * LOW_KINDS.length)];
      const gap = 46 + Math.random() * 18;
      this.spawn(partner, spawnX + KINDS[kind].width / 2 + gap + KINDS[partner].width / 2);
      extraWidth = KINDS[partner].width + gap;
    }

    const gapSeconds =
      lerp(1.62, 1.06, this.difficulty) +
      Math.random() * lerp(0.36, 0.22, this.difficulty) +
      extraWidth / Math.max(speed, 1);
    this.spawnTimer = gapSeconds;
  }

  private cupNear(x: number, cups: readonly CupView[], distance: number): boolean {
    return cups.some(
      (cup) => !cup.collected && Math.abs(cup.x - x) < distance,
    );
  }

  private pickKind(): ObstacleKind {
    const choices: Array<[ObstacleKind, number]> = [];
    for (const [kind, spec] of Object.entries(KINDS) as Array<
      [ObstacleKind, KindSpec]
    >) {
      if (spec.tier > this.difficulty + 0.02) continue;
      let weight = spec.weight;
      if (this.elapsed < 14 && spec.height > 60) weight *= 0.25;
      if (this.lastKind === kind) weight *= this.repeatCount > 1 ? 0 : 0.3;
      choices.push([kind, weight]);
    }
    const total = choices.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    let picked: ObstacleKind = 'napkin';
    for (const [kind, weight] of choices) {
      roll -= weight;
      if (roll <= 0) {
        picked = kind;
        break;
      }
    }

    if (picked === this.lastKind) {
      this.repeatCount += 1;
      if (this.repeatCount > 1) {
        const alternatives = choices.filter(([kind]) => kind !== picked);
        if (alternatives.length > 0) {
          picked = alternatives[Math.floor(Math.random() * alternatives.length)][0];
          this.repeatCount = 0;
        }
      }
    } else {
      this.repeatCount = 0;
    }
    this.lastKind = picked;
    return picked;
  }

  private spawn(kind: ObstacleKind, x: number): void {
    const spec = KINDS[kind];
    const item = this.getFree();
    if (!item) return;
    const widthScale = 0.94 + Math.random() * 0.12;
    item.active = true;
    item.kind = kind;
    item.x = x;
    item.width = Math.round(spec.width * widthScale);
    item.height = Math.round(
      Math.min(96, spec.height * (0.94 + Math.random() * 0.1)),
    );
    item.variant = Math.floor(Math.random() * 3);
    item.phase = Math.random() * Math.PI * 2;
  }

  private getFree(): Obstacle | null {
    for (let i = 0; i < this.items.length; i++) {
      const index = (this.poolCursor + i) % this.items.length;
      if (!this.items[index].active) {
        this.poolCursor = (index + 1) % this.items.length;
        return this.items[index];
      }
    }
    return null;
  }

  get activeCount(): number {
    let count = 0;
    for (const item of this.items) if (item.active) count++;
    return count;
  }

  get nearestAhead(): number | null {
    let nearest: number | null = null;
    for (const item of this.items) {
      if (!item.active) continue;
      if (nearest === null || item.x < nearest) nearest = item.x;
    }
    return nearest;
  }
}
