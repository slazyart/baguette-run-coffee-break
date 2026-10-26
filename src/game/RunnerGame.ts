import type {
  HudState,
  RunResult,
  SaveData,
  SkinDef,
  WorldDef,
} from '../core/types';
import type { SaveManager } from '../core/SaveManager';
import type { AudioManager } from '../core/AudioManager';
import { SkinManager } from '../core/SkinManager';
import { getWorld } from '../data/worlds';
import type { Renderer, Viewport } from '../render/Renderer';
import { Collectibles } from './Collectibles';
import { CurrencySystem } from './CurrencySystem';
import { ObstacleSpawner } from './ObstacleSpawner';
import { ParticleSystem } from './Particles';
import {
  circleIntersectsRect,
  clamp,
  getObstacleHitbox,
  getPlayerHitbox,
  rectsOverlap,
} from './Physics';
import { Player } from './Player';
import { ScoreSystem } from './ScoreSystem';

export type GameMode = 'idle' | 'running' | 'dying' | 'over' | 'menu';

export interface RunnerHooks {
  onHud: (hud: HudState) => void;
  onRunComplete: (result: RunResult) => void;
  onImpact?: () => void;
}

const START_SPEED = 325;
const MAX_SPEED = 640;

export class RunnerGame {
  readonly player = new Player();
  readonly spawner = new ObstacleSpawner();
  readonly cups = new Collectibles();
  readonly score = new ScoreSystem();
  readonly particles: ParticleSystem;
  readonly skinManager: SkinManager;
  readonly currency: CurrencySystem;
  mode: GameMode = 'menu';
  world: WorldDef;
  skin: SkinDef;
  viewport: Viewport;
  time = 0;
  runTime = 0;
  speed = START_SPEED;
  distance = 0;
  shake = 0;
  deathProgress = 0;
  reducedMotion = false;
  private menuTime = 0;
  private deathTimer = 0;
  private runId = '';
  private finalResult: RunResult | null = null;
  private resultDelivered = false;
  private lastHudKey = '';
  private stepTimer = 0;
  private readonly hooks: RunnerHooks;

  constructor(
    private readonly renderer: Renderer,
    private readonly save: SaveManager,
    private readonly audio: AudioManager,
    hooks: RunnerHooks,
  ) {
    this.hooks = hooks;
    this.skinManager = new SkinManager(save);
    this.currency = new CurrencySystem(save);
    this.skin = this.skinManager.selected;
    this.world = getWorld(save.state.selectedWorld);
    this.viewport = renderer.viewport;
    this.reducedMotion = getReducedMotion();
    this.particles = new ParticleSystem(this.reducedMotion);
    this.player.reset(this.viewport.playerX, this.viewport.groundY);
    this.renderer.resize(
      this.viewport.width,
      this.viewport.height,
      window.devicePixelRatio || 1,
    );
  }

  setViewport(viewport: Viewport): void {
    this.viewport = viewport;
    this.player.x = viewport.playerX;
    this.player.groundY = viewport.groundY;
    if (this.mode !== 'running' && this.mode !== 'dying') {
      this.player.reset(viewport.playerX, viewport.groundY);
    }
  }

  refreshCosmetics(): void {
    this.skin = this.skinManager.selected;
    this.world = getWorld(this.save.state.selectedWorld);
  }

  updateAttract(dt: number): void {
    this.menuTime += dt;
    this.time += dt;
  }

  renderAttract(): void {
    this.renderer.renderMenu(
      this.world,
      this.skin,
      this.menuTime,
      this.reducedMotion,
    );
  }

