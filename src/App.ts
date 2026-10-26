import { AudioManager } from './core/AudioManager';
import { InputManager } from './core/InputManager';
import { SaveManager } from './core/SaveManager';
import type { RunResult } from './core/types';
import { GameLoop } from './game/GameLoop';
import { RunnerGame } from './game/RunnerGame';
import { Shop } from './game/Shop';
import { Renderer } from './render/Renderer';
import { UIController, type ShopTab } from './ui/UIController';

type AppMode = 'menu' | 'playing' | 'paused' | 'results' | 'shop';

export class App {
  private readonly save: SaveManager;
  private readonly audio: AudioManager;
  private readonly shop: Shop;
  private readonly renderer: Renderer;
  private readonly game: RunnerGame;
  private readonly ui: UIController;
  private readonly input: InputManager;
  private readonly loop: GameLoop;
  private mode: AppMode = 'menu';
  private resizeTimer = 0;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.save = new SaveManager();
    this.audio = new AudioManager(this.save.state.sound);
    this.shop = new Shop(this.save);
    this.renderer = new Renderer(canvas);
    this.lastWidth = Math.max(1, window.innerWidth);
    this.lastHeight = Math.max(1, window.innerHeight);
    this.renderer.resize(
      this.lastWidth,
      this.lastHeight,
      window.devicePixelRatio || 1,
    );

    this.game = new RunnerGame(this.renderer, this.save, this.audio, {
      onHud: (hud) => this.ui.updateHud(hud),
      onRunComplete: (result) => this.handleRunComplete(result),
      onImpact: () => {
        this.ui.dismissJumpHint();
      },
    });
    this.game.setViewport(this.renderer.viewport);

    this.ui = new UIController({
      save: this.save,
      shop: this.shop,
      audio: this.audio,
      callbacks: {
        onPlay: () => this.startRun(),
        onPause: () => this.pauseRun(),
        onResume: () => this.resumeRun(),
        onRestartRequested: () => this.restartRun(),
        onHomeRequested: () => this.goHome(),
        onShopEnter: () => this.handleShopEnter(),
        onShopExit: () => this.handleShopExit(),
        onCosmeticsChanged: () => this.game.refreshCosmetics(),
      },
    });

