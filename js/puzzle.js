// ============================================================================
// PUZZLE SYSTEM – A Cloud for Maybel
// Verwaltet Mini-Rätsel die über der Szene erscheinen.
// Aktuell: combination_lock (4-stelliges Zahlenschloss)
// Erweiterbar: weitere Typen später hinzufügen
// ============================================================================

class PuzzleSystem {
  constructor() {
    this.active    = false;
    this.type      = null;
    this.config    = null;   // Puzzle-Konfiguration aus JSON
    this.onSolve   = null;   // Callback wenn gelöst
    this.onCancel  = null;   // Callback wenn abgebrochen

    // Zustand je Puzzle-Typ
    this._state = {};
  }

  // -------------------------------------------------------------------------
  // Puzzle starten
  // -------------------------------------------------------------------------
  start(puzzleConfig, onSolve, onCancel = null) {
    this.active   = true;
    this.type     = puzzleConfig.type;
    this.config   = puzzleConfig;
    this.onSolve  = onSolve;
    this.onCancel = onCancel;

    if (this.type === 'combination_lock') {
      const digits = puzzleConfig.digits || 4;
      this._state = {
        digits,
        values:   new Array(digits).fill(0),
        selected: 0,   // aktuell markierte Stelle
        shaking:  false,
        shakeTimer: 0,
        solved:   false
      };
    }
  }

  close() {
    this.active = false;
    this.type   = null;
    this.config = null;
    this._state = {};
  }

  // -------------------------------------------------------------------------
  // Klick verarbeiten
  // -------------------------------------------------------------------------
  handleClick(x, y) {
    if (!this.active) return false;
    if (this.type === 'combination_lock') return this._handleLockClick(x, y);
    if (this.type === 'cloud_shoot')      return this._handleCloudShootClick(x, y);
    return true;
  }

  // -------------------------------------------------------------------------
  // Combination Lock – Klick-Logik
  // -------------------------------------------------------------------------
  _handleLockClick(x, y) {
    const s = this._state;
    if (s.solved || s.shaking) return true;

    const layout = this._lockLayout();

    // Schließen-Button
    if (this._inRect(x, y, layout.closeBtn)) {
      this.close();
      if (this.onCancel) this.onCancel();
      return true;
    }

    // Bestätigen-Button
    if (this._inRect(x, y, layout.confirmBtn)) {
      this._checkSolution();
      return true;
    }

    // Hoch/Runter Buttons für jede Stelle
    for (let i = 0; i < s.digits; i++) {
      if (this._inRect(x, y, layout.upBtns[i])) {
        s.values[i] = (s.values[i] + 1) % 10;
        return true;
      }
      if (this._inRect(x, y, layout.downBtns[i])) {
        s.values[i] = (s.values[i] + 9) % 10;
        return true;
      }
      // Direktklick auf Ziffer → als aktiv markieren
      if (this._inRect(x, y, layout.digits[i])) {
        s.selected = i;
        return true;
      }
    }

    return true; // alle Klicks innerhalb des Overlays konsumieren
  }

  _checkSolution() {
    const s   = this.config.solution;
    const cur = this._state.values;
    const correct = s.every((v, i) => v === cur[i]);

    if (correct) {
      this._state.solved = true;
      setTimeout(() => {
        this.close();
        if (this.onSolve) this.onSolve();
      }, 800);
    } else {
      // Schütteln
      this._state.shaking   = true;
      this._state.shakeTimer = 500;
    }
  }

  update(deltaTime) {
    if (!this.active) return;
    if (this.type === 'combination_lock') {
      if (this._state.shaking) {
        this._state.shakeTimer -= deltaTime;
        if (this._state.shakeTimer <= 0) this._state.shaking = false;
      }
    }
    if (this.type === 'cloud_shoot') this._updateCloudShoot(deltaTime);
  }

  draw(ctx) {
    if (!this.active) return;
    if (this.type === 'combination_lock') this._drawLock(ctx);
    if (this.type === 'cloud_shoot')      this._drawCloudShoot(ctx);
  }

