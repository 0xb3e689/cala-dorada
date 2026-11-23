// Keyboard and mouse input controller with edge-triggered actions and smooth camera look.

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
    this.onAction = null;

    this._bind();
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
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
      this.rightMouseDown = false;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.rightMouseDown = true;
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightMouseDown = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas || this.rightMouseDown) {
        this.lookDeltaX += e.movementX;
        this.lookDeltaY += e.movementY;
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
