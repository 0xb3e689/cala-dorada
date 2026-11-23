// Keyboard and mouse input controller with Pointer Lock + smooth drag fallback for full 360-degree GTA mouse look.

export class InputController {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouseDown = false;
    this.rightMouseDown = false;
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.wheelDelta = 0;
    this.pointerLocked = false;
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this._lastClientX = null;
    this._lastClientY = null;
    this.canPointerLock = null; // () => boolean set by engine
    this.allowLeftDragLook = null; // () => boolean set by engine
    this.onAction = null;
    this.onKeyUp = null;

    this._bind();
  }

  requestPointerLockSafe() {
    try {
      if (document.pointerLockElement !== this.canvas && this.canvas.requestPointerLock) {
        const res = this.canvas.requestPointerLock();
        if (res && typeof res.catch === 'function') res.catch(() => {});
      }
    } catch {
      // Headless or browser restriction; drag fallback remains active
    }
  }

  exitPointerLockSafe() {
    try {
      if (document.pointerLockElement === this.canvas && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(code)) {
        e.preventDefault();
      }
      if (!this.keys.has(code)) {
        this.justPressed.add(code);
        if (this.onAction) this.onAction(code);
      }
      this.keys.add(code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (this.onKeyUp) this.onKeyUp(e.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
      this._lastClientX = null;
      this._lastClientY = null;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this._lastClientX = e.clientX;
      this._lastClientY = e.clientY;
      if (e.button === 0) {
        this.mouseDown = true;
        if (this.canPointerLock && this.canPointerLock()) {
          this.requestPointerLockSafe();
        }
      }
      if (e.button === 2) {
        this.rightMouseDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightMouseDown = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      const prevX = this._lastClientX ?? e.clientX;
      const prevY = this._lastClientY ?? e.clientY;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this._lastClientX = e.clientX;
      this._lastClientY = e.clientY;

      const isLocked = document.pointerLockElement === this.canvas;
      const leftDrag = this.mouseDown && (!this.allowLeftDragLook || this.allowLeftDragLook());
      if (isLocked || this.rightMouseDown || leftDrag) {
        const dx = (e.movementX !== undefined && (isLocked || e.movementX !== 0)) ? e.movementX : (e.clientX - prevX);
        const dy = (e.movementY !== undefined && (isLocked || e.movementY !== 0)) ? e.movementY : (e.clientY - prevY);
        // Clamp giant focus-jump deltas
        this.lookDeltaX += Math.max(-120, Math.min(120, dx));
        this.lookDeltaY += Math.max(-120, Math.min(120, dy));
      }
    });

    window.addEventListener('wheel', (e) => {
      this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  consumePress(code) {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code);
      return true;
    }
    return false;
  }

  endFrame() {
    this.justPressed.clear();
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    this.wheelDelta = 0;
  }

  getMoveAxes() {
    const forward = (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0) -
      (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    const right = (this.isDown('KeyD') || this.isDown('ArrowRight') ? 1 : 0) -
      (this.isDown('KeyA') || this.isDown('ArrowLeft') ? 1 : 0);
    return { forward, right };
  }
}
