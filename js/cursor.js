// ============================================================================
// CURSOR SYSTEM – A Cloud for Maybel
// Ersetzt den System-Cursor durch eine gezeichnete Hand.
// Drei Zustände: normal (zeigend) / hover (leuchtend) / click (greifend)
// Farbe ändert sich je nach Aktionsmodus.
// ============================================================================

const CURSOR_COLORS = {
  look: '#a8d8ff',   // hellblau
  take: '#ffe0a0',   // warm-gelb
  talk: '#c8ffb0'    // hellgrün
};

class CursorSystem {
  constructor(canvas) {
    this.canvas  = canvas;
    this.x       = -100;
    this.y       = -100;
    this.mode    = 'look';    // aktueller Aktionsmodus
    this.hover   = false;     // über Hotspot?
    this.clicked = false;     // kurzes Klick-Feedback
    this.clickTimer = 0;

    // System-Cursor verstecken
    canvas.style.cursor = 'none';

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      const s = parseFloat(canvas.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1);
      this.x = (e.clientX - r.left) / s;
      this.y = (e.clientY - r.top)  / s;
    });

    canvas.addEventListener('mouseleave', () => {
      this.x = -100; this.y = -100;
    });
  }

  // Vom Game aufgerufen wenn geklickt wurde
  triggerClick() {
    this.clicked    = true;
    this.clickTimer = 150;  // ms
  }

  update(deltaTime, isOverHotspot, actionMode) {
    this.hover = isOverHotspot;
    this.mode  = actionMode;
    if (this.clicked) {
      this.clickTimer -= deltaTime;
      if (this.clickTimer <= 0) this.clicked = false;
    }
  }

  // -------------------------------------------------------------------------
  // Gezeichnete Hand
  // -------------------------------------------------------------------------
  draw(ctx) {
    if (this.x < 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);

    const color  = CURSOR_COLORS[this.mode] || '#fff';
    const scale  = this.hover ? 1.2 : 1.0;
    const closed = this.clicked;  // Faust beim Klicken

    ctx.scale(scale, scale);

    // Schatten für Lesbarkeit
    ctx.shadowColor   = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur    = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    if (closed) {
      this._drawFist(ctx, color);
    } else {
      this._drawPointer(ctx, color);
    }

    ctx.restore();
  }

  // Zeigefinger-Hand
  _drawPointer(ctx, color) {
    ctx.fillStyle   = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 1.5;

    // Handfläche
    ctx.beginPath();
    ctx.roundRect(-8, 2, 18, 16, 4);
    ctx.fill(); ctx.stroke();

    // Zeigefinger (oben)
    ctx.beginPath();
    ctx.roundRect(-2, -16, 8, 20, 3);
    ctx.fill(); ctx.stroke();

    // Mittelfinger (leicht kürzer, nach hinten)
    ctx.beginPath();
    ctx.roundRect(7, -10, 7, 15, 3);
    ctx.fill(); ctx.stroke();

    // Ringfinger
    ctx.beginPath();
    ctx.roundRect(-10, -6, 7, 11, 3);
    ctx.fill(); ctx.stroke();
  }

  // Greif-Hand (beim Klicken)
  _drawFist(ctx, color) {
    ctx.fillStyle   = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 1.5;

    ctx.beginPath();
    ctx.roundRect(-9, -4, 20, 18, 6);
    ctx.fill(); ctx.stroke();

    // Finger-Knöchel-Andeutung
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth   = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-4 + i * 6, -2, 2.5, Math.PI, 0);
      ctx.stroke();
    }
  }
}
