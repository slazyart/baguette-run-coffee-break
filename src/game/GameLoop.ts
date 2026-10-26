import { PHYSICS } from './Physics';

/**
 * One requestAnimationFrame loop for the current scene. Physics advances in a
 * fixed 60 Hz step so collisions are stable and a slow frame can never fling
 * the runner through an obstacle. Calling start() twice is harmless.
 */
export class GameLoop {
  private running = false;
  private raf = 0;
  private last = 0;
  private accumulator = 0;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.accumulator = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Call after a pause or visibility change so time never jumps forward. */
  resetClock(): void {
    this.last = performance.now();
    this.accumulator = 0;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const elapsed = Math.min(PHYSICS.maxFrameDelta, (now - this.last) / 1000);
    this.last = now;
    this.accumulator += Math.max(0, elapsed);

    let steps = 0;
    while (this.accumulator >= PHYSICS.fixedStep && steps < 4) {
      this.update(PHYSICS.fixedStep);
      this.accumulator -= PHYSICS.fixedStep;
      steps += 1;
    }

    // Do not let a long GC pause accumulate a debt that speeds up the game.
    if (steps === 4) this.accumulator = 0;

    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };
}
