import type { WorldDef } from '../core/types';
import { drawTinyPaperCup } from '../render/Props';

type ParticleShape = 'paper' | 'spark' | 'dust' | 'steam' | 'cup';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
  spin: number;
  shape: ParticleShape;
  color: string;
}

export class ParticleSystem {
  private readonly pool: Particle[] = [];
  private cursor = 0;

  constructor(private readonly reducedMotion: boolean) {
    const count = reducedMotion ? 42 : 96;
    for (let i = 0; i < count; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        gravity: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        rotation: 0,
        spin: 0,
        shape: 'paper',
        color: '#fff',
      });
    }
  }

  update(dt: number): void {
    for (const particle of this.pool) {
      if (!particle.active) continue;
      particle.life -= dt;
      if (particle.life <= 0) {
        particle.active = false;
        continue;
      }
      particle.vy += particle.gravity * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.rotation += particle.spin * dt;
      if (particle.shape === 'steam') {
        particle.vx *= 0.99;
        particle.vy -= 2 * dt;
      }
    }
  }

  emitCup(x: number, y: number, world: WorldDef): void {
    // A little ghost of the cup hops, spins and crumples into paper confetti.
    this.spawn({
      x,
      y,
      vx: 10,
      vy: -145,
      gravity: 380,
      life: 0.52,
      size: 0.62,
      shape: 'cup',
      color: world.palette.accent,
    });
    const paperColors = [
      '#f5e6c8',
      world.palette.accentSoft,
      world.palette.glow,
      '#ffffff',
    ];
    const amount = this.reducedMotion ? 7 : 13;
    for (let i = 0; i < amount; i++) {
      const angle = -Math.PI * (0.15 + Math.random() * 0.7);
      const speed = 80 + Math.random() * 190;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        gravity: 520,
        life: 0.45 + Math.random() * 0.45,
        size: 3 + Math.random() * 5,
        shape: 'paper',
        color: paperColors[i % paperColors.length],
      });
    }
    if (!this.reducedMotion) {
      for (let i = 0; i < 5; i++) {
        const angle = Math.random() * Math.PI * 2;
        this.spawn({
          x,
          y,
          vx: Math.cos(angle) * (30 + Math.random() * 70),
          vy: Math.sin(angle) * (30 + Math.random() * 60),
          gravity: 40,
          life: 0.35 + Math.random() * 0.3,
          size: 2 + Math.random() * 3,
          shape: 'spark',
          color: world.palette.glow,
        });
      }
    }
  }

  emitLand(x: number, y: number, color: string): void {
    const amount = this.reducedMotion ? 2 : 4;
    for (let i = 0; i < amount; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 24,
        y: y - 3,
        vx: (Math.random() - 0.5) * 80,
        vy: -20 - Math.random() * 30,
        gravity: 80,
        life: 0.25 + Math.random() * 0.2,
        size: 3 + Math.random() * 5,
        shape: 'dust',
        color,
      });
    }
  }

  emitCrash(x: number, y: number, world: WorldDef): void {
    const amount = this.reducedMotion ? 8 : 18;
    for (let i = 0; i < amount; i++) {
      const angle = -Math.PI * (0.05 + Math.random() * 0.9);
      const speed = 100 + Math.random() * 280;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 800,
        life: 0.55 + Math.random() * 0.6,
        size: 3 + Math.random() * 6,
        shape: 'paper',
        color: i % 3 === 0 ? world.palette.accentSoft : '#f0dfc1',
      });
    }
  }

  private spawn(options: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gravity: number;
    life: number;
    size: number;
    shape: ParticleShape;
    color: string;
  }): void {
    const particle = this.freeParticle();
    if (!particle) return;
    particle.active = true;
    particle.x = options.x;
    particle.y = options.y;
    particle.vx = options.vx;
    particle.vy = options.vy;
    particle.gravity = options.gravity;
    particle.life = options.life;
    particle.maxLife = options.life;
    particle.size = options.size;
    particle.shape = options.shape;
    particle.color = options.color;
    particle.rotation = Math.random() * Math.PI * 2;
    particle.spin = (Math.random() - 0.5) * 9;
  }

  private freeParticle(): Particle | null {
    for (let i = 0; i < this.pool.length; i++) {
      const index = (this.cursor + i) % this.pool.length;
      if (!this.pool[index].active) {
        this.cursor = (index + 1) % this.pool.length;
        return this.pool[index];
      }
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const particle of this.pool) {
      if (!particle.active) continue;
      const alpha = Math.min(1, particle.life / (particle.maxLife * 0.7));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      if (particle.shape === 'paper') {
        ctx.beginPath();
        ctx.moveTo(-particle.size, -particle.size * 0.45);
        ctx.lineTo(particle.size * 0.8, -particle.size);
        ctx.lineTo(particle.size, particle.size * 0.6);
        ctx.lineTo(-particle.size * 0.6, particle.size);
        ctx.closePath();
        ctx.fill();
      } else if (particle.shape === 'cup') {
        ctx.rotate(particle.rotation * 1.8);
        drawTinyPaperCup(ctx, 0, 0, particle.size, particle.color);
      } else if (particle.shape === 'spark') {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2;
          ctx.lineTo(
            Math.cos(angle) * particle.size,
            Math.sin(angle) * particle.size,
          );
          ctx.lineTo(
            Math.cos(angle + Math.PI / 4) * particle.size * 0.35,
            Math.sin(angle + Math.PI / 4) * particle.size * 0.35,
          );
        }
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  reset(): void {
    for (const particle of this.pool) particle.active = false;
  }
}
