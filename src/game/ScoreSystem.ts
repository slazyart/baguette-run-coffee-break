const PIXELS_PER_METRE = 22;
const CUP_SCORE_BONUS = 20;

export class ScoreSystem {
  distancePx = 0;
  cups = 0;

  reset(): void {
    this.distancePx = 0;
    this.cups = 0;
  }

  update(dt: number, speed: number): void {
    this.distancePx += speed * dt;
  }

  collectCup(): void {
    this.cups += 1;
  }

  get distanceM(): number {
    return Math.floor(this.distancePx / PIXELS_PER_METRE);
  }

  get score(): number {
    return this.distanceM + this.cups * CUP_SCORE_BONUS;
  }

  get cupBonus(): number {
    return this.cups * CUP_SCORE_BONUS;
  }
}
