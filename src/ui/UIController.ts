import type { HudState, RunResult, SkinDef, WorldDef } from '../core/types';
import type { AudioManager } from '../core/AudioManager';
import type { SaveManager } from '../core/SaveManager';
import type { Shop, ShopEntry } from '../game/Shop';
import { getSkin } from '../data/skins';
import { getWorld } from '../data/worlds';
import { drawWorldThumbnail } from '../render/BackgroundManager';
import { drawBaguette } from '../render/CharacterRenderer';
import { drawStar, withAlpha } from '../render/DrawUtils';
import { ShopPreview } from './ShopPreview';

export type ShopTab = 'skins' | 'worlds';

export interface UICallbacks {
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestartRequested: () => void;
  onHomeRequested: () => void;
  onShopEnter: () => void;
  onShopExit: () => void;
  onCosmeticsChanged: () => void;
}

interface UIOptions {
  save: SaveManager;
  shop: Shop;
  audio: AudioManager;
  callbacks: UICallbacks;
}

export class UIController {
  private readonly menuScreen = mustGet<HTMLElement>('menu-screen');
  private readonly gameScreen = mustGet<HTMLElement>('game-screen');
  private readonly pauseScreen = mustGet<HTMLElement>('pause-screen');
  private readonly overScreen = mustGet<HTMLElement>('over-screen');
  private readonly shopScreen = mustGet<HTMLElement>('shop-screen');
  private readonly menuCp = mustGet<HTMLElement>('menu-cp');
  private readonly menuBest = mustGet<HTMLElement>('menu-best');
  private readonly menuSkinsOwned = mustGet<HTMLElement>('menu-skins-owned');
  private readonly menuWorldsOwned = mustGet<HTMLElement>('menu-worlds-owned');
  private readonly shopCp = mustGet<HTMLElement>('shop-cp');
  private readonly tabSkinsCount = mustGet<HTMLElement>('tab-skins-count');
  private readonly tabWorldsCount = mustGet<HTMLElement>('tab-worlds-count');
  private readonly scoreValue = mustGet<HTMLElement>('score-value');
  private readonly cupCount = mustGet<HTMLElement>('cup-count');
  private readonly cupHud = this.cupCount.closest('.cup-hud') as HTMLElement;
  private readonly jumpHint = mustGet<HTMLElement>('jump-hint');
  private readonly soundToggle = mustGet<HTMLButtonElement>('sound-toggle');
  private readonly hapticsToggle = mustGet<HTMLButtonElement>('haptics-toggle');
  private readonly pauseSoundToggle = mustGet<HTMLButtonElement>('pause-sound-toggle');
  private readonly pauseHapticsToggle = mustGet<HTMLButtonElement>('pause-haptics-toggle');
  private readonly previewCanvas = mustGet<HTMLCanvasElement>('shop-preview-canvas');
  private readonly previewName = mustGet<HTMLElement>('preview-name');
  private readonly previewEyebrow = mustGet<HTMLElement>('preview-eyebrow');
  private readonly previewDesc = mustGet<HTMLElement>('preview-desc');
  private readonly previewPrice = mustGet<HTMLElement>('preview-price');
  private readonly previewStamp = mustGet<HTMLElement>('preview-stamp');
  private readonly skinList = mustGet<HTMLElement>('skin-list');
  private readonly worldList = mustGet<HTMLElement>('world-list');
  private readonly shopMain = mustGet<HTMLElement>('shop-main');
  private readonly shopOwnedCount = mustGet<HTMLElement>('shop-owned-count');
  private readonly shopListTitle = mustGet<HTMLElement>('shop-list-title');
  private readonly listTitle = mustGet<HTMLElement>('shop-title');
  private readonly tabSkins = mustGet<HTMLButtonElement>('tab-skins');
  private readonly tabWorlds = mustGet<HTMLButtonElement>('tab-worlds');
  private readonly toastEl = mustGet<HTMLElement>('toast');
  private readonly toastText = mustGet<HTMLElement>('toast-text');
  private readonly newBestStamp = mustGet<HTMLElement>('new-best-stamp');
  private readonly preview: ShopPreview;
  private readonly callbacks: UICallbacks;
  private activeTab: ShopTab = 'skins';
  private previewSkinId: string;
  private previewWorldId: string;
  private toastTimer = 0;
  private toastHideTimer = 0;
  private resultSoundTimer = 0;
  private lastScore = -1;
  private lastCups = -1;