    this.input = new InputManager({
      onPress: () => this.handleJumpPress(),
      onRelease: () => undefined,
      onAnyGesture: () => {
        void this.audio.unlock();
      },
    });
    this.input.setEnabled(false);

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    );

    this.bindEvents();
    this.ui.showMenu();
    this.game.mode = 'menu';
    this.loop.start();
    this.exposeDebugApi();
  }

  private update(dt: number): void {
    if (this.mode === 'menu') {
      this.game.updateAttract(dt);
    } else if (this.mode === 'playing') {
      this.game.update(dt);
    }
  }

  private render(): void {
    if (this.mode === 'menu') {
      this.game.renderAttract();
    } else if (this.mode === 'playing' || this.mode === 'paused') {
      this.game.renderGame();
    }
  }

  private handleJumpPress(): void {
    if (this.mode !== 'playing') return;
    void this.audio.unlock();
    this.game.jump();
    this.ui.dismissJumpHint();
  }

  private startRun(): void {
    void this.audio.unlock();
    this.mode = 'playing';
    this.game.refreshCosmetics();
    this.game.startRun();
    this.ui.showGame(true);
    this.input.setEnabled(true);
    this.loop.start();
  }

  private pauseRun(): void {
    if (this.mode !== 'playing' || this.game.mode !== 'running') return;
    this.mode = 'paused';
    this.input.setEnabled(false);
    this.loop.stop();
    this.ui.showPause();
  }

  private resumeRun(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.ui.showGame(false);
    this.input.setEnabled(true);
    this.loop.start();
  }

  private restartRun(): void {
    if (this.mode !== 'paused' && this.mode !== 'results') return;
    this.mode = 'playing';
    this.game.refreshCosmetics();
    this.game.startRun();
    this.ui.showGame(true);
    this.input.setEnabled(true);
    this.loop.stop();
    this.loop.start();
  }

  private goHome(): void {
    if (
      this.mode !== 'paused' &&
      this.mode !== 'results' &&
      this.mode !== 'playing'
    ) {
      return;
    }
    this.mode = 'menu';
    this.input.setEnabled(false);
    this.loop.stop();
    this.game.mode = 'menu';
    this.game.refreshCosmetics();
    this.ui.showMenu();
    this.loop.start();
  }

  private handleRunComplete(result: RunResult): void {
    if (this.mode !== 'playing') return;
    this.mode = 'results';
    this.input.setEnabled(false);
    this.loop.stop();
    this.ui.showResults(result);
  }

  private handleShopEnter(): void {
    this.mode = 'shop';
    this.input.setEnabled(false);
    this.loop.stop();
  }

  private handleShopExit(): void {
    this.mode = 'menu';
    this.game.refreshCosmetics();
    this.game.mode = 'menu';
    this.input.setEnabled(false);
    this.loop.start();
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('orientationchange', this.handleResize, {
      passive: true,
    });
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('keydown', this.handleGlobalKeydown);
    window.addEventListener('contextmenu', (event) => {
      if (this.mode === 'playing') event.preventDefault();
    });
    document.addEventListener('gesturestart', (event) => {
      event.preventDefault();
    });
  }

  private handleResize = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      const wasPortrait = this.lastWidth <= this.lastHeight;
      const previousWidth = this.lastWidth;
      this.applyViewportSize();
      const nowPortrait = this.lastWidth <= this.lastHeight;

      if (
        this.mode === 'playing' &&
        (wasPortrait !== nowPortrait ||
          Math.abs(this.lastWidth - previousWidth) > 140)
      ) {
        this.pauseRun();
        return;
      }

      if (this.mode === 'menu') {
        this.game.renderAttract();
        if (!this.loop.isRunning) this.loop.start();
      } else if (this.mode === 'paused' || this.mode === 'results') {
        this.game.renderGame();
      } else if (this.mode === 'playing' && this.game.mode === 'over') {
        this.game.renderGame();
      }

      if (
        Math.abs(this.lastWidth - previousWidth) > 200 &&
        this.mode === 'playing'
      ) {
        this.ui.showToast('Window resized. The paper world stretched politely.');
      }
    }, 90);
  };

  private applyViewportSize(): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.lastWidth = width;
    this.lastHeight = height;
    this.renderer.resize(width, height, window.devicePixelRatio || 1);
    this.game?.setViewport(this.renderer.viewport);
  }

  private handleVisibility = (): void => {
    const hidden = document.visibilityState === 'hidden';
    this.ui.handleVisibility(hidden);
    if (hidden) {
      if (this.mode === 'playing') this.pauseRun();
      else if (this.mode === 'menu') this.loop.stop();
    } else if (this.mode === 'menu') {
      this.loop.start();
    } else if (this.mode === 'playing') {
      this.loop.start();
    } else if (this.mode === 'paused' || this.mode === 'results') {
      this.game.renderGame();
    }
  };

  private handleBlur = (): void => {
    if (this.mode === 'playing') this.pauseRun();
  };

  private handleGlobalKeydown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (this.mode === 'playing') {
        event.preventDefault();
        this.pauseRun();
      } else if (this.mode === 'paused') {
        event.preventDefault();
        this.resumeRun();
      } else if (this.mode === 'shop' && event.code === 'Escape') {
        event.preventDefault();
        this.ui.closeShop();
      }
      return;
    }

    if (this.mode === 'menu') {
      const target = event.target;
      const onInteractive =
        target instanceof Element &&
        Boolean(target.closest('button, a, input, [role="button"]'));
      if (
        !onInteractive &&
        (event.code === 'Space' ||
          event.code === 'Enter' ||
          event.code === 'ArrowUp')
      ) {
        event.preventDefault();
        this.startRun();
      }
    }
  };

  private exposeDebugApi(): void {
    if (!import.meta.env.DEV) return;
    (window as unknown as Record<string, unknown>).__BAGUETTE_DEBUG__ = {
      snapshot: () => ({
        ...this.game.getSnapshot(),
        screen: this.mode,
        sound: this.save.state.sound,
        haptics: this.save.state.haptics,
      }),
      startRun: () => this.startRun(),
      pause: () => this.pauseRun(),
      resume: () => this.resumeRun(),
      goHome: () => this.goHome(),
      openShop: (tab: ShopTab = 'skins') => this.ui.showShop(tab),
      closeShop: () => this.ui.closeShop(),
      getSave: () => ({ ...this.save.state }),
    };
  }
}
