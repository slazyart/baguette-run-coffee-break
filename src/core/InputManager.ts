export interface InputCallbacks {
  onPress: () => void;
  onRelease: () => void;
  onAnyGesture: () => void;
}

/**
 * Window-level Pointer Events avoid tiny hit targets while playing. A held
 * finger or held key can only cause one jump; release is tracked so the next
 * deliberate press can queue after landing.
 */
export class InputManager {
  private enabled = false;
  private pointerDown = false;
  private jumpHeld = false;

  constructor(private readonly callbacks: InputCallbacks) {
    window.addEventListener('pointerdown', this.handlePointerDown, {
      passive: false,
    });
    window.addEventListener('pointerup', this.handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', this.handlePointerUp, {
      passive: true,
    });
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.releaseAll();
  }

  private isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(
        'button, a, input, textarea, select, [contenteditable="true"], [data-no-jump]',
      ),
    );
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.callbacks.onAnyGesture();
    if (!this.enabled || event.button > 0 || this.pointerDown) return;
    if (this.isInteractiveTarget(event.target)) return;
    this.pointerDown = true;
    if (event.cancelable) event.preventDefault();
    this.pressJump();
  };

  private handlePointerUp = (): void => {
    if (!this.pointerDown && !this.jumpHeld) return;
    this.pointerDown = false;
    this.releaseJump();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    this.callbacks.onAnyGesture();
    if (!this.enabled) return;
    if (this.isInteractiveTarget(event.target)) return;
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      event.preventDefault();
      if (event.repeat || this.jumpHeld) return;
      this.jumpHeld = true;
      this.callbacks.onPress();
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
      this.jumpHeld = false;
      this.callbacks.onRelease();
    }
  };

  private pressJump(): void {
    if (this.jumpHeld) return;
    this.jumpHeld = true;
    this.callbacks.onPress();
  }

  private releaseJump(): void {
    if (!this.jumpHeld) return;
    this.jumpHeld = false;
    this.callbacks.onRelease();
  }

  private releaseAll = (): void => {
    this.pointerDown = false;
    this.releaseJump();
  };
}
