import type { WorldDef } from '../core/types';
import {
  drawTape,
  fillPaperRect,
  makeCanvas,
  mulberry32,
  roundedRectPath,
  withAlpha,
} from './DrawUtils';
import { TextureFactory } from './TextureFactory';

interface BackgroundOptions {
  groundY: number;
  distance: number;
  time: number;
  reducedMotion: boolean;
  menu?: boolean;
}

interface WorldBackdrop {
  canvas: HTMLCanvasElement;
  key: string;
}

/**
 * Builds a soft, static paper set for each world, then layers animated cut-outs,
 * parallax props and a scrolling ground on top. Static backdrops are cached per
 * size/world so a run is mostly a handful of drawImage calls.
 */
export class BackgroundManager {
  private world: WorldDef | null = null;
  private backdrop: WorldBackdrop | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private readonly textures = new TextureFactory();

  setWorld(world: WorldDef): void {
    if (this.world?.id === world.id) return;
    this.world = world;
    this.backdrop = null;
  }

  resize(width: number, height: number, dpr: number): void {
    const nextWidth = Math.max(1, width);
    const nextHeight = Math.max(1, height);
    const nextDpr = Math.min(2, Math.max(1, dpr));
    if (
      Math.abs(this.width - nextWidth) < 0.5 &&
      Math.abs(this.height - nextHeight) < 0.5 &&
      Math.abs(this.dpr - nextDpr) < 0.01
    ) {
      return;
    }
    this.width = nextWidth;
    this.height = nextHeight;
    this.dpr = nextDpr;
    this.backdrop = null;
  }

  drawBackdrop(
    ctx: CanvasRenderingContext2D,
    world: WorldDef,
    options: BackgroundOptions,
  ): void {
    this.setWorld(world);
    this.ensureBackdrop(ctx);
    if (!this.backdrop) return;
    ctx.drawImage(this.backdrop.canvas, 0, 0, this.width, this.height);
    this.drawFarLayer(ctx, world, options);
    this.drawMidLayer(ctx, world, options);
    this.drawGround(ctx, world, options);
  }

