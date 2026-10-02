// Unified input: keyboard, touch swipes and mouse drags all become
// simple actions: 'left' | 'right' | 'up' | 'down' | 'pause'.

export class Input {
  constructor(target) {
    this.listeners = [];
    this.enabled = false;
    this.start = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const map = {
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right',
        ArrowUp: 'up', KeyW: 'up', Space: 'up',
        ArrowDown: 'down', KeyS: 'down',
        Escape: 'pause', KeyP: 'pause',
      };
      const action = map[e.code];
      if (action) {
        e.preventDefault();
        this.emit(action);
      }
    });

    const down = (x, y) => { this.start = { x, y, t: performance.now(), fired: false }; };
    const move = (x, y) => {
      if (!this.start || this.start.fired) return;
      const dx = x - this.start.x, dy = y - this.start.y;
      const dist = Math.hypot(dx, dy);
      // Fire as soon as the finger has travelled far enough: feels instant.
      const threshold = Math.max(24, Math.min(window.innerWidth, window.innerHeight) * 0.045);
      if (dist > threshold) {
        this.start.fired = true;
        if (Math.abs(dx) > Math.abs(dy)) this.emit(dx > 0 ? 'right' : 'left');
        else this.emit(dy > 0 ? 'down' : 'up');
      }
    };
    const up = (x, y) => {
      if (!this.start) return;
      const quickTap = !this.start.fired && performance.now() - this.start.t < 250 &&
        Math.hypot(x - this.start.x, y - this.start.y) < 12;
      // A plain tap jumps, handy for players who don't know swipes yet.
      if (quickTap) this.emit('up');
      this.start = null;
    };

    // Touches that start on a button (e.g. pause) are not swipes or jumps.
    const onButton = (e) => e.target && e.target.closest && e.target.closest('button');
    target.addEventListener('touchstart', (e) => { if (onButton(e)) return; const t = e.changedTouches[0]; down(t.clientX, t.clientY); }, { passive: true });
    target.addEventListener('touchmove', (e) => { const t = e.changedTouches[0]; move(t.clientX, t.clientY); }, { passive: true });
    target.addEventListener('touchend', (e) => { const t = e.changedTouches[0]; up(t.clientX, t.clientY); }, { passive: true });
    target.addEventListener('mousedown', (e) => { if (!onButton(e)) down(e.clientX, e.clientY); });
    window.addEventListener('mousemove', (e) => { if (this.start) move(e.clientX, e.clientY); });
    window.addEventListener('mouseup', (e) => up(e.clientX, e.clientY));
  }

  on(fn) { this.listeners.push(fn); }

  emit(action) {
    if (!this.enabled && action !== 'pause') return;
    for (const fn of this.listeners) fn(action);
  }
}
