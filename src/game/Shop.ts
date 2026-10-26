import type { PurchaseResult, SkinDef, WorldDef } from '../core/types';
import { SKINS } from '../data/skins';
import { WORLDS } from '../data/worlds';
import type { SaveManager } from '../core/SaveManager';

export interface ShopEntry<T> {
  item: T;
  owned: boolean;
  selected: boolean;
  affordable: boolean;
  shortfall: number;
}

/**
 * Catalog-facing facade. Purchases always delegate to SaveManager's single
 * transaction path; UI never edits the wallet directly.
 */
export class Shop {
  constructor(private readonly save: SaveManager) {}

  get skins(): ShopEntry<SkinDef>[] {
    return SKINS.map((item) => this.entry(item, 'skin'));
  }

  get worlds(): ShopEntry<WorldDef>[] {
    return WORLDS.map((item) => this.entry(item, 'world'));
  }

  private entry<T extends SkinDef | WorldDef>(
    item: T,
    kind: 'skin' | 'world',
  ): ShopEntry<T> {
    const state = this.save.state;
    const owned =
      kind === 'skin'
        ? state.ownedSkins.includes(item.id)
        : state.ownedWorlds.includes(item.id);
    const selected =
      kind === 'skin'
        ? state.selectedSkin === item.id
        : state.selectedWorld === item.id;

    return {
      item,
      owned,
      selected,
      affordable: state.cp >= item.price,
      shortfall: Math.max(0, item.price - state.cp),
    };
  }

  buySkin(id: string): PurchaseResult {
    const skin = SKINS.find((entry) => entry.id === id);
    if (!skin) {
      return {
        ok: false,
        reason: 'unknown-item',
        shortfall: 0,
        newBalance: this.save.state.cp,
      };
    }
    return this.save.buySkin(skin.id, skin.price);
  }

  buyWorld(id: string): PurchaseResult {
    const world = WORLDS.find((entry) => entry.id === id);
    if (!world) {
      return {
        ok: false,
        reason: 'unknown-item',
        shortfall: 0,
        newBalance: this.save.state.cp,
      };
    }
    return this.save.buyWorld(world.id, world.price);
  }

  wearSkin(id: string): boolean {
    return this.save.selectSkin(id);
  }

  wearWorld(id: string): boolean {
    return this.save.selectWorld(id);
  }
}
