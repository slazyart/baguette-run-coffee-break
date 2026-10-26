import { PHYSICS } from './Physics';

export class Player {
  x = 110;
  groundY = 600;
  height = 0;
  velocity = 0;
  grounded = true;
  runPhase = 0;
  landing = 0;
  happy = 0;
  hurt = 0;
  dead = false;
  private jumpBuffer = 0;
  private speedRatio = 1;

  reset(x: number, groundY: number): void {
    this.x = x;
    this.groundY = groundY;
    this.height = 0;
    this.velocity = 0;
    this.grounded = true;
    this.runPhase = 0;
    this.landing = 0;
    this.happy = 0;
    this.hurt = 0;
    this.dead = false;
    this.jumpBuffer = 0;
    this.speedRatio = 1;
  }

  /** Returns true when a jump was actually launched now. */
  jump(): boolean {
    if (this.dead) return false;
    if (this.grounded) {
      this.velocity = PHYSICS.jumpVelocity;
      this.grounded = false;
      this.height = 0.1;
      this.jumpBuffer = 0;
      return true;
    }
    // A tap slightly before touchdown is remembered, never converted into
    // repeated autojumps while the finger stays held.
    this.jumpBuffer = 0.12;
    return false;
  }

  update(dt: number, x: number, groundY: number, speed: number): void {
    this.x = x;
    this.groundY = groundY;
    this.speedRatio = speed / 330;
    this.runPhase += dt * (8.2 + this.speedRatio * 1.8);
    this.landing = Math.max(0, this.landing - dt);
    this.happy = Math.max(0, this.happy - dt);
    this.hurt = Math.max(0, this.hurt - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (!this.grounded) {
      this.velocity -= PHYSICS.gravity * dt;
      this.height += this.velocity * dt;
      if (this.height <= 0) {
        this.height = 0;
        this.velocity = 0;
        this.grounded = true;
        this.landing = 0.16;
        if (this.jumpBuffer > 0) {
          this.jumpBuffer = 0;
          this.velocity = PHYSICS.jumpVelocity;
          this.grounded = false;
          this.height = 0.1;
          this.landing = 0;
        }
      }
    }
  }

  collect(): void {
    this.happy = 0.55;
  }

  die(): void {
    this.dead = true;
    this.velocity = 0;
    this.hurt = 0.7;
  }

  get isGrounded(): boolean {
    return this.grounded;
  }

  get legSwing(): number {
    return Math.sin(this.runPhase * Math.PI * 2);
  }

  get bodyBob(): number {
    if (!this.grounded) return 0;
    return Math.abs(Math.sin(this.runPhase * Math.PI * 2)) * 2.2;
  }
}