  drawAmbient(
    ctx: CanvasRenderingContext2D,
    world: WorldDef,
    options: BackgroundOptions,
  ): void {
    if (options.reducedMotion) return;
    const t = options.time;
    if (world.kind === 'kitchen' || world.kind === 'cafe') {
      for (let i = 0; i < 3; i++) {
        const x = this.width * (0.18 + i * 0.31) + Math.sin(t * 0.3 + i) * 9;
        const y = options.groundY - this.height * (0.24 + i * 0.03);
        ctx.strokeStyle = withAlpha('#fff8e5', 0.17);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(
          x - 6,
          y - 18,
          x + 10,
          y - 24,
          x + 2 + Math.sin(t + i) * 4,
          y - 42,
        );
        ctx.stroke();
      }
    }
    if (world.kind === 'midnight') {
      for (let i = 0; i < 8; i++) {
        const x = ((i * 97 + t * (4 + i)) % (this.width + 40)) - 20;
        const y =
          this.height * 0.23 +
          ((i * 63 + Math.sin(t * 0.6 + i) * 30) % Math.max(40, options.groundY - 90));
        ctx.fillStyle = withAlpha('#ffd894', 0.16 + (i % 3) * 0.06);
        ctx.beginPath();
        ctx.arc(x, y, 1 + (i % 3) * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      const glow = ctx.createRadialGradient(
        this.width * 0.74,
        this.height * 0.22,
        3,
        this.width * 0.74,
        this.height * 0.22,
        this.width * 0.28,
      );
      glow.addColorStop(0, withAlpha('#ffc66d', 0.1));
      glow.addColorStop(1, withAlpha('#ffc66d', 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, this.width, this.height * 0.6);
    }
    if (world.kind === 'farm' || world.kind === 'matcha') {
      for (let i = 0; i < 6; i++) {
        const x = ((i * 83 + t * (7 + (i % 2) * 4)) % (this.width + 40)) - 20;
        const y =
          this.height * 0.24 +
          ((i * 71 + t * 3) % Math.max(60, options.groundY - 140));
        ctx.save();
        ctx.translate(x, y + Math.sin(t + i) * 6);
        ctx.rotate(t * 0.4 + i);
        ctx.fillStyle =
          world.kind === 'matcha'
            ? withAlpha('#70865f', 0.24)
            : withAlpha('#f0e1b6', 0.28);
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.7, 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    // A few lazy paper crumbs floating at all times.
    for (let i = 0; i < 4; i++) {
      const x =
        this.width * (0.12 + i * 0.26) + Math.sin(t * 0.2 + i * 2) * 12;
      const y =
        this.height * 0.55 +
        Math.cos(t * 0.28 + i) * 28 -
        (t * (2.6 + i * 0.4)) % 60;
      ctx.fillStyle = withAlpha(world.palette.glow, 0.24);
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + (i % 2) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private ensureBackdrop(ctx: CanvasRenderingContext2D): void {
    if (!this.world) return;
    const key = `${this.world.id}:${Math.round(this.width)}:${Math.round(
      this.height,
    )}`;
    if (this.backdrop?.key === key) return;

    const quality = Math.min(this.dpr, 1.5, this.width * this.height > 900_000 ? 1.2 : 1.5);
    const { canvas, ctx: bg } = makeCanvas(
      this.width,
      this.height,
      quality,
    );
    this.paintStaticBackdrop(bg, this.world);
    this.backdrop = { canvas, key };
    void ctx;
  }

  private paintStaticBackdrop(
    ctx: CanvasRenderingContext2D,
    world: WorldDef,
  ): void {
    const w = this.width;
    const h = this.height;
    const palette = world.palette;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(1, palette.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    if (world.kind === 'farm') {
      this.paintFarmSky(ctx, world);
    } else {
      ctx.fillStyle = this.textures.paperPattern(ctx, palette.wall);
      ctx.fillRect(0, 0, w, h);
      this.paintWallArchitecture(ctx, world);
    }

    // A gentle warm vignette keeps UI legible without looking like a mobile ad.
    const vignette = ctx.createRadialGradient(
      w / 2,
      h * 0.43,
      w * 0.24,
      w / 2,
      h * 0.47,
      w * 0.82,
    );
    vignette.addColorStop(0, withAlpha(palette.skyTop, 0));
    vignette.addColorStop(1, withAlpha(palette.ink, 0.16));
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    // Top-left corner tape, a subtle handmade signature.
    ctx.save();
    ctx.globalAlpha = 0.5;
    drawTape(ctx, w * 0.08, h * 0.035, Math.min(110, w * 0.27), -0.2, 'rgba(235,218,184,0.5)', 6);
    drawTape(ctx, w * 0.92, h * 0.035, Math.min(82, w * 0.18), 0.24, 'rgba(235,218,184,0.32)', 8);
    ctx.restore();

    // Fine grain is baked into the slow layer.
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = this.textures.grain(ctx);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  private paintWallArchitecture(
    ctx: CanvasRenderingContext2D,
    world: WorldDef,
  ): void {
    const w = this.width;
    const h = this.height;
    const p = world.palette;
    if (world.kind === 'kitchen') {
      // Window at the left.
      fillPaperRect(
        ctx,
        w * 0.055,
        h * 0.15,
        w * 0.35,
        h * 0.235,
        withAlpha('#f8ead1', 0.92),
        p.ink,
        17,
        1.4,
        1.2,
      );
      const win = ctx.createLinearGradient(
        w * 0.08,
        h * 0.15,
        w * 0.4,
        h * 0.38,
      );
      win.addColorStop(0, p.glow);
      win.addColorStop(1, withAlpha(p.accentSoft, 0.75));
      ctx.fillStyle = win;
      ctx.fillRect(w * 0.075, h * 0.167, w * 0.31, h * 0.205);
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(w * 0.23, h * 0.165);
      ctx.lineTo(w * 0.23, h * 0.373);
      ctx.moveTo(w * 0.075, h * 0.268);
      ctx.lineTo(w * 0.385, h * 0.268);
      ctx.stroke();
      ctx.fillStyle = withAlpha(p.ink, 0.1);
      ctx.beginPath();
      ctx.moveTo(w * 0.08, h * 0.17);
      ctx.lineTo(w * 0.21, h * 0.17);
      ctx.lineTo(w * 0.34, h * 0.48);
      ctx.lineTo(w * 0.18, h * 0.48);
      ctx.closePath();
      ctx.fill();

      // Upper cabinets on the right.
      fillPaperRect(
        ctx,
        w * 0.58,
        h * 0.14,
        w * 0.36,
        h * 0.19,
        withAlpha('#c8a06f', 0.94),
        p.ink,
        23,
        1.5,
        1.5,
      );
      ctx.strokeStyle = withAlpha(p.ink, 0.45);
      ctx.lineWidth = 1.1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.58 + (w * 0.36 * i) / 3, h * 0.15);
        ctx.lineTo(w * 0.58 + (w * 0.36 * i) / 3, h * 0.32);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const x = w * 0.58 + (w * 0.36 * (i + 0.5)) / 3;
        ctx.fillStyle = withAlpha(p.accent, 0.8);
        ctx.beginPath();
        ctx.arc(x, h * 0.235, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Kraft backsplash with printed coffee measures.
      ctx.save();
      ctx.globalAlpha = 0.27;
      ctx.strokeStyle = p.accent;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(w * (0.08 + i * 0.16), h * 0.48, 7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // A big friendly shelf silhouette.
      fillPaperRect(
        ctx,
        w * -0.02,
        h * 0.36,
        w * 0.48,
        h * 0.032,
        withAlpha('#8e6748', 0.55),
        withAlpha(p.ink, 0.3),
        31,
        1,
        0.8,
      );
      fillPaperRect(
        ctx,
        w * 0.54,
        h * 0.33,
        w * 0.5,
        h * 0.028,
        withAlpha('#8e6748', 0.48),
        withAlpha(p.ink, 0.25),
        37,
        1,
        0.8,
      );
    }

    if (world.kind === 'cafe') {
      // A generous arched window with morning light.
      ctx.save();
      ctx.beginPath();
      roundedRectPath(
        ctx,
        w * 0.56,
        h * 0.1,
        w * 0.37,
        h * 0.31,
        [w * 0.18, w * 0.18, 4, 4],
      );
      ctx.fillStyle = withAlpha('#f6e7c8', 0.95);
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink, 0.75);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.clip();
      const windowGlow = ctx.createLinearGradient(
        w * 0.56,
        h * 0.1,
        w * 0.9,
        h * 0.44,
      );
      windowGlow.addColorStop(0, p.glow);
      windowGlow.addColorStop(1, withAlpha(p.accentSoft, 0.5));
      ctx.fillStyle = windowGlow;
      ctx.fillRect(w * 0.56, h * 0.1, w * 0.37, h * 0.31);
      ctx.strokeStyle = withAlpha(p.ink, 0.62);
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(w * 0.56 + (w * 0.37 * i) / 4, h * 0.1);
        ctx.lineTo(w * 0.56 + (w * 0.37 * i) / 4, h * 0.41);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(w * 0.56, h * 0.25);
      ctx.lineTo(w * 0.93, h * 0.25);
      ctx.stroke();
      // Simple drawn skyline through the glass.
      ctx.fillStyle = withAlpha(p.mid, 0.3);
      for (let i = 0; i < 4; i++) {
        const bw = w * 0.06;
        const bh = h * (0.05 + (i % 3) * 0.02);
        ctx.fillRect(w * (0.59 + i * 0.085), h * 0.36 - bh, bw, bh);
      }
      ctx.restore();

      // Sunbeam.
      ctx.save();
      ctx.globalAlpha = 0.19;
      ctx.fillStyle = '#fff4d6';
      ctx.beginPath();
      ctx.moveTo(w * 0.66, h * 0.17);
      ctx.lineTo(w * 0.95, h * 0.2);
      ctx.lineTo(w * 0.62, h * 0.77);
      ctx.lineTo(w * 0.32, h * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Chalkboard menu on the left.
      fillPaperRect(
        ctx,
        w * 0.035,
        h * 0.22,
        w * 0.3,
        h * 0.22,
        '#39453c',
        p.ink,
        53,
        1.4,
        1.3,
      );
      ctx.fillStyle = withAlpha('#f3e5c9', 0.93);
      ctx.textAlign = 'center';
      ctx.font = '700 10px "Caveat", cursive';
      ctx.fillText('the good stuff', w * 0.185, h * 0.27);
      ctx.font = '600 5px "Nunito", sans-serif';
      ctx.fillText('FILTER  ·  FLAT WHITE', w * 0.185, h * 0.303);
      ctx.fillText('CORTADO  ·  TODAY', w * 0.185, h * 0.323);
      ctx.strokeStyle = withAlpha('#f3e5c9', 0.48);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(w * 0.085, h * 0.345);
      ctx.lineTo(w * 0.285, h * 0.342);
      ctx.stroke();
      ctx.fillStyle = withAlpha('#f3e5c9', 0.6);
      ctx.font = '500 4.2px "Nunito", sans-serif';
      ctx.fillText('no laptops after noon', w * 0.185, h * 0.375);

      // Awning at the upper-left edge.
      ctx.save();
      ctx.translate(w * 0.02, h * 0.105);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle =
          i % 2 === 0
            ? withAlpha(p.accent, 0.68)
            : withAlpha('#f1dfc4', 0.75);
        ctx.beginPath();
        ctx.moveTo(i * w * 0.055, 0);
        ctx.lineTo((i + 1) * w * 0.055, 0);
        ctx.lineTo((i + 1) * w * 0.055, h * 0.035);
        ctx.quadraticCurveTo(
          (i + 0.5) * w * 0.055,
          h * 0.055,
          i * w * 0.055,
          h * 0.035,
        );
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (world.kind === 'midnight') {
      // Tall night window.
      fillPaperRect(
        ctx,
        w * 0.56,
        h * 0.12,
        w * 0.34,
        h * 0.34,
        withAlpha('#1f2c2c', 0.9),
        withAlpha(p.ink, 0.75),
        67,
        1.4,
        1.1,
      );
      ctx.fillStyle = withAlpha('#dce0c5', 0.84);
      ctx.beginPath();
      ctx.arc(w * 0.71, h * 0.21, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = withAlpha('#253130', 0.8);
      for (let i = 0; i < 7; i++) {
        const x = w * (0.58 + i * 0.045);
        const bh = h * (0.035 + ((i * 7) % 5) * 0.012);
        ctx.fillRect(x, h * 0.4 - bh, w * 0.035, bh);
      }
      ctx.strokeStyle = withAlpha(p.ink, 0.6);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(w * 0.56, h * 0.26);
      ctx.lineTo(w * 0.9, h * 0.26);
      ctx.moveTo(w * 0.72, h * 0.12);
      ctx.lineTo(w * 0.72, h * 0.46);
      ctx.stroke();

      // Chalkboard with warm lettering.
      fillPaperRect(
        ctx,
        w * 0.05,
        h * 0.2,
        w * 0.32,
        h * 0.25,
        '#242c27',
        withAlpha(p.ink, 0.58),
        73,
        1.2,
        1.4,
      );
      ctx.fillStyle = withAlpha('#f4d697', 0.84);
      ctx.font = '700 11px "Caveat", cursive';
      ctx.textAlign = 'center';
      ctx.fillText('last call', w * 0.21, h * 0.26);
      ctx.font = '500 5px "Nunito", sans-serif';
      ctx.fillStyle = withAlpha('#f4d697', 0.6);
      ctx.fillText('espresso · amaro · quiet', w * 0.21, h * 0.295);
      ctx.strokeStyle = withAlpha('#f4d697', 0.35);
      ctx.beginPath();
      ctx.moveTo(w * 0.1, h * 0.32);
      ctx.lineTo(w * 0.32, h * 0.32);
      ctx.stroke();

      // Warm light pool near the left.
      const lampGlow = ctx.createRadialGradient(
        w * 0.22,
        h * 0.08,
        1,
        w * 0.22,
        h * 0.22,
        w * 0.3,
      );
      lampGlow.addColorStop(0, withAlpha('#ffc66a', 0.24));
      lampGlow.addColorStop(1, withAlpha('#ffc66a', 0));
      ctx.fillStyle = lampGlow;
      ctx.fillRect(0, 0, w, h * 0.55);
    }

    if (world.kind === 'matcha') {
      // Shoji panels with morning light.
      for (let side = 0; side < 2; side++) {
        const px = side === 0 ? w * 0.03 : w * 0.61;
        fillPaperRect(
          ctx,
          px,
          h * 0.13,
          w * 0.35,
          h * 0.27,
          withAlpha('#f5f3e2', 0.76),
          withAlpha(p.ink, 0.34),
          81 + side * 4,
          1,
          1.4,
        );
        ctx.strokeStyle = withAlpha(p.ink, 0.28);
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(px + (w * 0.35 * i) / 4, h * 0.13);
          ctx.lineTo(px + (w * 0.35 * i) / 4, h * 0.4);
          ctx.stroke();
        }
        for (let j = 1; j < 3; j++) {
          ctx.beginPath();
          ctx.moveTo(px, h * 0.13 + (h * 0.27 * j) / 3);
          ctx.lineTo(px + w * 0.35, h * 0.13 + (h * 0.27 * j) / 3);
          ctx.stroke();
        }
      }
      // Soft sun disc.
      ctx.fillStyle = withAlpha('#f0d89b', 0.58);
      ctx.beginPath();
      ctx.arc(w * 0.79, h * 0.27, w * 0.055, 0, Math.PI * 2);
      ctx.fill();
      // Hanging scroll.
      fillPaperRect(
        ctx,
        w * 0.32,
        h * 0.31,
        w * 0.035,
        h * 0.018,
        p.mid,
        p.ink,
        92,
        0.8,
        0.5,
      );
      fillPaperRect(
        ctx,
        w * 0.325,
        h * 0.325,
        w * 0.027,
        h * 0.15,
        withAlpha('#f2efd9', 0.8),
        withAlpha(p.ink, 0.45),
        93,
        0.8,
        0.8,
      );
      ctx.fillStyle = withAlpha(p.accent, 0.64);
      ctx.font = '700 12px "Caveat", cursive';
      ctx.textAlign = 'center';
      ctx.save();
      ctx.translate(w * 0.338, h * 0.37);
      ctx.rotate(Math.PI / 2);
      ctx.fillText('calm cup', 0, 0);
      ctx.restore();
      // Low shelf silhouette.
      fillPaperRect(
        ctx,
        w * 0.06,
        h * 0.4,
        w * 0.4,
        h * 0.026,
        withAlpha('#9c8a5f', 0.6),
        withAlpha(p.ink, 0.3),
        97,
        0.8,
        0.8,
      );
    }

    if (world.kind === 'bakery') {
      // Big arched display window.
      ctx.save();
      ctx.beginPath();
      roundedRectPath(
        ctx,
        w * 0.1,
        h * 0.13,
        w * 0.8,
        h * 0.36,
        [w * 0.24, w * 0.24, 6, 6],
      );
      ctx.fillStyle = withAlpha('#f9ebd0', 0.82);
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink, 0.63);
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.clip();
      const pastryGlow = ctx.createLinearGradient(0, h * 0.13, 0, h * 0.49);
      pastryGlow.addColorStop(0, withAlpha(p.glow, 0.98));
      pastryGlow.addColorStop(1, withAlpha(p.accentSoft, 0.45));
      ctx.fillStyle = pastryGlow;
      ctx.fillRect(w * 0.1, h * 0.13, w * 0.8, h * 0.36);
      ctx.fillStyle = withAlpha(p.ink, 0.18);
      ctx.fillRect(w * 0.5, h * 0.13, w * 0.02, h * 0.36);
      // Drawn breads on shelves.
      for (let row = 0; row < 2; row++) {
        const shelfY = h * (0.29 + row * 0.1);
        ctx.strokeStyle = withAlpha(p.mid, 0.6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.13, shelfY);
        ctx.lineTo(w * 0.87, shelfY);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const x = w * (0.18 + i * 0.14);
          if (i % 3 === 0) {
            ctx.fillStyle = withAlpha(p.mid, 0.36);
            ctx.beginPath();
            ctx.ellipse(x, shelfY - 8, w * 0.035, 8, -0.2, 0, Math.PI * 2);
            ctx.fill();
          } else if (i % 3 === 1) {
            ctx.fillStyle = withAlpha(p.accent, 0.3);
            ctx.beginPath();
            ctx.arc(x, shelfY - 6, 7, Math.PI, 0);
            ctx.fill();
          } else {
            ctx.fillStyle = withAlpha(p.groundDark, 0.3);
            ctx.beginPath();
            ctx.ellipse(x, shelfY - 5, w * 0.045, 5, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.restore();
      // Window frame and doily price tags.
      ctx.strokeStyle = withAlpha(p.ink, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w * 0.3, h * 0.23, w * 0.06, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(w * (0.3 + i * 0.2), h * 0.22 + i * 4);
        ctx.rotate(-0.08 + i * 0.04);
        fillPaperRect(
          ctx,
          -14,
          -8,
          28,
          16,
          withAlpha('#f8edd6', 0.8),
          withAlpha(p.ink, 0.35),
          101 + i,
          0.8,
          0.7,
        );
        ctx.fillStyle = withAlpha(p.ink, 0.58);
        ctx.font = '500 4px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText(i === 0 ? 'butter' : i === 1 ? 'seeded' : 'sweet', 0, 2);
        ctx.restore();
      }
    }
  }

  private paintFarmSky(
    ctx: CanvasRenderingContext2D,
    world: WorldDef,
  ): void {
    const w = this.width;
    const h = this.height;
    const p = world.palette;
    // Sun.
    ctx.fillStyle = withAlpha(p.glow, 0.9);
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.16, Math.min(56, w * 0.11), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(p.accentSoft, 0.17);
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.16, Math.min(82, w * 0.16), 0, Math.PI * 2);
    ctx.fill();

    // Paper clouds.
    for (let i = 0; i < 3; i++) {
      const x = w * (0.12 + i * 0.35);
      const y = h * (0.11 + (i % 2) * 0.055);
      ctx.fillStyle = withAlpha('#f7f0db', 0.62);
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.09, h * 0.013, -0.03, 0, Math.PI * 2);
      ctx.ellipse(x + w * 0.052, y - h * 0.012, w * 0.06, h * 0.018, 0.04, 0, Math.PI * 2);
      ctx.fill();
    }

    // Layered fields.
    const hills = [
      { y: h * 0.42, color: withAlpha(p.far, 0.8), amp: 0.04 },
      { y: h * 0.5, color: withAlpha(p.wallSpot, 0.8), amp: 0.035 },
      { y: h * 0.58, color: withAlpha(p.mid, 0.42), amp: 0.025 },
    ];
    hills.forEach((hill, index) => {
      ctx.fillStyle = hill.color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, hill.y);
      for (let x = 0; x <= w + 40; x += w * 0.18) {
        ctx.quadraticCurveTo(
          x + w * 0.09,
          hill.y - h * hill.amp,
          x + w * 0.18,
          hill.y + Math.sin(index + x * 0.01) * 4,
        );
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    });

    // Tiny farmhouse at the horizon.
    ctx.save();
    ctx.translate(w * 0.22, h * 0.52);
    ctx.fillStyle = withAlpha(p.accent, 0.36);
    ctx.fillRect(-14, -17, 28, 19);
    ctx.beginPath();
    ctx.moveTo(-19, -17);
    ctx.lineTo(0, -29);
    ctx.lineTo(19, -17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = withAlpha(p.ink, 0.22);
    ctx.fillRect(-3, -8, 6, 10);
    ctx.restore();

    // A handwritten field label.
    ctx.save();
    ctx.translate(w * 0.07, h * 0.37);
    ctx.rotate(-0.05);
    ctx.fillStyle = withAlpha('#f1e4c4', 0.72);
    ctx.fillRect(0, 0, 72, 22);
    ctx.strokeStyle = withAlpha(p.ink, 0.3);
    ctx.strokeRect(0, 0, 72, 22);
    ctx.fillStyle = withAlpha(p.ink, 0.65);
    ctx.font = '500 7px "Caveat", cursive';
    ctx.fillText('lot no. 08 / slow grown', 5, 14);
    ctx.restore();
  }

  private drawFarLayer(
    ctx: CanvasRenderingContext2D,
    world: WorldDef,
    options: BackgroundOptions,
  ): void {
    const w = this.width;
    const h = this.height;
    const groundY = options.groundY;
    const distance = options.distance;
    if (world.kind === 'farm') {
      // Rolling far fields with little bean trees.
      const offset = (distance * 0.07) % (w * 0.64);
      for (let i = -1; i < 3; i++) {
        const baseX = i * w * 0.64 - offset;
        ctx.fillStyle = withAlpha(world.palette.far, 0.32);
        ctx.beginPath();
        ctx.ellipse(baseX + w * 0.22, groundY - h * 0.18, w * 0.36, h * 0.09, -0.02, 0, Math.PI * 2);
        ctx.fill();
        for (let j = 0; j < 4; j++) {
          const x = baseX + w * (0.08 + j * 0.13);
          const y = groundY - h * 0.23 - (j % 2) * 9;
          ctx.fillStyle = withAlpha(world.palette.mid, 0.45);
          ctx.strokeStyle = withAlpha(world.palette.ink, 0.2);
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.ellipse(x, y, 8, 10, 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = withAlpha(world.palette.accent, 0.55);
          for (let k = 0; k < 2; k++) {
            ctx.beginPath();
            ctx.arc(x - 3 + k * 6, y + 2, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      // Birds.
      ctx.strokeStyle = withAlpha(world.palette.ink, 0.32);
      ctx.lineWidth = 1;
      const birdOffset = (options.time * 8) % (w + 120);
      for (let i = 0; i < 3; i++) {
        const bx = w * 0.72 - birdOffset + i * 18;
        const by = h * 0.2 + i * 7 + Math.sin(options.time + i) * 3;
        ctx.beginPath();
        ctx.moveTo(bx - 4, by);
        ctx.quadraticCurveTo(bx - 1, by - 4, bx, by);
        ctx.quadraticCurveTo(bx + 1, by - 4, bx + 4, by);
        ctx.stroke();
      }
      return;
    }

    if (world.kind === 'kitchen' || world.kind === 'cafe') {
      // Hanging paper tags / frames.
      const spacing = w * 0.56;
      const offset = (distance * 0.09) % spacing;
      for (let i = -1; i < 4; i++) {
        const x = i * spacing - offset;
        const tagY = h * 0.42;
        ctx.strokeStyle = withAlpha(world.palette.ink, 0.22);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x + 32, h * 0.035);
        ctx.quadraticCurveTo(x + 40, tagY - 28, x + 34, tagY);
        ctx.stroke();
        ctx.save();
        ctx.translate(x + 34, tagY);
        ctx.rotate(Math.sin(options.time * 0.8 + i) * 0.035);
        ctx.fillStyle = withAlpha('#efe0c3', 0.72);
        ctx.strokeStyle = withAlpha(world.palette.ink, 0.32);
        ctx.lineWidth = 0.8;
        ctx.fillRect(-12, 0, 24, 28);
        ctx.strokeRect(-12, 0, 24, 28);
        ctx.fillStyle = withAlpha(world.palette.ink, 0.52);
        ctx.font = '500 4.6px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText(world.kind === 'kitchen' ? 'fresh' : 'today', 0, 12);
        ctx.restore();

        if (world.kind === 'cafe') {
          // Hanging pendant light.
          const lampX = x + spacing * 0.48;
          const lampY = h * 0.2;
          ctx.strokeStyle = withAlpha(world.palette.ink, 0.28);
          ctx.beginPath();
          ctx.moveTo(lampX, 0);
          ctx.lineTo(lampX, lampY);
          ctx.stroke();
          ctx.fillStyle = withAlpha('#4f4234', 0.7);
          ctx.beginPath();
          ctx.moveTo(lampX - 15, lampY);
          ctx.lineTo(lampX + 15, lampY);
          ctx.lineTo(lampX + 8, lampY + 12);
          ctx.lineTo(lampX - 8, lampY + 12);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = withAlpha('#ffe7ae', 0.35);
          ctx.beginPath();
          ctx.arc(lampX, lampY + 16, 20, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (world.kind === 'midnight') {
      // String lights.
      const offset = (distance * 0.08) % (w * 0.3);
      ctx.strokeStyle = withAlpha(world.palette.ink, 0.25);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.08);
      ctx.quadraticCurveTo(w * 0.35, h * 0.15, w * 0.72, h * 0.09);
      ctx.quadraticCurveTo(w * 0.9, h * 0.06, w, h * 0.1);
      ctx.stroke();
      for (let i = 0; i < 7; i++) {
        const x = ((i * w * 0.14 - offset) % (w + 80)) - 40;
        const y = h * 0.12 + Math.sin(i * 1.1) * h * 0.02;
        ctx.fillStyle = withAlpha('#ffcb75', 0.85);
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = withAlpha('#ffcb75', 0.13);
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (world.kind === 'matcha') {
      // Delicate paper leaves drifting slowly.
      const spacing = w * 0.42;
      const offset = (distance * 0.06) % spacing;
      for (let i = -1; i < 4; i++) {
        const x = i * spacing - offset;
        ctx.save();
        ctx.translate(x + w * 0.15, h * 0.34 + Math.sin(options.time * 0.5 + i) * 8);
        ctx.rotate(-0.4 + Math.sin(options.time * 0.3 + i) * 0.1);
        ctx.fillStyle = withAlpha(world.palette.accent, 0.48);
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 3.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = withAlpha(world.palette.ink, 0.26);
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();
      }
    }

    if (world.kind === 'bakery') {
      // Paper price labels hanging in the window.
      const spacing = w * 0.35;
      const offset = (distance * 0.1) % spacing;
      for (let i = -1; i < 5; i++) {
        const x = i * spacing - offset;
        ctx.strokeStyle = withAlpha(world.palette.ink, 0.2);
        ctx.beginPath();
        ctx.moveTo(x + 20, h * 0.11);
        ctx.lineTo(x + 20, h * 0.16);
        ctx.stroke();
        ctx.save();
        ctx.translate(x + 20, h * 0.16);
        ctx.rotate(Math.sin(options.time * 0.7 + i) * 0.04);
        ctx.fillStyle = withAlpha('#f7ebd2', 0.86);
        ctx.strokeStyle = withAlpha(world.palette.ink, 0.25);
        ctx.lineWidth = 0.7;
        ctx.fillRect(-11, 0, 22, 15);
        ctx.strokeRect(-11, 0, 22, 15);
        ctx.fillStyle = withAlpha(world.palette.ink, 0.5);
        ctx.font = '500 4px "Caveat", cursive';
        ctx.textAlign = 'center';
        ctx.fillText(i % 2 === 0 ? '2.40' : 'fresh', 0, 9);
        ctx.restore();
      }
    }
  }

  private drawMidLayer(
    ctx: CanvasRenderingContext2D,
    world: WorldDef,
    options: BackgroundOptions,
  ): void {
    const w = this.width;
    const groundY = options.groundY;
    const distance = options.distance;
    const p = world.palette;
    const spacing = Math.max(170, w * 0.47);
    const offset = (distance * 0.25) % spacing;

    // Side props only: keep the middle clear for obstacles and the runner.
    for (let i = -1; i < Math.ceil(w / spacing) + 1; i++) {
      const x = i * spacing - offset;
      ctx.save();
      ctx.globalAlpha = 0.74;
      if (world.kind === 'kitchen') {
        this.drawKitchenProp(ctx, x + w * 0.06, groundY, p, i);
      } else if (world.kind === 'cafe') {
        this.drawCafeProp(ctx, x + w * 0.07, groundY, options.time, p, i);
      } else if (world.kind === 'farm') {
        this.drawFarmProp(ctx, x + w * 0.04, groundY, p, i);
      } else if (world.kind === 'midnight') {
        this.drawMidnightProp(ctx, x + w * 0.06, groundY, options.time, p, i);
      } else if (world.kind === 'matcha') {
        this.drawMatchaProp(ctx, x + w * 0.08, groundY, p);
      } else {
        this.drawBakeryProp(ctx, x + w * 0.07, groundY, p);
      }
      ctx.restore();
    }

    // A soft paper haze pushes these decorative props behind the play lane.
    const haze = ctx.createLinearGradient(0, groundY - 150, 0, groundY);
    haze.addColorStop(0, withAlpha(p.skyBottom, 0));
    haze.addColorStop(1, withAlpha(p.skyBottom, 0.22));
    ctx.fillStyle = haze;
    ctx.fillRect(0, groundY - 150, w, 150);
  }

  private drawKitchenProp(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    palette: WorldDef['palette'],
    index: number,
  ): void {
    ctx.save();
    ctx.translate(x, groundY);
    ctx.globalAlpha = 0.7;
    // Plant pot.
    ctx.fillStyle = withAlpha('#5e7252', 0.8);
    ctx.beginPath();
    ctx.ellipse(0, -32, 15, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(-0.7 + i * 0.45);
      ctx.fillStyle = withAlpha(index % 2 === 0 ? '#667a58' : '#829066', 0.74);
      ctx.beginPath();
      ctx.ellipse(0, -50, 5, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = withAlpha(palette.accent, 0.8);
    ctx.beginPath();
    ctx.moveTo(-11, -33);
    ctx.lineTo(11, -33);
    ctx.lineTo(8, -14);
    ctx.lineTo(-8, -14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.ink, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    // Kraft bag leaning at its side.
    ctx.save();
    ctx.translate(34, -5);
    ctx.rotate(0.13);
    ctx.fillStyle = withAlpha('#b88758', 0.8);
    ctx.strokeStyle = withAlpha(palette.ink, 0.36);
    ctx.fillRect(-18, -42, 33, 42);
    ctx.strokeRect(-18, -42, 33, 42);
    ctx.strokeStyle = withAlpha(palette.ink, 0.35);
    ctx.beginPath();
    ctx.moveTo(-16, -40);
    ctx.lineTo(-18, -46);
    ctx.stroke();
    ctx.fillStyle = withAlpha('#f0e2c7', 0.7);
    ctx.fillRect(-11, -27, 19, 13);
    ctx.fillStyle = withAlpha(palette.ink, 0.6);
    ctx.font = '700 4px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FLOUR', 0, -19);
    ctx.restore();
    ctx.restore();
  }

  private drawCafeProp(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    time: number,
    palette: WorldDef['palette'],
    index: number,
  ): void {
    ctx.save();
    ctx.translate(x, groundY);
    ctx.globalAlpha = 0.7;
    // Small café table with a cup.
    ctx.strokeStyle = withAlpha(palette.ink, 0.34);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(-10, 0);
    ctx.moveTo(0, -26);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.fillStyle = withAlpha('#d9b98f', 0.75);
    ctx.beginPath();
    ctx.ellipse(0, -27, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.ink, 0.32);
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = '#f2e4ca';
    ctx.beginPath();
    ctx.moveTo(-7, -40);
    ctx.lineTo(7, -40);
    ctx.lineTo(5, -29);
    ctx.lineTo(-5, -29);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.ink, 0.4);
    ctx.stroke();
    ctx.fillStyle = withAlpha(palette.accent, 0.8);
    ctx.fillRect(-6, -36, 12, 4);
    // Steam.
    ctx.strokeStyle = withAlpha('#fff8e7', 0.34);
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-2 + i * 4, -41);
      ctx.quadraticCurveTo(
        -6 + i * 4 + Math.sin(time + i + index) * 3,
        -48,
        -2 + i * 4,
        -54,
      );
      ctx.stroke();
    }
    // A newspaper-ish menu on the floor beside it.
    ctx.save();
    ctx.translate(-27, -3);
    ctx.rotate(-0.2);
    ctx.fillStyle = withAlpha('#f1e3c8', 0.72);
    ctx.fillRect(-12, -17, 24, 17);
    ctx.strokeStyle = withAlpha(palette.ink, 0.2);
    ctx.strokeRect(-12, -17, 24, 17);
    ctx.fillStyle = withAlpha(palette.ink, 0.35);
    for (let i = 0; i < 3; i++) ctx.fillRect(-8, -13 + i * 4, 16, 0.8);
    ctx.restore();
    ctx.restore();
  }

  private drawFarmProp(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    palette: WorldDef['palette'],
    index: number,
  ): void {
    ctx.save();
    ctx.translate(x, groundY);
    // Burlap coffee sack.
    ctx.rotate(index % 2 === 0 ? -0.03 : 0.045);
    ctx.fillStyle = withAlpha('#9b7a4e', 0.9);
    ctx.beginPath();
    ctx.moveTo(-17, -42);
    ctx.quadraticCurveTo(-26, -20, -19, 0);
    ctx.lineTo(19, 0);
    ctx.quadraticCurveTo(25, -23, 17, -42);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.ink, 0.42);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = withAlpha(palette.ink, 0.3);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-15 + i * 3, -40);
      ctx.quadraticCurveTo(0, -25 - i * 4, 15 - i * 2, -40);
      ctx.stroke();
    }
    ctx.fillStyle = withAlpha('#eadbbd', 0.9);
    ctx.fillRect(-11, -25, 22, 14);
    ctx.strokeStyle = withAlpha(palette.ink, 0.4);
    ctx.strokeRect(-11, -25, 22, 14);
    ctx.fillStyle = withAlpha(palette.ink, 0.7);
    ctx.font = '700 4px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BEANS', 0, -17);
    ctx.font = '500 3px "Nunito", sans-serif';
    ctx.fillText('SINGLE ORIGIN', 0, -13.4);
    // Stalks behind.
    ctx.strokeStyle = withAlpha('#5f7350', 0.45);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(29, 0);
    ctx.quadraticCurveTo(32, -24, 27, -41);
    ctx.stroke();
    for (let i = 0; i < 2; i++) {
      ctx.fillStyle = withAlpha('#6e8759', 0.52);
      ctx.beginPath();
      ctx.ellipse(27 + i * 6, -32 - i * 7, 4.5, 2.6, i ? 0.5 : -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMidnightProp(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    time: number,
    palette: WorldDef['palette'],
    index: number,
  ): void {
    ctx.save();
    ctx.translate(x, groundY);
    // Small round café table with a candle.
    ctx.fillStyle = withAlpha('#382921', 0.85);
    ctx.beginPath();
    ctx.ellipse(0, -31, 24, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.ink, 0.25);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = withAlpha('#2a1f1a', 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(-8, 0);
    ctx.moveTo(0, -30);
    ctx.lineTo(8, 0);
    ctx.stroke();
    // Cup.
    ctx.fillStyle = withAlpha('#e6d4b7', 0.9);
    ctx.beginPath();
    ctx.moveTo(-7, -42);
    ctx.lineTo(7, -42);
    ctx.lineTo(5, -31);
    ctx.lineTo(-5, -31);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha('#15100e', 0.55);
    ctx.stroke();
    // Candle flame.
    const flicker = 0.8 + Math.sin(time * 8 + index) * 0.2;
    ctx.fillStyle = withAlpha('#ffd07a', 0.26 * flicker);
    ctx.beginPath();
    ctx.arc(16, -48, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6cf8a';
    ctx.beginPath();
    ctx.ellipse(16, -49, 2.2, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMatchaProp(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    palette: WorldDef['palette'],
  ): void {
    ctx.save();
    ctx.translate(x, groundY);
    // Low wooden stool.
    ctx.fillStyle = withAlpha('#b49a6c', 0.78);
    ctx.fillRect(-22, -17, 44, 5);
    ctx.fillRect(-19, -12, 4, 12);
    ctx.fillRect(15, -12, 4, 12);
    // Matcha bowl.
    ctx.fillStyle = withAlpha('#e9e4cf', 0.95);
    ctx.beginPath();
    ctx.ellipse(0, -18, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha('#9bad77', 0.95);
    ctx.beginPath();
    ctx.ellipse(0, -18, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.ink, 0.35);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, -18, 13, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Bamboo whisk leaning.
    ctx.strokeStyle = withAlpha('#b59b68', 0.9);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(17, -6);
    ctx.lineTo(25, -36);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(22 + i * 2, -32);
      ctx.lineTo(20 + i * 3, -39);
      ctx.stroke();
    }
    // Little package.
    ctx.save();
    ctx.translate(-30, -3);
    ctx.fillStyle = withAlpha('#d5d8b9', 0.85);
    ctx.fillRect(0, -23, 20, 23);
    ctx.strokeStyle = withAlpha(palette.accent, 0.5);
    ctx.strokeRect(0, -23, 20, 23);
    ctx.fillStyle = withAlpha(palette.ink, 0.55);
    ctx.font = '700 3.4px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MATCHA', 10, -13);
    ctx.strokeStyle = withAlpha(palette.accent, 0.6);
    ctx.beginPath();
    ctx.moveTo(3, -10);
    ctx.lineTo(17, -10);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  private drawBakeryProp(
    ctx: CanvasRenderingContext2D,
    x: number,
    groundY: number,
    palette: WorldDef['palette'],
  ): void {
    ctx.save();
    ctx.translate(x, groundY);
    // Bread basket.
    ctx.fillStyle = withAlpha('#a77c4f', 0.85);
    ctx.beginPath();
    ctx.moveTo(-26, -18);
    ctx.lineTo(26, -18);
    ctx.lineTo(19, -1);
    ctx.lineTo(-19, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = withAlpha(palette.ink, 0.42);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.strokeStyle = withAlpha('#e6cfaa', 0.4);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-20 + i * 11, -17);
      ctx.lineTo(-16 + i * 10, -2);
      ctx.stroke();
    }
    // Croissants.
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.translate(-10 + i * 18, -23 + i * 2);
      ctx.rotate(-0.3 + i * 0.5);
      ctx.fillStyle = withAlpha('#d4a05d', 0.95);
      ctx.beginPath();
      ctx.moveTo(-12, 2);
      ctx.quadraticCurveTo(-5, -9, 0, -3);
      ctx.quadraticCurveTo(5, -9, 12, 2);
      ctx.quadraticCurveTo(4, 8, 0, 4);
      ctx.quadraticCurveTo(-4, 8, -12, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha(palette.ink, 0.4);
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
    // Tambourine-ish paper tag.
    ctx.save();
    ctx.translate(25, -38);
    ctx.rotate(0.15);
    ctx.fillStyle = withAlpha('#f4e6ca', 0.9);
    ctx.fillRect(-8, 0, 16, 11);
    ctx.strokeStyle = withAlpha(palette.ink, 0.3);
    ctx.strokeRect(-8, 0, 16, 11);
    ctx.fillStyle = withAlpha(palette.ink, 0.5);
    ctx.font = '500 3.4px "Caveat", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('warm', 0, 7);
    ctx.restore();
    ctx.restore();
  }

  private drawGround(
    ctx: CanvasRenderingContext2D,
    world: WorldDef,
    options: BackgroundOptions,
  ): void {
    const w = this.width;
    const h = this.height;
    const y = options.groundY;
    const p = world.palette;
    const random = mulberry32(170);
    const path = new Path2D();
    path.moveTo(0, y + random() * 2);
    const segments = Math.max(8, Math.ceil(w / 26));
    for (let i = 1; i <= segments; i++) {
      const px = (i / segments) * w;
      path.lineTo(px, y + (random() - 0.5) * 3.2);
    }
    path.lineTo(w, h);
    path.lineTo(0, h);
    path.closePath();

    ctx.save();
    ctx.fillStyle = p.ground;
    ctx.fill(path);
    ctx.clip(path);

    // A shaded lip under the top edge.
    const lip = ctx.createLinearGradient(0, y, 0, y + 22);
    lip.addColorStop(0, withAlpha(p.ink, 0.28));
    lip.addColorStop(1, withAlpha(p.ink, 0));
    ctx.fillStyle = lip;
    ctx.fillRect(0, y, w, 26);

    if (
      world.kind === 'kitchen' ||
      world.kind === 'cafe' ||
      world.kind === 'midnight'
    ) {
      // Warm wooden boards.
      const scroll = options.distance * 0.7;
      ctx.strokeStyle = withAlpha(p.groundDark, 0.62);
      ctx.lineWidth = 1.5;
      for (let row = 1; row < 5; row++) {
        const rowY = y + Math.min(h - y, (h - y) * (row / 5));
        ctx.beginPath();
        ctx.moveTo(0, rowY);
        for (let x = 0; x <= w + 30; x += 30) {
          ctx.lineTo(x, rowY + Math.sin(x * 0.08 + row) * 1.4);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = withAlpha(p.groundDark, 0.48);
      ctx.lineWidth = 1;
      const spacing = 120;
      const offset = scroll % spacing;
      for (let i = -1; i < Math.ceil(w / spacing) + 2; i++) {
        const x = i * spacing - offset;
        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x + 2, h);
        ctx.stroke();
      }
      ctx.strokeStyle = withAlpha(p.groundLight, 0.18);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) {
        const sx = ((i * 79 - scroll * 0.2) % (w + 80) + w + 80) % (w + 80) - 40;
        const sy = y + 28 + (i * 31) % Math.max(18, h - y - 32);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 18, sy - 3, sx + 35, sy + 1);
        ctx.stroke();
      }
      if (world.kind === 'midnight') {
        ctx.fillStyle = withAlpha(p.glow, 0.1);
        ctx.fillRect(0, y, w, 3);
      }
    } else if (world.kind === 'farm') {
      // Dusty earth with pebbles and sparse grass.
      const scroll = options.distance * 0.74;
      ctx.fillStyle = withAlpha(p.groundLight, 0.22);
      ctx.fillRect(0, y, w, 22);
      for (let i = 0; i < 18; i++) {
        const x = ((i * 71 - scroll) % (w + 90) + w + 90) % (w + 90) - 45;
        const py = y + 18 + ((i * 37) % Math.max(24, h - y - 28));
        ctx.fillStyle = withAlpha(
          i % 2 === 0 ? p.groundDark : p.groundLight,
          0.4,
        );
        ctx.beginPath();
        ctx.ellipse(x, py, 2 + (i % 3), 1.1 + (i % 2) * 0.7, i * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < 7; i++) {
        const gx = ((i * 127 - scroll) % (w + 100) + w + 100) % (w + 100) - 50;
        ctx.strokeStyle = withAlpha('#5f714b', 0.55);
        ctx.lineWidth = 1;
        for (let b = 0; b < 3; b++) {
          ctx.beginPath();
          ctx.moveTo(gx, y + 2);
          ctx.quadraticCurveTo(gx - 4 + b * 4, y - 6, gx - 7 + b * 7, y - 10 - b);
          ctx.stroke();
        }
      }
    } else if (world.kind === 'matcha') {
      // Pale tatami/wood with quiet lines.
      const scroll = options.distance * 0.6;
      ctx.strokeStyle = withAlpha(p.groundDark, 0.36);
      ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const py = y + 20 + i * ((h - y - 20) / 4);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(w, py);
        ctx.stroke();
      }
      const spacing = 92;
      const offset = scroll % spacing;
      ctx.strokeStyle = withAlpha(p.groundDark, 0.3);
      for (let i = -1; i < Math.ceil(w / spacing) + 2; i++) {
        const x = i * spacing - offset;
        ctx.beginPath();
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.strokeStyle = withAlpha(p.groundLight, 0.35);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, y + 4);
      ctx.lineTo(w, y + 4);
      ctx.stroke();
    } else {
      // Bakery: checkered tiles with a warm centre stripe.
      const tile = Math.max(34, w * 0.085);
      const scroll = options.distance * 0.62;
      for (let row = 0; row < Math.ceil((h - y) / tile) + 1; row++) {
        for (let col = -1; col < Math.ceil(w / tile) + 2; col++) {
          const x = col * tile - (scroll % (tile * 2));
          const py = y + row * tile;
          const alternate = (row + col) % 2 === 0;
          ctx.fillStyle = alternate
            ? withAlpha(p.groundLight, 0.22)
            : withAlpha(p.groundDark, 0.12);
          ctx.fillRect(x, py, tile, tile);
        }
      }
      ctx.strokeStyle = withAlpha(p.groundDark, 0.22);
      ctx.lineWidth = 0.8;
      for (let i = -1; i < Math.ceil(w / tile) + 1; i++) {
        const x = i * tile - (scroll % (tile * 2));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Torn top edge and warm highlight.
    ctx.strokeStyle = withAlpha(p.groundDark, 0.7);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const edgeCount = Math.max(6, Math.ceil(w / 34));
    const edgeRandom = mulberry32(230);
    for (let i = 1; i <= edgeCount; i++) {
      ctx.lineTo(
        (i / edgeCount) * w,
        y + (edgeRandom() - 0.5) * 2.6,
      );
    }
    ctx.stroke();
    ctx.strokeStyle = withAlpha(p.groundLight, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 3);
    ctx.lineTo(w, y + 3);
    ctx.stroke();

    // Small edge crumbs for speed.
    const crumbScroll = options.distance * 0.8;
    for (let i = 0; i < 9; i++) {
      const x = ((i * 61 - crumbScroll) % (w + 40) + w + 40) % (w + 40) - 20;
      ctx.fillStyle = withAlpha(p.groundDark, 0.22);
      ctx.beginPath();
      ctx.ellipse(x, y + 7 + (i % 3) * 5, 1.5 + (i % 2), 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawWorldThumbnail(
  ctx: CanvasRenderingContext2D,
  world: WorldDef,
  width: number,
  height: number,
): void {
  const p = world.palette;
  const w = width;
  const h = height;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, p.skyTop);
  gradient.addColorStop(1, p.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  if (world.kind === 'farm') {
    ctx.fillStyle = withAlpha(p.glow, 0.9);
    ctx.beginPath();
    ctx.arc(w * 0.77, h * 0.2, h * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(p.far, 0.7);
    ctx.beginPath();
    ctx.ellipse(w * 0.24, h * 0.55, w * 0.52, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha(p.mid, 0.62);
    ctx.beginPath();
    ctx.ellipse(w * 0.85, h * 0.61, w * 0.48, h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Coffee shrub and sack.
    ctx.strokeStyle = withAlpha(p.ink, 0.38);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(w * 0.23, h * 0.7);
    ctx.lineTo(w * 0.21, h * 0.49);
    ctx.stroke();
    ctx.fillStyle = withAlpha(p.mid, 0.86);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(w * (0.16 + i * 0.07), h * (0.46 + (i % 2) * 0.04), 5, 7, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = withAlpha('#9b7a4e', 0.9);
    ctx.strokeStyle = withAlpha(p.ink, 0.45);
    ctx.beginPath();
    ctx.moveTo(w * 0.69, h * 0.72);
    ctx.lineTo(w * 0.64, h * 0.75);
    ctx.lineTo(w * 0.68, h * 0.9);
    ctx.lineTo(w * 0.82, h * 0.9);
    ctx.lineTo(w * 0.85, h * 0.75);
    ctx.lineTo(w * 0.8, h * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = withAlpha('#ede0c2', 0.85);
    ctx.fillRect(w * 0.69, h * 0.79, w * 0.11, h * 0.055);
    ctx.fillStyle = withAlpha(p.ink, 0.6);
    ctx.font = '700 2.7px "Nunito", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BEANS', w * 0.745, h * 0.823);
  } else if (world.kind === 'kitchen') {
    // Window and cabinet.
    fillPaperRect(ctx, w * 0.06, h * 0.12, w * 0.38, h * 0.33, '#f5e9d1', p.ink, 9, 0.9, 0.7);
    ctx.fillStyle = withAlpha(p.glow, 0.9);
    ctx.fillRect(w * 0.09, h * 0.15, w * 0.32, h * 0.27);
    ctx.strokeStyle = withAlpha(p.ink, 0.45);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.15);
    ctx.lineTo(w * 0.25, h * 0.42);
    ctx.moveTo(w * 0.09, h * 0.285);
    ctx.lineTo(w * 0.41, h * 0.285);
    ctx.stroke();
    fillPaperRect(ctx, w * 0.55, h * 0.11, w * 0.4, h * 0.28, withAlpha('#c8a06f', 0.9), p.ink, 11, 0.9, 0.7);
    ctx.strokeStyle = withAlpha(p.ink, 0.35);
    ctx.beginPath();
    ctx.moveTo(w * 0.68, h * 0.12);
    ctx.lineTo(w * 0.68, h * 0.38);
    ctx.moveTo(w * 0.81, h * 0.12);
    ctx.lineTo(w * 0.81, h * 0.38);
    ctx.stroke();
    // Shelf with a bag and plant.
    ctx.fillStyle = withAlpha('#8f6848', 0.75);
    ctx.fillRect(w * 0.05, h * 0.47, w * 0.46, h * 0.04);
    ctx.fillStyle = withAlpha('#b68756', 0.9);
    ctx.strokeStyle = withAlpha(p.ink, 0.35);
    ctx.fillRect(w * 0.12, h * 0.4, w * 0.18, h * 0.08);
    ctx.strokeRect(w * 0.12, h * 0.4, w * 0.18, h * 0.08);
    ctx.fillStyle = withAlpha('#6d815e', 0.85);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(w * (0.63 + i * 0.08), h * (0.43 + (i % 2) * 0.02), 4, 10, 0.35 * i - 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = withAlpha(p.accent, 0.9);
    ctx.fillRect(w * 0.58, h * 0.46, w * 0.11, h * 0.05);
  } else if (world.kind === 'cafe') {
    // Awning.
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 === 0 ? withAlpha(p.accent, 0.82) : '#f3e4cb';
      ctx.fillRect(w * 0.04 + i * w * 0.155, h * 0.08, w * 0.16, h * 0.1);
      ctx.beginPath();
      ctx.arc(w * 0.12 + i * w * 0.155, h * 0.18, w * 0.08, 0, Math.PI);
      ctx.fill();
    }
    // Arched window.
    fillPaperRect(ctx, w * 0.48, h * 0.29, w * 0.43, h * 0.38, withAlpha(p.glow, 0.92), p.ink, 13, 0.9, 0.7);
    ctx.strokeStyle = withAlpha(p.ink, 0.4);
    ctx.beginPath();
    ctx.moveTo(w * 0.69, h * 0.29);
    ctx.lineTo(w * 0.69, h * 0.67);
    ctx.moveTo(w * 0.48, h * 0.47);
    ctx.lineTo(w * 0.91, h * 0.47);
    ctx.stroke();
    // Hanging lamp and little table.
    ctx.strokeStyle = withAlpha(p.ink, 0.4);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(w * 0.31, h * 0.04);
    ctx.lineTo(w * 0.31, h * 0.3);
    ctx.stroke();
    ctx.fillStyle = withAlpha('#5b4432', 0.9);
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.3);
    ctx.lineTo(w * 0.37, h * 0.3);
    ctx.lineTo(w * 0.34, h * 0.37);
    ctx.lineTo(w * 0.28, h * 0.37);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = withAlpha(p.glow, 0.26);
    ctx.beginPath();
    ctx.arc(w * 0.31, h * 0.42, w * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha('#efdfc3', 0.92);
    ctx.fillRect(w * 0.12, h * 0.7, w * 0.26, h * 0.04);
    ctx.fillRect(w * 0.17, h * 0.73, w * 0.03, h * 0.15);
    ctx.fillRect(w * 0.3, h * 0.73, w * 0.03, h * 0.15);
  } else if (world.kind === 'midnight') {
    ctx.fillStyle = withAlpha('#202b2b', 0.94);
    ctx.fillRect(w * 0.48, h * 0.13, w * 0.42, h * 0.49);
    ctx.strokeStyle = withAlpha(p.ink, 0.7);
    ctx.strokeRect(w * 0.48, h * 0.13, w * 0.42, h * 0.49);
    ctx.fillStyle = withAlpha('#f3d38b', 0.9);
    ctx.beginPath();
    ctx.arc(w * 0.64, h * 0.27, w * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(p.ink, 0.35);
    ctx.beginPath();
    ctx.moveTo(w * 0.69, h * 0.14);
    ctx.lineTo(w * 0.69, h * 0.62);
    ctx.moveTo(w * 0.49, h * 0.35);
    ctx.lineTo(w * 0.89, h * 0.35);
    ctx.stroke();
    // Chalkboard.
    ctx.fillStyle = withAlpha('#25302b', 0.92);
    ctx.fillRect(w * 0.07, h * 0.26, w * 0.33, h * 0.31);
    ctx.strokeStyle = withAlpha('#f0d69c', 0.5);
    ctx.strokeRect(w * 0.07, h * 0.26, w * 0.33, h * 0.31);
    ctx.fillStyle = withAlpha('#f0d69c', 0.7);
    ctx.font = '600 5px "Caveat", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('last call', w * 0.235, h * 0.36);
    ctx.fillStyle = withAlpha('#f0d69c', 0.35);
    ctx.fillRect(w * 0.12, h * 0.4, w * 0.23, 0.8);
    // Warm hanging bulb.
    const glowY = h * 0.18;
    ctx.fillStyle = withAlpha(p.glow, 0.16);
    ctx.beginPath();
    ctx.arc(w * 0.91, glowY + h * 0.09, w * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c679';
    ctx.beginPath();
    ctx.arc(w * 0.91, glowY + h * 0.09, w * 0.035, 0, Math.PI * 2);
    ctx.fill();
  } else if (world.kind === 'matcha') {
    // Shoji panels.
    ctx.fillStyle = withAlpha('#f4f1e0', 0.7);
    ctx.fillRect(w * 0.05, h * 0.1, w * 0.43, h * 0.39);
    ctx.fillRect(w * 0.56, h * 0.1, w * 0.39, h * 0.39);
    ctx.strokeStyle = withAlpha(p.ink, 0.28);
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (0.05 + (0.43 * i) / 3), h * 0.1);
      ctx.lineTo(w * (0.05 + (0.43 * i) / 3), h * 0.49);
      ctx.moveTo(w * (0.56 + (0.39 * i) / 3), h * 0.1);
      ctx.lineTo(w * (0.56 + (0.39 * i) / 3), h * 0.49);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.3);
    ctx.lineTo(w * 0.48, h * 0.3);
    ctx.moveTo(w * 0.56, h * 0.3);
    ctx.lineTo(w * 0.95, h * 0.3);
    ctx.stroke();
    // Leaf branch and bowl.
    ctx.strokeStyle = withAlpha(p.mid, 0.75);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.52);
    ctx.quadraticCurveTo(w * 0.24, h * 0.38, w * 0.38, h * 0.42);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = withAlpha(p.accent, 0.7);
      ctx.beginPath();
      ctx.ellipse(w * (0.22 + i * 0.07), h * (0.43 + i * 0.02), 5.5, 2.5, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = withAlpha('#e8e3ce', 0.95);
    ctx.beginPath();
    ctx.ellipse(w * 0.65, h * 0.71, w * 0.12, h * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = withAlpha('#92a471', 0.9);
    ctx.beginPath();
    ctx.ellipse(w * 0.65, h * 0.705, w * 0.09, h * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Bakery display window with paper pastries.
    fillPaperRect(ctx, w * 0.07, h * 0.11, w * 0.86, h * 0.51, withAlpha(p.glow, 0.9), p.ink, 15, 0.9, 0.8);
    ctx.strokeStyle = withAlpha(p.ink, 0.27);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.12);
    ctx.lineTo(w * 0.5, h * 0.61);
    ctx.stroke();
    ctx.fillStyle = withAlpha(p.mid, 0.56);
    for (let row = 0; row < 2; row++) {
      const shelfY = h * (0.34 + row * 0.17);
      ctx.fillRect(w * 0.1, shelfY, w * 0.8, 1.3);
      for (let i = 0; i < 4; i++) {
        const x = w * (0.19 + i * 0.21);
        if ((i + row) % 2 === 0) {
          ctx.beginPath();
          ctx.ellipse(x, shelfY - 5, w * 0.07, h * 0.028, -0.15, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(x, shelfY - 3, w * 0.045, Math.PI, 0);
          ctx.fill();
        }
      }
    }
    // Doily tag.
    ctx.fillStyle = withAlpha('#f8ecd5', 0.86);
    ctx.beginPath();
    ctx.arc(w * 0.31, h * 0.2, w * 0.075, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = withAlpha(p.ink, 0.25);
    ctx.stroke();
    ctx.fillStyle = withAlpha(p.ink, 0.5);
    ctx.font = '600 4px "Caveat", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('today', w * 0.31, h * 0.207);
    ctx.fillStyle = withAlpha(p.accent, 0.65);
    ctx.beginPath();
    ctx.arc(w * 0.68, h * 0.17, w * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground band, shared by every world.
  ctx.fillStyle = p.ground;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.74);
  for (let i = 1; i <= 6; i++) {
    ctx.lineTo((i / 6) * w, h * 0.74 + Math.sin(i * 2.4) * 1.4);
  }
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = withAlpha(p.groundLight, 0.28);
  ctx.fillRect(0, h * 0.75, w, 1.2);

  // A small takeaway cup, the series' mascot object.
  ctx.save();
  ctx.translate(w * 0.73, h * 0.81);
  ctx.scale(0.62, 0.62);
  ctx.fillStyle = '#f1e2c6';
  ctx.strokeStyle = '#3b281b';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-12, -17);
  ctx.lineTo(12, -17);
  ctx.lineTo(8, 16);
  ctx.lineTo(-8, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.accent;
  ctx.fillRect(-10, -7, 20, 9);
  ctx.fillStyle = '#3b281b';
  ctx.fillRect(-15, -22, 30, 6);
  ctx.restore();
  ctx.save();
  ctx.translate(w * 0.25, h * 0.86);
  ctx.rotate(-0.3);
  ctx.fillStyle = withAlpha(p.ink, 0.22);
  ctx.fillRect(-12, 0, 24, 2);
  ctx.fillRect(-8, 5, 16, 1.3);
  ctx.restore();
}
