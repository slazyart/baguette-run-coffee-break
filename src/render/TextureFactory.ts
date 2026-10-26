import { makeCanvas, mulberry32, withAlpha } from './DrawUtils';

/**
 * A tiny texture atelier. Fibres, flecks and grain are generated once, then
 * reused as CanvasPatterns for the lifetime of the renderer.
 */
export class TextureFactory {
  private readonly paperTiles = new Map<string, HTMLCanvasElement>();
  private readonly patterns = new Map<string, CanvasPattern>();
  private grainTile: HTMLCanvasElement | null = null;
  private grainPattern: CanvasPattern | null = null;

  paperPattern(ctx: CanvasRenderingContext2D, color: string): CanvasPattern {
    const existing = this.patterns.get(color);
    if (existing) return existing;

    let tile = this.paperTiles.get(color);
    if (!tile) {
      tile = this.makePaperTile(color);
      this.paperTiles.set(color, tile);
    }
    const pattern = ctx.createPattern(tile, 'repeat');
    if (!pattern) return this.fallbackPattern(ctx, color);
    this.patterns.set(color, pattern);
    return pattern;
  }

  grain(ctx: CanvasRenderingContext2D): CanvasPattern {
    if (this.grainPattern) return this.grainPattern;
    if (!this.grainTile) this.grainTile = this.makeGrainTile();
    const pattern = ctx.createPattern(this.grainTile, 'repeat');
    if (!pattern) return this.fallbackPattern(ctx, 'rgba(0,0,0,0.05)');
    this.grainPattern = pattern;
    return pattern;
  }

  private fallbackPattern(
    ctx: CanvasRenderingContext2D,
    color: string,
  ): CanvasPattern {
    const empty = document.createElement('canvas');
    empty.width = 1;
    empty.height = 1;
    const fallbackCtx = empty.getContext('2d');
    if (fallbackCtx) {
      fallbackCtx.fillStyle = color;
      fallbackCtx.fillRect(0, 0, 1, 1);
    }
    const pattern = ctx.createPattern(empty, 'repeat');
    if (!pattern) {
      throw new Error('Unable to create canvas pattern.');
    }
    return pattern;
  }

  private makePaperTile(color: string): HTMLCanvasElement {
    const size = 160;
    const { canvas, ctx } = makeCanvas(size, size, 1);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, size);
    const random = mulberry32(
      [...color].reduce((sum, char) => sum + char.charCodeAt(0), 17),
    );

    for (let i = 0; i < 85; i++) {
      const x = random() * size;
      const y = random() * size;
      const length = 1 + random() * 7;
      const horizontal = random() > 0.42;
      ctx.strokeStyle = withAlpha(
        random() > 0.5 ? '#4a2e1c' : '#fff8e9',
        0.035 + random() * 0.065,
      );
      ctx.lineWidth = 0.5 + random() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(
        x + (horizontal ? length * 0.5 : 1),
        y + (horizontal ? 1 : length * 0.5),
        x + (horizontal ? length : 0),
        y + (horizontal ? 0 : length),
      );
      ctx.stroke();
    }

    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = withAlpha(
        random() > 0.4 ? '#3b2516' : '#fffaf0',
        0.025 + random() * 0.08,
      );
      const dot = 0.4 + random() * 1.4;
      ctx.beginPath();
      ctx.arc(random() * size, random() * size, dot, 0, Math.PI * 2);
      ctx.fill();
    }
    return canvas;
  }

  private makeGrainTile(): HTMLCanvasElement {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size, size, 1);
    const image = ctx.createImageData(size, size);
    const random = mulberry32(959);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = random();
      if (value > 0.62) {
        const light = value > 0.93;
        image.data[i] = light ? 255 : 22;
        image.data[i + 1] = light ? 246 : 15;
        image.data[i + 2] = light ? 220 : 9;
        image.data[i + 3] = Math.floor(4 + random() * 15);
      }
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  clear(): void {
    this.patterns.clear();
  }
}