  constructor(private readonly options: UIOptions) {
    this.callbacks = options.callbacks;
    this.previewSkinId = options.save.state.selectedSkin;
    this.previewWorldId = options.save.state.selectedWorld;
    this.preview = new ShopPreview(this.previewCanvas);
    this.bindEvents();
    this.refreshAll();
  }

  showMenu(): void {
    this.hideAll();
    this.setScrollLock(false);
    this.preview.stop();
    this.menuScreen.hidden = false;
    this.refreshAll();
  }

  showGame(showHint = true): void {
    this.hideAll();
    this.setScrollLock(false);
    this.preview.stop();
    this.gameScreen.hidden = false;
    this.jumpHint.hidden = !showHint;
    this.lastScore = -1;
    this.lastCups = -1;
  }

  showPause(): void {
    this.hideAll();
    this.preview.stop();
    this.gameScreen.hidden = true;
    this.pauseScreen.hidden = false;
    this.setScrollLock(true);
    this.refreshSettings();
  }

  showResults(result: RunResult): void {
    this.hideAll();
    this.preview.stop();
    this.gameScreen.hidden = true;
    this.overScreen.hidden = false;
    this.setScrollLock(true);
    this.fillResults(result);
    this.refreshAll();
    window.clearTimeout(this.resultSoundTimer);
    if (result.newBest) {
      this.resultSoundTimer = window.setTimeout(() => {
        if (!this.overScreen.hidden) this.options.audio.play('newbest');
      }, 420);
    }
  }

  showShop(tab: ShopTab): void {
    this.hideAll();
    this.preview.stop();
    this.activeTab = tab;
    this.previewSkinId = this.options.save.state.selectedSkin;
    this.previewWorldId = this.options.save.state.selectedWorld;
    this.shopScreen.hidden = false;
    this.setScrollLock(true);
    this.applyTabState();
    this.rebuildShopLists();
    this.refreshPreview();
    this.refreshAll();
    this.shopMain.scrollTop = 0;
    this.preview.start();
    this.callbacks.onShopEnter();
  }

  closeShop(): void {
    this.preview.stop();
    this.showMenu();
    this.callbacks.onShopExit();
  }

  updateHud(hud: HudState): void {
    if (this.lastScore !== hud.score) {
      this.lastScore = hud.score;
      this.scoreValue.textContent = formatNumber(hud.score);
    }
    if (this.lastCups !== hud.cups) {
      this.lastCups = hud.cups;
      this.cupCount.textContent = formatNumber(hud.cups);
      if (hud.cups > 0) {
        this.cupHud.classList.remove('is-popping');
        void this.cupHud.offsetWidth;
        this.cupHud.classList.add('is-popping');
      }
    }
  }

  dismissJumpHint(): void {
    if (!this.jumpHint.hidden) this.jumpHint.hidden = true;
  }

