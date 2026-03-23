// ============================================================================
// DIALOG SYSTEM – A Cloud for Maybel
// Zeigt Text-Dialoge als Box unten im Canvas.
// ============================================================================

class DialogSystem {
  constructor() {
    this.active = false;
    this.lines  = [];
    this.onClose = null;
  }

  show(text, onClose = null) {
    this.lines   = text.split('\n').filter(l => l.trim() !== '');
    this.active  = true;
    this.onClose = onClose;
  }

  close() {
    this.active  = false;
    this.lines   = [];
    if (this.onClose) {
      const cb = this.onClose;
      this.onClose = null;
      cb();
    }
  }

  // Klick → schließen
  handleClick() {
    if (this.active) { this.close(); return true; }
    return false;
  }

  draw(ctx) {
    if (!this.active) return;

    const bx = 60, by = 420, bw = 680, bh = 120;

    ctx.save();

    // Box
    ctx.fillStyle = 'rgba(10, 10, 30, 0.82)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Text
    ctx.fillStyle    = '#fff';
    ctx.font         = '15px sans-serif';
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'top';
    const lineH = 23;
    this.lines.forEach((line, i) => {
      ctx.fillText(line, bx + 18, by + 16 + i * lineH);
    });

    // Klick-Hinweis
    ctx.font      = '11px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'right';
    ctx.fillText('[ klicken ]', bx + bw - 14, by + bh - 16);

    ctx.restore();
  }
}