  startRun(): void {
    this.refreshCosmetics();
    this.mode = 'running';
    this.time = 0;
    this.runTime = 0;
    this.speed = START_SPEED;
    this.distance = 0;
    this.shake = 0;
    this.deathTimer = 0;
    this.deathProgress = 0;
    this.resultDelivered = false;
    this.finalResult = null;
    this.runId = `run-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    this.lastHudKey = '';
    this.stepTimer = 0;
    this.player.reset(this.viewport.playerX, this.viewport.groundY);
    this.spawner.reset();
    this.cups.reset();
    this.score.reset();
    this.particles.reset();
    this.emitHud();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.mode === 'idle' || this.mode === 'menu') return;
    this.particles.update(dt);
    this.shake = Math.max(0, this.shake - dt * 18);

    if (this.mode === 'dying') {
      this.deathTimer += dt;
      this.deathProgress = clamp(this.deathTimer / 0.8, 0, 1);
      if (
        this.deathTimer >= 0.82 &&
        this.finalResult &&
        !this.resultDelivered
      ) {
        this.mode = 'over';
        this.resultDelivered = true;
        this.hooks.onRunComplete(this.finalResult);
      }
      return;
    }

    if (this.mode !== 'running') return;

    this.runTime += dt;
    this.speed = Math.min(MAX_SPEED, START_SPEED + this.runTime * 2.15);
    this.distance += this.speed * dt;
    this.score.update(dt, this.speed);
    this.player.update(
      dt,
      this.viewport.playerX,
      this.viewport.groundY,
      this.speed,
    );

    this.spawner.update(
      dt,
      this.speed,
      this.viewport.width,
      this.cups.items,
      true,
    );
    this.cups.update(
      dt,
      this.speed,
      this.viewport.width,
      this.viewport.groundY,
      this.spawner.items,
    );

    this.playerFootstep(dt);
    this.checkCupCollisions();
    this.checkObstacleCollisions();
    this.emitHud();
  }

  renderGame(): void {
    this.renderer.renderGame({
      viewport: this.viewport,
      world: this.world,
      skin: this.skin,
      player: this.player,
      obstacles: this.spawner.items,
      cups: this.cups.items,
      particles: this.particles,
      time: this.time,
      distance: this.distance,
      speed: this.speed,
      mode:
        this.mode === 'dying' || this.mode === 'over' ? 'dying' : 'running',
      deathProgress: this.deathProgress,
      shake: this.shake,
      reducedMotion: this.reducedMotion,
    });
  }

  jump(): void {
    if (this.mode !== 'running') return;
    if (this.player.jump()) {
      this.audio.play('jump');
      this.haptic(9);
    }
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  private playerFootstep(dt: number): void {
    if (!this.player.isGrounded) return;
    this.stepTimer -= dt;
    if (this.stepTimer > 0) return;
    this.stepTimer = 0.27;
    this.audio.play('step');
  }

  private checkCupCollisions(): void {
    const hitbox = getPlayerHitbox(
      this.player.x,
      this.viewport.groundY,
      this.player.height,
    );
    // A slightly wider pickup radius in the air makes jump-path cups feel like a
    // reward for a well-timed hop rather than a pixel-perfect collision.
    const pickupRadius = this.player.height > 12 ? 38 : 30;
    for (const cup of this.cups.items) {
      if (!cup.active) continue;
      if (circleIntersectsRect(cup.x, cup.y, pickupRadius, hitbox)) {
        this.cups.collect(cup);
        this.score.collectCup();
        this.player.collect();
        this.particles.emitCup(cup.x, cup.y, this.world);
        this.audio.play('cup');
        this.haptic(16);
        this.emitHud(true);
      }
    }
  }

  private checkObstacleCollisions(): void {
    const hitbox = getPlayerHitbox(
      this.player.x,
      this.viewport.groundY,
      this.player.height,
    );
    for (const obstacle of this.spawner.items) {
      if (!obstacle.active) continue;
      if (rectsOverlap(hitbox, getObstacleHitbox(obstacle, this.viewport.groundY))) {
        this.beginDeath();
        return;
      }
    }
  }

  private beginDeath(): void {
    if (this.mode !== 'running') return;
    this.mode = 'dying';
    this.player.die();
    this.shake = 8;
    this.deathTimer = 0;
    this.deathProgress = 0;
    this.audio.play('gameover');
    this.haptic([28, 35, 54]);
    this.particles.emitCrash(this.player.x + 10, this.player.groundY - 46, this.world);
    this.hooks.onImpact?.();

    const distanceM = this.score.distanceM;
    const cups = this.score.cups;
    const finalScore = this.score.score;
    this.finalResult = this.currency.claimRun(
      this.runId,
      finalScore,
      distanceM,
      cups,
    );
  }

  private emitHud(force = false): void {
    const hud: HudState = {
      score: this.score.score,
      cups: this.score.cups,
      distance: this.score.distanceM,
    };
    const key = `${hud.score}:${hud.cups}:${hud.distance}`;
    if (!force && key === this.lastHudKey) return;
    this.lastHudKey = key;
    this.hooks.onHud(hud);
  }

  private haptic(pattern: number | number[]): void {
    if (!this.save.state.haptics) return;
    try {
      if (typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Haptics are optional.
    }
  }

  getSnapshot(): {
    mode: GameMode;
    score: number;
    cups: number;
    distance: number;
    best: number;
    cp: number;
    speed: number;
    activeObstacles: number;
    activeCups: number;
    groundY: number;
    playerY: number;
    playerX: number;
    world: string;
    skin: string;
    obstacles: Array<{
      kind: string;
      x: number;
      width: number;
      height: number;
    }>;
    cupsAhead: Array<{ x: number; y: number }>;
    save: Readonly<SaveData>;
  } {
    return {
      mode: this.mode,
      score: this.score.score,
      cups: this.score.cups,
      distance: this.score.distanceM,
      best: this.save.state.best,
      cp: this.save.state.cp,
      speed: this.speed,
      activeObstacles: this.spawner.activeCount,
      activeCups: this.cups.activeCount,
      groundY: this.viewport.groundY,
      playerY: this.player.height,
      playerX: this.player.x,
      world: this.world.id,
      skin: this.skin.id,
      obstacles: this.spawner.items
        .filter((obstacle) => obstacle.active)
        .map((obstacle) => ({
          kind: obstacle.kind,
          x: Math.round(obstacle.x),
          width: obstacle.width,
          height: obstacle.height,
        })),
      cupsAhead: this.cups.items
        .filter((cup) => cup.active)
        .map((cup) => ({ x: Math.round(cup.x), y: Math.round(cup.y) })),
      save: this.save.state,
    };
  }
}

function getReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