  // -------------------------------------------------------------------------
  // Combination Lock – Zeichnung
  // -------------------------------------------------------------------------
  _drawLock(ctx) {
    const s      = this._state;
    const layout = this._lockLayout();
    const shake  = s.shaking ? Math.sin(Date.now() * 0.05) * 6 : 0;
    const solved = s.solved;

    ctx.save();
    ctx.translate(shake, 0);

    // Abdunklung
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Box
    const { bx, by, bw, bh } = layout.box;
    ctx.fillStyle = solved ? '#2a4a2a' : '#1a1a2e';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 14);
    ctx.fill();
    ctx.strokeStyle = solved ? '#5aff5a' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // Titel
    ctx.font      = 'bold 16px sans-serif';
    ctx.fillStyle = solved ? '#5aff5a' : '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      solved ? '✓ Geöffnet!' : '🔒 Zahlenschloss',
      bx + bw / 2, by + 30
    );

    // Hinweis
    if (this.config.hint && !solved) {
      ctx.font      = '12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(this.config.hint, bx + bw / 2, by + 52);
    }

    // Ziffern + Buttons
    for (let i = 0; i < s.digits; i++) {
      const dx = layout.digits[i];
      const ux = layout.upBtns[i];
      const lx = layout.downBtns[i];
      const isSelected = i === s.selected;

      // Hoch-Button
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(ux.x, ux.y, ux.w, ux.h, 6);
      ctx.fill();
      ctx.font      = '16px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('▲', ux.x + ux.w / 2, ux.y + ux.h / 2);

      // Ziffer-Box
      ctx.fillStyle = isSelected
        ? 'rgba(255,220,80,0.25)'
        : 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = isSelected
        ? 'rgba(255,220,80,0.9)'
        : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(dx.x, dx.y, dx.w, dx.h, 8);
      ctx.fill();
      ctx.stroke();

      // Ziffer
      ctx.font      = 'bold 32px monospace';
      ctx.fillStyle = s.shaking ? '#ff6060' : (solved ? '#5aff5a' : '#fff');
      ctx.fillText(s.values[i], dx.x + dx.w / 2, dx.y + dx.h / 2);

      // Runter-Button
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.roundRect(lx.x, lx.y, lx.w, lx.h, 6);
      ctx.fill();
      ctx.font      = '16px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText('▼', lx.x + lx.w / 2, lx.y + lx.h / 2);
    }

    // Bestätigen-Button
    if (!solved) {
      const cb = layout.confirmBtn;
      ctx.fillStyle   = s.shaking ? 'rgba(255,80,80,0.8)' : 'rgba(255,220,80,0.85)';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.roundRect(cb.x, cb.y, cb.w, cb.h, 8);
      ctx.fill();
      ctx.stroke();
      ctx.font      = 'bold 14px sans-serif';
      ctx.fillStyle = s.shaking ? '#fff' : '#000';
      ctx.fillText(
        s.shaking ? 'Falsch!' : 'Bestätigen',
        cb.x + cb.w / 2, cb.y + cb.h / 2
      );
    }

    // Schließen-Button
    const cl = layout.closeBtn;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(cl.x, cl.y, cl.w, cl.h, 6);
    ctx.fill();
    ctx.font      = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('✕ Abbrechen', cl.x + cl.w / 2, cl.y + cl.h / 2);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Layout-Berechnung (zentral im Canvas)
  // -------------------------------------------------------------------------
  _lockLayout() {
    const digits = this._state.digits || 4;
    const bw     = digits * 80 + 60;
    const bh     = 240;
    const bx     = (CANVAS_WIDTH  - bw) / 2;
    const by     = (CANVAS_HEIGHT - bh) / 2;

    const digitW = 60, digitH = 56;
    const btnH   = 32;
    const gap    = 20;
    const startX = bx + (bw - (digits * (digitW + gap) - gap)) / 2;
    const midY   = by + bh / 2 - 10;

    const upBtns   = [];
    const downBtns = [];
    const digitRects = [];

    for (let i = 0; i < digits; i++) {
      const dx = startX + i * (digitW + gap);
      upBtns.push(  { x: dx, y: midY - digitH/2 - btnH - 6, w: digitW, h: btnH });
      digitRects.push({ x: dx, y: midY - digitH/2,            w: digitW, h: digitH });
      downBtns.push({ x: dx, y: midY + digitH/2 + 6,         w: digitW, h: btnH });
    }

    return {
      box:        { bx, by, bw, bh },
      digits:     digitRects,
      upBtns,
      downBtns,
      confirmBtn: { x: bx + bw/2 - 70, y: by + bh - 48, w: 140, h: 34 },
      closeBtn:   { x: bx + bw/2 - 55, y: by + bh - 10, w: 110, h: 24 }
    };
  }

  // Hilfsfunktion: Punkt in Rechteck?
  _inRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w &&
           y >= r.y && y <= r.y + r.h;
  }
}

