import type { PurchaseResult, RunReward, SaveData } from './types';
import { SKIN_BY_ID } from '../data/skins';
import { WORLD_BY_ID } from '../data/worlds';

const STORAGE_KEY = 'baguette-run.coffee-break.save';
const SAVE_VERSION = 1;

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  cp: 0,
  best: 0,
  runs: 0,
  totalCups: 0,
  ownedSkins: ['classic'],
  selectedSkin: 'classic',
  ownedWorlds: ['kraft-kitchen'],
  selectedWorld: 'kraft-kitchen',
  sound: true,
  haptics: true,
  lastClaimedRun: null,
};

function asWholeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function safeIdList(value: unknown, known: Set<string>, fallback: string): string[] {
  const ids = Array.isArray(value)
    ? value.filter(
        (entry): entry is string => typeof entry === 'string' && known.has(entry),
      )
    : [];
  const unique = [...new Set(ids)];
  if (!unique.includes(fallback)) unique.unshift(fallback);
  return unique;
}

/**
 * Versioned, defensive local persistence. Every mutation goes through a small
 * method here so a purchase or run reward is written exactly once.
 */
export class SaveManager {
  private data: SaveData;

  constructor(private readonly storage: Storage | null = getStorage()) {
    this.data = this.load();
  }

  get state(): Readonly<SaveData> {
    return this.data;
  }

  private load(): SaveData {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(DEFAULT_SAVE);

      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || parsed.version !== SAVE_VERSION) {
        return structuredClone(DEFAULT_SAVE);
      }

      const ownedSkins = safeIdList(
        parsed.ownedSkins,
        new Set(SKIN_BY_ID.keys()),
        'classic',
      );
      const ownedWorlds = safeIdList(
        parsed.ownedWorlds,
        new Set(WORLD_BY_ID.keys()),
        'kraft-kitchen',
      );
      const selectedSkin =
        typeof parsed.selectedSkin === 'string' &&
        ownedSkins.includes(parsed.selectedSkin)
          ? parsed.selectedSkin
          : 'classic';
      const selectedWorld =
        typeof parsed.selectedWorld === 'string' &&
        ownedWorlds.includes(parsed.selectedWorld)
          ? parsed.selectedWorld
          : 'kraft-kitchen';

      return {
        version: 1,
        cp: asWholeNumber(parsed.cp),
        best: asWholeNumber(parsed.best),
        runs: asWholeNumber(parsed.runs),
        totalCups: asWholeNumber(parsed.totalCups),
        ownedSkins,
        selectedSkin,
        ownedWorlds,
        selectedWorld,
        sound: typeof parsed.sound === 'boolean' ? parsed.sound : true,
        haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : true,
        lastClaimedRun:
          typeof parsed.lastClaimedRun === 'string' ? parsed.lastClaimedRun : null,
      };
    } catch {
      return structuredClone(DEFAULT_SAVE);
    }
  }

  private persist(): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn('[BAGUETTE RUN] Could not write local save.', error);
    }
  }

  recordRun(
    runId: string,
    score: number,
    _distanceM: number,
    cups: number,
    cp: number,
  ): RunReward {
    if (this.data.lastClaimedRun === runId) {
      return { cp: 0, newBest: false, alreadyClaimed: true };
    }

    const newBest = score > this.data.best;
    this.data.cp += Math.max(0, Math.floor(cp));
    this.data.best = newBest ? Math.floor(score) : this.data.best;
    this.data.runs += 1;
    this.data.totalCups += Math.max(0, Math.floor(cups));
    this.data.lastClaimedRun = runId;
    this.persist();

    return { cp: Math.max(0, Math.floor(cp)), newBest, alreadyClaimed: false };
  }

  /** One shared transaction path for both skins and worlds. */
  private transact(
    kind: 'skin' | 'world',
    id: string,
    price: number,
    owned: string[],
  ): PurchaseResult {
    if (owned.includes(id)) {
      return {
        ok: false,
        reason: 'already-owned',
        shortfall: 0,
        newBalance: this.data.cp,
      };
    }

    if (this.data.cp < price) {
      return {
        ok: false,
        reason: 'insufficient-funds',
        shortfall: price - this.data.cp,
        newBalance: this.data.cp,
      };
    }

    this.data.cp -= price;
    owned.push(id);
    if (kind === 'skin') this.data.selectedSkin = id;
    else this.data.selectedWorld = id;
    this.persist();

    return {
      ok: true,
      reason: 'ok',
      shortfall: 0,
      newBalance: this.data.cp,
    };
  }

  buySkin(id: string, price: number): PurchaseResult {
    return this.transact('skin', id, price, this.data.ownedSkins);
  }

  buyWorld(id: string, price: number): PurchaseResult {
    return this.transact('world', id, price, this.data.ownedWorlds);
  }

  selectSkin(id: string): boolean {
    if (!this.data.ownedSkins.includes(id) || !SKIN_BY_ID.has(id)) return false;
    if (this.data.selectedSkin === id) return true;
    this.data.selectedSkin = id;
    this.persist();
    return true;
  }

  selectWorld(id: string): boolean {
    if (!this.data.ownedWorlds.includes(id) || !WORLD_BY_ID.has(id)) return false;
    if (this.data.selectedWorld === id) return true;
    this.data.selectedWorld = id;
    this.persist();
    return true;
  }

  setSound(enabled: boolean): void {
    this.data.sound = enabled;
    this.persist();
  }

  setHaptics(enabled: boolean): void {
    this.data.haptics = enabled;
    this.persist();
  }
}

function getStorage(): Storage | null {
  try {
    const probe = '__baguette_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