  showToast(message: string): void {
    window.clearTimeout(this.toastTimer);
    window.clearTimeout(this.toastHideTimer);
    this.toastText.textContent = message;
    this.toastEl.hidden = false;
    // Force the transition back on when a second toast arrives quickly.
    requestAnimationFrame(() => {
      this.toastEl.classList.add('is-visible');
    });
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('is-visible');
      this.toastHideTimer = window.setTimeout(() => {
        this.toastEl.hidden = true;
      }, 240);
    }, 2800);
  }

  refreshAll(): void {
    this.updateWallet();
    this.refreshSettings();
    if (!this.shopScreen.hidden) {
      this.applyTabState();
      this.rebuildShopLists();
      this.refreshPreview();
    }
  }

  handleVisibility(hidden: boolean): void {
    if (!this.shopScreen.hidden) {
      if (hidden) this.preview.stop();
      else this.preview.start();
    }
  }

  get isShopOpen(): boolean {
    return !this.shopScreen.hidden;
  }

  private bindEvents(): void {
    mustGet<HTMLButtonElement>('play-button').addEventListener('click', () =>
      this.callbacks.onPlay(),
    );
    mustGet<HTMLButtonElement>('pause-button').addEventListener('click', () =>
      this.callbacks.onPause(),
    );
    mustGet<HTMLButtonElement>('resume-button').addEventListener('click', () =>
      this.callbacks.onResume(),
    );
    mustGet<HTMLButtonElement>('restart-pause-button').addEventListener(
      'click',
      () => this.callbacks.onRestartRequested(),
    );
    mustGet<HTMLButtonElement>('home-pause-button').addEventListener(
      'click',
      () => this.callbacks.onHomeRequested(),
    );
    mustGet<HTMLButtonElement>('retry-button').addEventListener('click', () =>
      this.callbacks.onRestartRequested(),
    );
    mustGet<HTMLButtonElement>('home-over-button').addEventListener(
      'click',
      () => this.callbacks.onHomeRequested(),
    );
    mustGet<HTMLButtonElement>('shop-back-button').addEventListener(
      'click',
      () => this.closeShop(),
    );

    document.querySelectorAll<HTMLButtonElement>('[data-open-shop]').forEach(
      (button) => {
        button.addEventListener('click', () => {
          const tab = button.dataset.openShop === 'worlds' ? 'worlds' : 'skins';
          this.showShop(tab);
        });
      },
    );

    this.tabSkins.addEventListener('click', () => this.selectTab('skins'));
    this.tabWorlds.addEventListener('click', () => this.selectTab('worlds'));

    this.soundToggle.addEventListener('click', () => this.toggleSound());
    this.hapticsToggle.addEventListener('click', () => this.toggleHaptics());
    this.pauseSoundToggle.addEventListener('click', () => this.toggleSound());
    this.pauseHapticsToggle.addEventListener('click', () => this.toggleHaptics());

    this.skinList.addEventListener('click', (event) =>
      this.handleShopListClick(event, 'skins'),
    );
    this.worldList.addEventListener('click', (event) =>
      this.handleShopListClick(event, 'worlds'),
    );
    this.skinList.addEventListener('keydown', (event) =>
      this.handleShopListKeydown(event, 'skins'),
    );
    this.worldList.addEventListener('keydown', (event) =>
      this.handleShopListKeydown(event, 'worlds'),
    );

    document.addEventListener(
      'pointerdown',
      (event) => {
        if (!(event.target instanceof Element)) return;
        if (event.target.closest('button, [role="button"]')) {
          this.options.audio.play('click');
        }
      },
      { passive: true },
    );
  }

  private toggleSound(): void {
    const next = !this.options.save.state.sound;
    this.options.save.setSound(next);
    this.options.audio.setEnabled(next);
    if (next) this.options.audio.play('select');
    this.refreshSettings();
    this.showToast(next ? 'Sound on. Papery clicks restored.' : 'Sound off. Silent crumbs.');
  }

  private toggleHaptics(): void {
    const next = !this.options.save.state.haptics;
    this.options.save.setHaptics(next);
    if (next) this.buzz(12);
    this.refreshSettings();
    this.showToast(next ? 'Vibration on.' : 'Vibration off.');
  }

  private refreshSettings(): void {
    const sound = this.options.save.state.sound;
    const haptics = this.options.save.state.haptics;
    this.soundToggle.classList.toggle('is-off', !sound);
    this.soundToggle.setAttribute('aria-pressed', String(sound));
    this.soundToggle.setAttribute(
      'aria-label',
      sound ? 'Turn sound off' : 'Turn sound on',
    );
    this.hapticsToggle.classList.toggle('is-off', !haptics);
    this.hapticsToggle.setAttribute('aria-pressed', String(haptics));
    this.hapticsToggle.setAttribute(
      'aria-label',
      haptics ? 'Turn vibration off' : 'Turn vibration on',
    );

    for (const [button, enabled] of [
      [this.pauseSoundToggle, sound],
      [this.pauseHapticsToggle, haptics],
    ] as Array<[HTMLButtonElement, boolean]>) {
      button.classList.toggle('is-off', !enabled);
      button.setAttribute('aria-pressed', String(enabled));
      const state = button.querySelector<HTMLElement>('.setting-state');
      if (state) state.textContent = enabled ? 'on' : 'off';
    }
  }

  private updateWallet(): void {
    const save = this.options.save.state;
    this.menuCp.textContent = formatNumber(save.cp);
    this.menuBest.textContent = formatNumber(save.best);
    this.shopCp.textContent = formatNumber(save.cp);
    this.tabSkinsCount.textContent = `${save.ownedSkins.length}/10`;
    this.tabWorldsCount.textContent = `${save.ownedWorlds.length}/6`;
    this.menuSkinsOwned.textContent = `${save.ownedSkins.length}/10`;
    this.menuWorldsOwned.textContent = `${save.ownedWorlds.length}/6`;
  }

  private fillResults(result: RunResult): void {
    mustGet<HTMLElement>('result-score').textContent = formatNumber(result.score);
    mustGet<HTMLElement>('result-best').textContent = formatNumber(result.best);
    mustGet<HTMLElement>('result-distance').textContent =
      `${formatNumber(result.distanceM)} m`;
    mustGet<HTMLElement>('result-cups').textContent = formatNumber(result.cups);
    mustGet<HTMLElement>('result-cp').textContent =
      `+${formatNumber(result.cpEarned)} CP`;
    this.newBestStamp.hidden = !result.newBest;

    let title = 'Nicely toasted!';
    let subtitle = 'Some crumbs were sacrificed for the cause.';
    if (result.newBest) {
      title = 'Fresh record!';
      subtitle = 'The counter has a new favourite loaf.';
    } else if (result.cups >= 3) {
      title = 'Well caffeinated!';
      subtitle = 'Enough espresso to toast an entire bakery.';
    } else if (result.cups === 1) {
      title = 'One for the road!';
      subtitle = 'A single paper cup, carried with dignity.';
    } else if (result.distanceM < 100) {
      title = 'A little crumby.';
      subtitle = 'Short run. Excellent crumb trail.';
    } else if (result.score > 800) {
      title = 'Golden crust!';
      subtitle = 'The paper crowd goes absolutely wild.';
    }
    mustGet<HTMLElement>('result-title').textContent = title;
    mustGet<HTMLElement>('result-sub').textContent = subtitle;
    this.lastScore = result.score;
    this.lastCups = result.cups;
  }

  private selectTab(tab: ShopTab): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.applyTabState();
    this.rebuildShopLists();
    this.refreshPreview();
    this.shopMain.scrollTop = 0;
    this.options.audio.play('select');
  }

  private applyTabState(): void {
    const isSkins = this.activeTab === 'skins';
    this.tabSkins.classList.toggle('is-active', isSkins);
    this.tabWorlds.classList.toggle('is-active', !isSkins);
    this.tabSkins.setAttribute('aria-selected', String(isSkins));
    this.tabWorlds.setAttribute('aria-selected', String(!isSkins));
    this.skinList.hidden = !isSkins;
    this.worldList.hidden = isSkins;
    this.shopListTitle.textContent = isSkins
      ? 'Baguette collection'
      : 'World collection';
    const save = this.options.save.state;
    this.shopOwnedCount.textContent = isSkins
      ? `${save.ownedSkins.length} / 10 owned`
      : `${save.ownedWorlds.length} / 6 owned`;
    this.listTitle.textContent = isSkins ? 'Paper Shop' : 'Paper Places';
  }

  private rebuildShopLists(): void {
    this.skinList.replaceChildren();
    for (const entry of this.options.shop.skins) {
      this.skinList.append(this.buildSkinCard(entry));
    }
    this.worldList.replaceChildren();
    for (const entry of this.options.shop.worlds) {
      this.worldList.append(this.buildWorldCard(entry));
    }
    this.applyPreviewClasses();
  }

  private buildSkinCard(entry: ShopEntry<SkinDef>): HTMLElement {
    return this.buildCard({
      kind: 'skin',
      id: entry.item.id,
      name: entry.item.name,
      description: entry.item.description,
      tag: entry.item.tag,
      price: entry.item.price,
      owned: entry.owned,
      selected: entry.selected,
      affordable: entry.affordable,
      draw: (ctx, width, height) => drawSkinThumb(ctx, entry.item, width, height),
    });
  }

  private buildWorldCard(entry: ShopEntry<WorldDef>): HTMLElement {
    return this.buildCard({
      kind: 'world',
      id: entry.item.id,
      name: entry.item.name,
      description: entry.item.description,
      tag: entry.item.tag,
      price: entry.item.price,
      owned: entry.owned,
      selected: entry.selected,
      affordable: entry.affordable,
      draw: (ctx, width, height) =>
        drawWorldThumbnail(ctx, entry.item, width, height),
    });
  }

  private buildCard(options: {
    kind: 'skin' | 'world';
    id: string;
    name: string;
    description: string;
    tag: string;
    price: number;
    owned: boolean;
    selected: boolean;
    affordable: boolean;
    draw: (
      ctx: CanvasRenderingContext2D,
      width: number,
      height: number,
    ) => void;
  }): HTMLElement {
    const card = document.createElement('article');
    card.className = 'shop-card';
    card.dataset.kind = options.kind;
    card.dataset.id = options.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Preview ${options.name}`);
    const isPreviewed =
      options.kind === 'skin'
        ? options.id === this.previewSkinId
        : options.id === this.previewWorldId;
    if (isPreviewed) card.classList.add('is-previewed');

    const art = document.createElement('div');
    art.className = 'card-art';
    const canvas = document.createElement('canvas');
    canvas.width = 140;
    canvas.height = 164;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(2, 2);
      options.draw(ctx, 70, 82);
    }
    art.append(canvas);

    const copy = document.createElement('div');
    copy.className = 'card-copy';
    const titleRow = document.createElement('div');
    titleRow.className = 'card-title-row';
    const title = document.createElement('h4');
    title.className = 'card-title';
    title.textContent = options.name;
    const tag = document.createElement('span');
    tag.className = 'card-tag';
    tag.textContent = options.tag;
    titleRow.append(title, tag);

    const description = document.createElement('p');
    description.className = 'card-desc';
    description.textContent = options.description;
    copy.append(titleRow, description);

    const activeWord = options.kind === 'skin' ? 'Wearing' : 'Visiting';
    const action = document.createElement('div');
    action.className = 'card-action';
    const price = document.createElement('span');
    price.className = 'card-price';
    if (options.owned) {
      price.classList.add('is-owned');
      price.textContent = options.selected ? activeWord : 'Owned';
    } else {
      price.textContent = `${formatNumber(options.price)} CP`;
      if (!options.affordable) price.setAttribute('data-short', 'true');
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-card';
    button.dataset.action = options.selected
      ? 'selected'
      : options.owned
        ? 'wear'
        : 'buy';
    button.dataset.kind = options.kind;
    button.dataset.id = options.id;
    if (options.selected) {
      button.classList.add('is-selected');
      button.textContent = options.kind === 'skin' ? 'Worn' : 'Visiting';
      button.disabled = true;
    } else if (options.owned) {
      button.classList.add('is-owned');
      button.textContent = options.kind === 'skin' ? 'Wear' : 'Visit';
      button.setAttribute(
        'aria-label',
        `${options.kind === 'skin' ? 'Wear' : 'Visit'} ${options.name}`,
      );
    } else {
      button.textContent = 'Buy';
      if (!options.affordable) button.classList.add('is-locked');
      button.setAttribute(
        'aria-label',
        `Buy ${options.name} for ${options.price} Coffee Points`,
      );
    }

    action.append(price, button);
    card.append(art, copy, action);
    return card;
  }

  private handleShopListClick(event: Event, kind: 'skins' | 'worlds'): void {
    if (!(event.target instanceof Element)) return;
    const card = event.target.closest<HTMLElement>('.shop-card');
    if (!card) return;
    const id = card.dataset.id;
    if (!id) return;
    this.setPreview(kind, id);

    const action = event.target.closest<HTMLButtonElement>('[data-action]');
    if (!action || action.disabled) return;
    const actionType = action.dataset.action;
    if (actionType === 'wear') {
      this.wearItem(kind, id);
    } else if (actionType === 'buy') {
      this.buyItem(kind, id);
    }
  }

  private handleShopListKeydown(
    event: KeyboardEvent,
    kind: 'skins' | 'worlds',
  ): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!(event.target instanceof Element)) return;
    const card = event.target.closest<HTMLElement>('.shop-card');
    if (!card) return;
    if (event.target.closest('button')) return;
    event.preventDefault();
    const id = card.dataset.id;
    if (id) this.setPreview(kind, id);
  }

  private setPreview(kind: 'skins' | 'worlds', id: string): void {
    if (kind === 'skins') this.previewSkinId = id;
    else this.previewWorldId = id;
    this.applyPreviewClasses();
    this.refreshPreview();
  }

  private wearItem(kind: 'skins' | 'worlds', id: string): void {
    const success =
      kind === 'skins'
        ? this.options.shop.wearSkin(id)
        : this.options.shop.wearWorld(id);
    if (!success) {
      this.showToast('That one is not in your paper bag yet.');
      return;
    }
    const item =
      kind === 'skins'
        ? this.options.shop.skins.find((entry) => entry.item.id === id)?.item
        : this.options.shop.worlds.find((entry) => entry.item.id === id)?.item;
    this.options.audio.play('select');
    this.buzz(10);
    this.callbacks.onCosmeticsChanged();
    this.refreshAll();
    this.applyPreviewClasses();
    if (item) {
      this.showToast(
        kind === 'skins'
          ? `${item.name} is now on duty.`
          : `${item.name} is now the view.`,
      );
    }
  }

  private buyItem(kind: 'skins' | 'worlds', id: string): void {
    const entry =
      kind === 'skins'
        ? this.options.shop.skins.find((item) => item.item.id === id)
        : this.options.shop.worlds.find((item) => item.item.id === id);
    if (!entry) return;
    if (entry.owned) {
      this.showToast('Already snipped, stamped and yours.');
      return;
    }
    if (!entry.affordable) {
      this.options.audio.play('land');
      this.showToast(
        `Need ${formatNumber(entry.shortfall)} more CP. A few more coffee breaks should do it.`,
      );
      return;
    }

    const result =
      kind === 'skins'
        ? this.options.shop.buySkin(id)
        : this.options.shop.buyWorld(id);
    if (!result.ok) {
      if (result.reason === 'insufficient-funds') {
        this.showToast(
          `Need ${formatNumber(result.shortfall)} more CP for this one.`,
        );
      } else if (result.reason === 'already-owned') {
        this.showToast('Already snipped, stamped and yours.');
      } else {
        this.showToast('That item is not on the shelf right now.');
      }
      this.refreshAll();
      return;
    }

    this.options.audio.play('buy');
    this.buzz([18, 28, 18]);
    this.callbacks.onCosmeticsChanged();
    this.refreshAll();
    this.applyPreviewClasses();
    const itemName =
      kind === 'skins'
        ? this.options.shop.skins.find((item) => item.item.id === id)?.item.name
        : this.options.shop.worlds.find((item) => item.item.id === id)?.item
            .name;
    this.showToast(
      `${itemName ?? 'Item'} is yours. ${
        kind === 'skins'
          ? 'Worn immediately, no receipt needed.'
          : 'Unfolded and ready to visit.'
      }`,
    );
  }

  private applyPreviewClasses(): void {
    for (const card of this.skinList.querySelectorAll<HTMLElement>('.shop-card')) {
      card.classList.toggle('is-previewed', card.dataset.id === this.previewSkinId);
    }
    for (const card of this.worldList.querySelectorAll<HTMLElement>('.shop-card')) {
      card.classList.toggle('is-previewed', card.dataset.id === this.previewWorldId);
    }
  }

  private refreshPreview(): void {
    const save = this.options.save.state;
    const skin =
      this.activeTab === 'skins'
        ? getSkin(this.previewSkinId)
        : getSkin(save.selectedSkin);
    const world =
      this.activeTab === 'worlds'
        ? getWorld(this.previewWorldId)
        : getWorld(save.selectedWorld);
    this.preview.setSelection(skin, world);

    const isSkins = this.activeTab === 'skins';
    const item = isSkins ? skin : world;
    const owned = isSkins
      ? save.ownedSkins.includes(item.id)
      : save.ownedWorlds.includes(item.id);
    const selected = isSkins
      ? save.selectedSkin === item.id
      : save.selectedWorld === item.id;

    this.previewName.textContent = item.name;
    this.previewDesc.textContent = item.description;
    this.previewEyebrow.textContent = isSkins ? 'fitting room' : 'window seat';
    const activeLabel = isSkins ? 'wearing' : 'visiting';
    if (selected) {
      this.previewPrice.textContent = activeLabel;
      this.previewStamp.textContent = activeLabel;
      this.previewStamp.className = 'preview-stamp is-owned';
    } else if (owned) {
      this.previewPrice.textContent = 'owned';
      this.previewStamp.textContent = 'owned';
      this.previewStamp.className = 'preview-stamp is-owned';
    } else {
      this.previewPrice.textContent =
        item.price === 0 ? 'free' : `${formatNumber(item.price)} CP`;
      this.previewStamp.textContent = 'on the rack';
      this.previewStamp.className = 'preview-stamp is-locked';
    }
    this.preview.start();
  }

  private hideAll(): void {
    this.menuScreen.hidden = true;
    this.gameScreen.hidden = true;
    this.pauseScreen.hidden = true;
    this.overScreen.hidden = true;
    this.shopScreen.hidden = true;
    this.hideToast();
  }

  private hideToast(): void {
    window.clearTimeout(this.toastTimer);
    window.clearTimeout(this.toastHideTimer);
    this.toastEl.classList.remove('is-visible');
    this.toastEl.hidden = true;
  }

  private setScrollLock(locked: boolean): void {
    document.body.classList.toggle('allow-scroll', !locked);
  }

  private buzz(pattern: number | number[]): void {
    if (!this.options.save.state.haptics) return;
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    } catch {
      // Haptics are optional.
    }
  }
}

function mustGet<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing UI element #${id}`);
  return element as T;
}

function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString('en-US');
}

function drawSkinThumb(
  ctx: CanvasRenderingContext2D,
  skin: SkinDef,
  width: number,
  height: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, skin.paper);
  gradient.addColorStop(1, withAlpha(skin.bodyMid, 0.9));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = withAlpha(skin.crust, 0.35);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(12 + i * 25, 15 + (i % 2) * 51, 12 + i * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = withAlpha('#fff9eb', 0.38);
  ctx.beginPath();
  ctx.ellipse(width * 0.5, height * 0.86, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  drawStar(
    ctx,
    width * 0.82,
    height * 0.18,
    3,
    withAlpha(skin.accent, 0.5),
    0.3,
  );
  drawBaguette(ctx, skin, {
    x: width * 0.5,
    baseline: height * 0.86,
    groundY: height * 0.9,
    scale: 0.44,
    mode: 'idle',
    runPhase: 0,
    landing: 0,
    happy: 0,
    deathProgress: 0,
    time: 1.2,
    velocity: 0,
  });
}
