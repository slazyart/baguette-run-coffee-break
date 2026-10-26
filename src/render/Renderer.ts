import type { CupView, ObstacleView, SkinDef, WorldDef } from '../core/types';
import type { Player } from '../game/Player';
import type { ParticleSystem } from '../game/Particles';
import { BackgroundManager } from './BackgroundManager';
import {
  drawBaguette,
  type BaguettePose,
  type CharacterMode,
} from './CharacterRenderer';
import { drawCollectibleCup, drawObstacleSprite, drawTinyPaperCup } from './Props';
import { TextureFactory } from './TextureFactory';
import {
  drawHeart,
  drawStar,
  drawTape,
  mulberry32,
  withAlpha,
} from './DrawUtils';

export interface Viewport {
  width: number;
  height: number;
  groundY: number;
  playerX: number;
  scale: number;
}

interface RenderObstacle extends ObstacleView {
  active: boolean;
}

interface RenderCup extends CupView {
  active: boolean;
}

export interface GameRenderState {
  viewport: Viewport;
  world: WorldDef;
  skin: SkinDef;
  player: Player;
  obstacles: readonly RenderObstacle[];
  cups: readonly RenderCup[];
  particles: ParticleSystem;
  time: number;
  distance: number;
  speed: number;
  mode: 'running' | 'dying';
  deathProgress: number;
  shake: number;
  reducedMotion: boolean;
}

