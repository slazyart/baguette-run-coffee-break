import { getSkin, SKINS } from '../data/skins';
import type { SkinDef } from './types';
import type { SaveManager } from './SaveManager';

/** Keeps the equipped baguette readable from gameplay without coupling it to UI. */
export class SkinManager {
  constructor(private readonly save: SaveManager) {}

  get all(): SkinDef[] {
    return SKINS;
  }

  get selected(): SkinDef {
    return getSkin(this.save.state.selectedSkin);
  }

  isOwned(id: string): boolean {
    return this.save.state.ownedSkins.includes(id);
  }

  select(id: string): boolean {
    return this.save.selectSkin(id);
  }
}