// ============================================================================
// CLOUD SHOOT MINIGAME
// Wolkenharpune – Runde 1 (freie Jagd) und Runde 2 (Kolben wird dunkel)
// ============================================================================

// Wird in start() initialisiert wenn type === 'cloud_shoot'
// Hier die Hilfsmethoden:

PuzzleSystem.prototype._spawnClouds = function() {
  const s = this._state;
  s.clouds = [];
  const count = 6 + Math.floor(Math.random() * 4); // 6-9 Wolken
  for (let i = 0; i < count; i++) {
    s.clouds.push(this._newCloud());
  }
};

PuzzleSystem.prototype._newCloud = function() {
  const size = 50 + Math.random() * 60;
  return {
    x:       CANVAS_WIDTH + size,              // startet rechts außen
    y:       60 + Math.random() * 320,
    size,
    speed:   40 + Math.random() * 60,          // px/s
    alpha:   0.85 + Math.random() * 0.15,
    clicked: false,
    clickAnim: 0                               // 0→1 Einsammel-Animation
  };
};

PuzzleSystem.prototype._handleCloudShootClick = function(x, y) {
  const s = this._state;
  if (s.phase !== 'playing') return true;

  // Treffer auf Wolke?
  for (const c of s.clouds) {
    if (c.clicked) continue;
    const dx = x - c.x, dy = y - c.y;
    if (Math.hypot(dx, dy) < c.size * 0.6) {
      c.clicked   = true;
      c.clickAnim = 0;
      s.caught++;
      return true;
    }
  }
  return true;
};

PuzzleSystem.prototype._updateCloudShoot = function(deltaTime) {
  const s = this._state;

  if (s.phase === 'playing') {
    s.timeLeft -= deltaTime;

    // Wolken bewegen
    for (const c of s.clouds) {
      if (!c.clicked) {
        c.x -= c.speed * (deltaTime / 1000);
        // Wenn Wolke links raus → neu spawnen rechts
        if (c.x < -c.size * 1.5) {
          Object.assign(c, this._newCloud());
        }
      } else {
        // Einsammel-Animation
        c.clickAnim = Math.min(1, c.clickAnim + deltaTime / 400);
      }
    }

    // Runde 2: Kolben verdunkelt sich
    if (s.round === 2) {
      s.darkening = Math.max(0, Math.min(1, 1 - s.timeLeft / 15000));
    }

    // Zeit abgelaufen
    if (s.timeLeft <= 0) {
      s.phase    = 'ending';
      s.endTimer = s.round === 2 ? 3000 : 1500; // Runde 2 länger für Effekt
    }
  }

  if (s.phase === 'ending') {
    s.endTimer -= deltaTime;
    if (s.endTimer <= 0) {
      s.phase = 'done';
      this.close();
      if (this.onSolve) this.onSolve({ caught: s.caught, round: s.round });
    }
  }
};

