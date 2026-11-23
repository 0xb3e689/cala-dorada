// Keyboard and mouse input controller with Pointer Lock + safe click-to-lock guard (never fires on re-lock)
// and smooth drag fallback for full 360-degree GTA mouse look.

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
    this.pointerLockEngagedAt = 0;
    this.fireSuppressedUntil = 0;
    this._pointerLockUnsupported = false;
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

  suppressFireFor(ms = 220) {
    const until = performance.now() + ms;
    if (until > this.fireSuppressedUntil) this.fireSuppressedUntil = until;
    this.mouseDown = false;
  }

  canFireNow() {
    if (!this.mouseDown) return false;
    const now = performance.now();
    if (now < this.fireSuppressedUntil) return false;
    if (now - this.pointerLockEngagedAt < 200) return false;
    // If pointer lock is eligible and supported, require active lock before firing
    if (this.canPointerLock && this.canPointerLock() && !this._pointerLockUnsupported) {
      if (document.pointerLockElement !== this.canvas) return false;
    }
    return true;
  }

  requestPointerLockSafe() {
    try {
      if (document.pointerLockElement !== this.canvas && this.canvas.requestPointerLock) {
        const res = this.canvas.requestPointerLock();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {
            this._pointerLockUnsupported = true;
          });
        }
      }
    } catch {
      this._pointerLockUnsupported = true;
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
        // Safe Pointer-Lock Click Guard: if not locked yet, acquire pointer lock and NEVER fire!
        if (this.canPointerLock && this.canPointerLock() && document.pointerLockElement !== this.canvas) {
          this.mouseDown = false;
          this.suppressFireFor(220);
          this.requestPointerLockSafe();
          return;
        }
        const now = performance.now();
        if (now < this.fireSuppressedUntil || now - this.pointerLockEngagedAt < 200) {
          this.mouseDown = false;
          return;
        }
        this.mouseDown = true;
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
        this.lookDeltaX += Math.max(-120, Math.min(120, dx));
        this.lookDeltaY += Math.max(-120, Math.min(120, dy));
      }
    });

    window.addEventListener('wheel', (e) => {
      this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked && !this.pointerLocked) {
        this.pointerLockEngagedAt = performance.now();
        this._pointerLockUnsupported = false;
        this.suppressFireFor(220);
      }
      this.pointerLocked = locked;
    });

    document.addEventListener('pointerlockerror', () => {
      this._pointerLockUnsupported = true;
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