export function computeViewport(width: number, height: number): Viewport {
  const scale = Math.min(1.32, Math.max(0.8, Math.min(width / 400, height / 760)));
  return {
    width,
    height,
    scale,
    groundY: Math.round(height * 0.795),
    playerX: Math.round(Math.min(192, Math.max(78, width * 0.24))),
  };
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly background = new BackgroundManager();
  private readonly textures = new TextureFactory();
  private width = 1;
  private height = 1;
  private dpr = 1;
  private grainPattern: CanvasPattern | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.');
    this.ctx = ctx;
  }

  resize(width: number, height: number, dpr: number): void {
    const nextDpr = Math.min(2, Math.max(1, dpr));
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.dpr = nextDpr;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.background.resize(this.width, this.height, this.dpr);
    this.grainPattern = null;
  }

  get viewport(): Viewport {
    return computeViewport(this.width, this.height);
  }

  renderMenu(
    world: WorldDef,
    skin: SkinDef,
    time: number,
    reducedMotion: boolean,
  ): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const groundY = h * 0.69;
    this.background.drawBackdrop(ctx, world, {
      groundY,
      distance: time * 34,
      time,
      reducedMotion,
      menu: true,
    });

    drawMenuProps(ctx, world, w, h, groundY, time);

    const pose: BaguettePose = {
      x: w * 0.5,
      baseline: groundY - 4 + Math.sin(time * 1.35) * 2.2,
      groundY: groundY + 2,
      scale: Math.min(1.72, Math.max(1.27, (w / 420) * 1.6)),
      mode: 'idle',
      runPhase: 0,
      landing: 0,
      happy: 0,
      deathProgress: 0,
      time,
      velocity: 0,
    };
    drawBaguette(ctx, skin, pose);

    // A little floating coffee companion.
    const cupBob = Math.sin(time * 1.6 + 1) * 4;
    ctx.save();
    ctx.translate(w * 0.77, groundY - 98 + cupBob);
    ctx.rotate(Math.sin(time * 0.9) * 0.06);
    drawTinyPaperCup(ctx, 0, 0, 0.83, world.palette.accent);
    ctx.restore();
    ctx.save();
    ctx.translate(w * 0.83, groundY - 68);
    ctx.rotate(0.18);
    ctx.fillStyle = withAlpha('#f4e4c6', 0.92);
    ctx.fillRect(-19, -9, 38, 18);
    ctx.strokeStyle = withAlpha(world.palette.ink, 0.24);
    ctx.lineWidth = 0.8;
    ctx.strokeRect(-19, -9, 38, 18);
    ctx.fillStyle = withAlpha(world.palette.ink, 0.54);
    ctx.font = '500 6px "Caveat", cursive';
    ctx.textAlign = 'center';
    ctx.fillText('break time', 0, 2.4);
    ctx.restore();

    // Hand-cut paper doodles.
    const random = mulberry32(711);
    for (let i = 0; i < 8; i++) {
      const x = random() * w;
      const y = h * 0.26 + random() * h * 0.33;
      const size = 1.6 + random() * 2.8;
      ctx.fillStyle = withAlpha(
        i % 2 === 0 ? world.palette.accentSoft : world.palette.glow,
        0.42,
      );
      if (i % 3 === 0) {
        drawStar(
          ctx,
          x,
          y + Math.sin(time * 0.6 + i) * 5,
          size,
          withAlpha(world.palette.accent, 0.42),
          time * 0.2 + i,
        );
      } else {
        ctx.beginPath();
        ctx.arc(
          x,
          y + Math.sin(time * 0.6 + i) * 5,
          size * 0.65,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    this.background.drawAmbient(ctx, world, {
      groundY,
      distance: time * 34,
      time,
      reducedMotion,
      menu: true,
    });
    this.drawGrain(ctx);
    this.drawVignette(ctx, world);
  }

  renderGame(state: GameRenderState): void {
    const ctx = this.ctx;
    const { viewport, world, skin, player } = state;
    const w = viewport.width;
    const h = viewport.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    let shakeX = 0;
    let shakeY = 0;
    if (state.shake > 0 && !state.reducedMotion) {
      shakeX = Math.sin(state.time * 87) * state.shake;
      shakeY = Math.cos(state.time * 103) * state.shake * 0.55;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.background.drawBackdrop(ctx, world, {
      groundY: viewport.groundY,
      distance: state.distance,
      time: state.time,
      reducedMotion: state.reducedMotion,
    });

    // Obstacles first, cups on top so they never disappear into the scene.
    for (const obstacle of state.obstacles) {
      if (!obstacle.active) continue;
      drawObstacleSprite(ctx, obstacle, viewport.groundY, state.time);
    }

    for (const cup of state.cups) {
      if (!cup.active) continue;
      drawCollectibleCup(
        ctx,
        cup,
        state.time,
        world.palette.accent,
        world.palette.glow,
      );
    }

    if (state.speed > 480 && !state.reducedMotion) {
      ctx.strokeStyle = withAlpha(world.palette.glow, 0.13);
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 4; i++) {
        const sx =
          ((state.time * state.speed * (0.7 + i * 0.1) + i * 160) %
            (w + 100)) -
          50;
        const sy = viewport.groundY - 38 - i * 27;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 24 + i * 4, sy - 1);
        ctx.stroke();
      }
    }

    const pose = this.playerPose(player, state);
    drawBaguette(ctx, skin, pose);

    state.particles.draw(ctx);

    ctx.restore();
    this.background.drawAmbient(ctx, world, {
      groundY: viewport.groundY,
      distance: state.distance,
      time: state.time,
      reducedMotion: state.reducedMotion,
    });
    this.drawGrain(ctx);
    this.drawVignette(ctx, world);
  }

  private playerPose(player: Player, state: GameRenderState): BaguettePose {
    let mode: CharacterMode = 'run';
    if (state.mode === 'dying') mode = 'dead';
    else if (!player.isGrounded) mode = player.velocity >= 0 ? 'jump' : 'fall';
    return {
      x: player.x,
      baseline: player.groundY - player.height,
      groundY: player.groundY,
      scale: Math.max(0.82, state.viewport.scale),
      mode,
      runPhase: player.runPhase,
      landing: player.landing,
      happy: player.happy,
      deathProgress: state.deathProgress,
      time: state.time,
      velocity: player.velocity,
    };
  }

  private drawVignette(ctx: CanvasRenderingContext2D, world: WorldDef): void {
    const gradient = ctx.createRadialGradient(
      this.width / 2,
      this.height * 0.46,
      this.width * 0.28,
      this.width / 2,
      this.height * 0.5,
      Math.max(this.width, this.height) * 0.72,
    );
    gradient.addColorStop(0, withAlpha(world.palette.ink, 0));
    gradient.addColorStop(1, withAlpha(world.palette.ink, 0.22));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawGrain(ctx: CanvasRenderingContext2D): void {
    if (!this.grainPattern) {
      this.grainPattern = this.textures.grain(ctx);
    }
    ctx.save();
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }
}

function drawMenuProps(
  ctx: CanvasRenderingContext2D,
  world: WorldDef,
  w: number,
  h: number,
  groundY: number,
  time: number,
): void {
  const palette = world.palette;
  // A small paper coffee station beside the hero.
  ctx.save();
  ctx.translate(w * 0.16, groundY + 1);
  drawShadowish(ctx, 0, 0, 31, 8, 0.18);
  ctx.fillStyle = withAlpha('#e8d8b8', 0.93);
  ctx.beginPath();
  ctx.moveTo(-20, -31);
  ctx.lineTo(20, -31);
  ctx.lineTo(14, 0);
  ctx.lineTo(-14, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha(palette.ink, 0.65);
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = palette.accent;
  ctx.fillRect(-18, -19, 36, 9);
  ctx.strokeStyle = withAlpha(palette.ink, 0.6);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(-13, -10);
  ctx.lineTo(-11, 0);
  ctx.moveTo(13, -10);
  ctx.lineTo(11, 0);
  ctx.stroke();
  drawHeart(ctx, 0, -14.5, 9, withAlpha('#f7e9ce', 0.9));
  ctx.strokeStyle = withAlpha('#fff9e8', 0.38);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-5, -34);
  ctx.bezierCurveTo(-10, -43, 3, -47, -2, -56);
  ctx.stroke();
  ctx.restore();

  // Loose paper tickets and crumbs.
  ctx.save();
  ctx.translate(w * 0.85, groundY - 14);
  ctx.rotate(-0.12);
  ctx.fillStyle = withAlpha('#f2e4ca', 0.85);
  ctx.fillRect(-13, -8, 26, 16);
  ctx.strokeStyle = withAlpha(palette.ink, 0.25);
  ctx.strokeRect(-13, -8, 26, 16);
  ctx.fillStyle = withAlpha(palette.ink, 0.45);
  ctx.font = '500 4.5px "Caveat", cursive';
  ctx.textAlign = 'center';
  ctx.fillText('no. 07', 0, 2);
  ctx.restore();

  // Gently drifting steam ribbons.
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const x = w * 0.74 + i * 15 + Math.sin(time * 0.45 + i * 2) * 4;
    const y = groundY - 120 - i * 4;
    ctx.strokeStyle = withAlpha('#fff9e8', 0.2);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x - 7,
      y - 16,
      x + 9,
      y - 27,
      x + Math.sin(time * 0.3 + i) * 5,
      y - 43,
    );
    ctx.stroke();
  }
  ctx.restore();

  // Little washi tape pieces holding the scene together.
  drawTape(ctx, w * 0.5, h * 0.16, 94, -0.06, 'rgba(237,220,185,0.28)', 17);
}

function drawShadowish(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  alpha: number,
): void {
  ctx.save();
  ctx.fillStyle = `rgba(54,34,20,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
