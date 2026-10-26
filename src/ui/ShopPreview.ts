import type { SkinDef, WorldDef } from '../core/types';
import { BackgroundManager } from '../render/BackgroundManager';
import { drawBaguette } from '../render/CharacterRenderer';
import { drawHeart, drawStar, withAlpha } from '../render/DrawUtils';
import { drawTinyPaperCup } from '../render/Props';

/**
 * Animated fitting-room canvas. It intentionally uses the same character and
 * background renderers as the run so what you buy is exactly what you wear.
 */
export class ShopPreview {
  private ctx: CanvasRenderingContext2D | null = null;
  private background = new BackgroundManager();
  private raf = 0;
  private running = false;
  private startedAt = 0;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private skin: SkinDef | null = null;
  private world: WorldDef | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  setSelection(skin: SkinDef, world: WorldDef): void {
    this.skin = skin;
    this.world = world;
    this.background.setWorld(world);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startedAt = performance.now();
    this.resize();
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    if (
      width === this.width &&
      height === this.height &&
      dpr === this.dpr
    ) {
      return;
    }
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.background.resize(width, height, dpr);
  }

  private tick = (): void => {
    if (!this.running) return;
    this.resize();
    const ctx = this.ctx;
    if (!ctx || !this.skin || !this.world) {
      this.raf = requestAnimationFrame(this.tick);
      return;
    }

    const time = (performance.now() - this.startedAt) / 1000;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const groundY = h * 0.8;
    this.background.drawBackdrop(ctx, this.world, {
      groundY,
      distance: time * 30,
      time,
      reducedMotion: false,
    });

    const scale = Math.min(1.28, Math.max(0.78, h / 170));
    const baseline = groundY - 3 + Math.sin(time * 1.4) * 1.8;
    drawBaguette(ctx, this.skin, {
      x: w * 0.47,
      baseline,
      groundY: groundY + 2,
      scale,
      mode: 'idle',
      runPhase: 0,
      landing: 0,
      happy: 0,
      deathProgress: 0,
      time,
      velocity: 0,
    });

    ctx.save();
    ctx.translate(w * 0.8, groundY - h * 0.32);
    ctx.rotate(Math.sin(time * 0.8) * 0.06);
    drawTinyPaperCup(ctx, 0, 0, 0.78, this.world.palette.accent);
    ctx.restore();

    ctx.save();
    ctx.translate(w * 0.19, h * 0.24 + Math.sin(time * 0.9) * 5);
    ctx.rotate(-0.14);
    drawHeart(ctx, 0, 0, 13, withAlpha(this.world.palette.accent, 0.4));
    ctx.restore();
    for (let i = 0; i < 4; i++) {
      const x = w * (0.18 + i * 0.21);
      const y = h * 0.2 + ((i * 37 + time * 11) % (h * 0.48));
      drawStar(
        ctx,
        x,
        y,
        1.7 + (i % 2) * 1.2,
        withAlpha(this.world.palette.glow, 0.34),
        time * 0.4 + i,
      );
    }

    this.background.drawAmbient(ctx, this.world, {
      groundY,
      distance: time * 30,
      time,
      reducedMotion: false,
    });

    // Warm vignette to keep the character's face readable at card size.
    const vignette = ctx.createRadialGradient(
      w * 0.45,
      h * 0.5,
      h * 0.18,
      w * 0.5,
      h * 0.5,
      w * 0.7,
    );
    vignette.addColorStop(0, 'rgba(30,18,10,0)');
    vignette.addColorStop(1, withAlpha(this.world.palette.ink, 0.24));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    this.raf = requestAnimationFrame(this.tick);
  };
}