PuzzleSystem.prototype._drawCloudShoot = function(ctx) {
  const s = this._state;

  // Fernrohr-Maske: schwarzes Bild mit kreisförmigem Ausschnitt
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Kreisausschnitt freistellen
  const cx = CANVAS_WIDTH  / 2;
  const cy = CANVAS_HEIGHT / 2 - 30;
  const r  = 220;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Himmel
  const skyGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  skyGrad.addColorStop(0, s.round === 2 ? '#4a3a5a' : '#87CEEB');
  skyGrad.addColorStop(1, s.round === 2 ? '#2a1a3a' : '#dff0fa');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Wolken zeichnen
  for (const c of s.clouds) {
    if (c.clickAnim >= 1) continue; // verschwunden

    ctx.save();
    if (c.clicked) {
      // Einsammel-Animation: nach oben schweben + ausblenden
      ctx.translate(c.x, c.y - c.clickAnim * 40);
      ctx.globalAlpha = c.alpha * (1 - c.clickAnim);
      ctx.scale(1 + c.clickAnim * 0.3, 1 + c.clickAnim * 0.3);
    } else {
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = c.alpha;
    }

    // Wolke als weiche Ellipsen
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0,              0,          c.size * 0.5, c.size * 0.35, 0, 0, Math.PI * 2);
    ctx.ellipse(-c.size * 0.3,  c.size * 0.1, c.size * 0.32, c.size * 0.28, 0, 0, Math.PI * 2);
    ctx.ellipse( c.size * 0.3,  c.size * 0.1, c.size * 0.32, c.size * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fadenkreuz wenn nicht geklickt
    if (!c.clicked) {
      ctx.strokeStyle = 'rgba(255,80,80,0.5)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(-c.size * 0.7, 0); ctx.lineTo(c.size * 0.7, 0);
      ctx.moveTo(0, -c.size * 0.7); ctx.lineTo(0, c.size * 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, c.size * 0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Runde 2: Kolben-Verdunkelung als Overlay
  if (s.round === 2 && s.darkening > 0) {
    ctx.fillStyle = `rgba(20,0,40,${s.darkening * 0.6})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  ctx.restore(); // Clip aufheben

  // Fernrohr-Rahmen
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth   = 80;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 40, 0, Math.PI * 2);
  ctx.stroke();

  // Fernrohr-Vignette
  const vign = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  vign.addColorStop(0,   'rgba(0,0,0,0)');
  vign.addColorStop(1,   'rgba(0,0,0,0.5)');
  ctx.fillStyle = vign;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Timer-Anzeige
  const secLeft = Math.max(0, Math.ceil(s.timeLeft / 1000));
  ctx.font      = 'bold 22px monospace';
  ctx.fillStyle = secLeft <= 5 ? '#ff6060' : '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(`⏱ ${secLeft}s`, cx, cy + r + 55);

  // Gefangene Wolken
  ctx.font      = '16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(`☁️ ${s.caught}`, cx, cy + r + 80);

  // Runde 2: Warnung
  if (s.round === 2 && s.darkening > 0.3) {
    ctx.globalAlpha = s.darkening;
    ctx.font      = 'bold 14px sans-serif';
    ctx.fillStyle = '#ff9060';
    ctx.fillText('Der Ätherkolben wird dunkler...', cx, cy - r - 20);
    ctx.globalAlpha = 1;
  }

  // Ending-Phase: Abschluss-Text
  if (s.phase === 'ending') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.font      = 'bold 20px sans-serif';
    ctx.fillStyle = s.round === 2 ? '#ff9060' : '#ffe080';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (s.round === 1) {
      ctx.fillText(`Fantastisch! ${s.caught} Wolken gefangen!`, cx, CANVAS_HEIGHT / 2);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('Die Maschine läuft!', cx, CANVAS_HEIGHT / 2 + 35);
    } else {
      ctx.fillText('Etwas stimmt nicht...', cx, CANVAS_HEIGHT / 2 - 20);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = 'rgba(255,150,100,0.9)';
      ctx.fillText('Der Ätherkolben wird immer dunkler.', cx, CANVAS_HEIGHT / 2 + 20);
    }
  }
};
