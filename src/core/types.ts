export type ScreenName = 'menu' | 'game' | 'pause' | 'over' | 'shop';

export type SkinPattern =
  | 'scores'
  | 'espresso'
  | 'latte'
  | 'matcha'
  | 'barista'
  | 'iced'
  | 'cinnamon'
  | 'beans'
  | 'croissant'
  | 'gold';

export type SkinAccessory =
  | 'none'
  | 'espresso-cup'
  | 'matcha-label'
  | 'apron'
  | 'iced-straw'
  | 'cinnamon-stick'
  | 'croissant-pin'
  | 'gold-label';

export interface SkinDef {
  id: string;
  name: string;
  description: string;
  price: number;
  tag: string;
  body: string;
  bodyLight: string;
  bodyMid: string;
  crust: string;
  crustDark: string;
  ink: string;
  accent: string;
  paper: string;
  pattern: SkinPattern;
  accessory: SkinAccessory;
  swatch: string;
}

export type WorldKind =
  | 'kitchen'
  | 'cafe'
  | 'farm'
  | 'midnight'
  | 'matcha'
  | 'bakery';

export interface WorldDef {
  id: string;
  name: string;
  description: string;
  price: number;
  tag: string;
  kind: WorldKind;
  swatch: string;
  palette: {
    skyTop: string;
    skyBottom: string;
    wall: string;
    wallSpot: string;
    far: string;
    mid: string;
    ink: string;
    accent: string;
    accentSoft: string;
    ground: string;
    groundDark: string;
    groundLight: string;
    glow: string;
  };
}

export type ObstacleKind =
  | 'napkin'
  | 'box'
  | 'bean'
  | 'cup'
  | 'bags'
  | 'sugar';

export interface ObstacleView {
  kind: ObstacleKind;
  x: number;
  width: number;
  height: number;
  variant: number;
  phase: number;
}

export interface CupView {
  x: number;
  y: number;
  phase: number;
  collected: boolean;
}

export interface HudState {
  score: number;
  cups: number;
  distance: number;
}

export interface RunResult {
  score: number;
  distanceM: number;
  cups: number;
  cpEarned: number;
  cpBalance: number;
  best: number;
  newBest: boolean;
  runId: string;
}

export interface SaveData {
  version: 1;
  cp: number;
  best: number;
  runs: number;
  totalCups: number;
  ownedSkins: string[];
  selectedSkin: string;
  ownedWorlds: string[];
  selectedWorld: string;
  sound: boolean;
  haptics: boolean;
  lastClaimedRun: string | null;
}

export type PurchaseReason =
  | 'ok'
  | 'already-owned'
  | 'insufficient-funds'
  | 'unknown-item';

export interface PurchaseResult {
  ok: boolean;
  reason: PurchaseReason;
  shortfall: number;
  newBalance: number;
}

export interface RunReward {
  cp: number;
  newBest: boolean;
  alreadyClaimed: boolean;
}
