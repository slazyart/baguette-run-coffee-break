import type { RunResult } from '../core/types';
import type { SaveManager } from '../core/SaveManager';

const METRES_PER_CP = 8;
const CP_PER_CUP = 2;

/**
 * Converts a finished run into Coffee Points exactly once. The unique run token
 * is also persisted, so a repeated call is a no-op even after a page lifecycle
 * race or a double retry click.
 */
export class CurrencySystem {
  constructor(private readonly save: SaveManager) {}

  quote(distanceM: number, cups: number): number {
    return Math.floor(distanceM / METRES_PER_CP) + cups * CP_PER_CUP;
  }

  claimRun(
    runId: string,
    score: number,
    distanceM: number,
    cups: number,
  ): RunResult {
    const quoted = this.quote(distanceM, cups);
    const reward = this.save.recordRun(runId, score, distanceM, cups, quoted);
    return {
      runId,
      score,
      distanceM,
      cups,
      cpEarned: reward.cp,
      cpBalance: this.save.state.cp,
      best: this.save.state.best,
      newBest: reward.newBest,
    };
  }
}
