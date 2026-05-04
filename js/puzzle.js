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
        selected: 0,
        shaking:  false,
        shakeTimer: 0,
        solved:   false
      };
    }
    if (this.type === 'cloud_shoot') {
      this._initCloudShoot();
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
// Zielfernrohr bewegt sich mit der Maus. Wolken ziehen vorbei.
// Gedrückthalten auf einer Wolke saugt sie ein.
// 10 Wolken gefangen → Ätherkolben füllt sich → Akt-1-Ende.
// ============================================================================

PuzzleSystem.prototype._initCloudShoot = function() {
  const s = this._state;
  s.phase      = 'playing';
  s.caught     = 0;
  s.goal       = this.config.goal || 10;
  s.clouds     = [];
  s.lensX      = CANVAS_WIDTH  / 2;   // Linsen-Mittelpunkt
  s.lensY      = CANVAS_HEIGHT / 2;
  s.lensR      = 160;                  // Radius Zielfernrohr
  s.holding    = false;                // Maustaste/Touch gehalten
  s.holdTarget = null;                 // Wolke die gerade eingesogen wird
  s.holdProgress = 0;                  // 0 → 1
  s.holdDuration = 900;                // ms zum vollständigen Einsaugen
  s.endTimer   = 0;
  s.kolbenFill = 0;                    // 0 → 1 für Ätherkolben-Animation

  // Wolken-Pool spawnen
  for (let i = 0; i < 8; i++) {
    s.clouds.push(this._newCloud(i === 0));
  }
};

PuzzleSystem.prototype._newCloud = function(startOnscreen = false) {
  const size  = 55 + Math.random() * 55;
  const y     = 50 + Math.random() * (CANVAS_HEIGHT - 150);
  const x     = startOnscreen
    ? Math.random() * CANVAS_WIDTH
    : CANVAS_WIDTH + size + Math.random() * 200;
  return {
    x, y, size,
    speed:     25 + Math.random() * 35,   // px/s, langsam
    alpha:     0.82 + Math.random() * 0.18,
    sucked:    false,
    suckAnim:  0                           // 0 → 1
  };
};

PuzzleSystem.prototype._handleCloudShootInput = function(x, y, holding) {
  const s = this._state;
  if (s.phase !== 'playing') return;
  s.lensX   = x;
  s.lensY   = y;
  s.holding = holding;
  if (!holding) {
    s.holdTarget   = null;
    s.holdProgress = 0;
  }
};

PuzzleSystem.prototype._handleCloudShootClick = function(x, y) {
  // Einzel-Klick: kein Effekt im cloud_shoot (nur gedrückthalten zählt)
  return true;
};

PuzzleSystem.prototype._updateCloudShoot = function(deltaTime) {
  const s = this._state;
  if (s.phase !== 'playing') {
    if (s.phase === 'ending') {
      s.endTimer  -= deltaTime;
      s.kolbenFill = Math.min(1, s.kolbenFill + deltaTime / 2000);
      if (s.endTimer <= 0) {
        s.phase = 'done';
        this.close();
        if (this.onSolve) this.onSolve({ caught: s.caught });
      }
    }
    return;
  }

  // Wolken bewegen
  for (const c of s.clouds) {
    if (c.sucked) {
      c.suckAnim = Math.min(1, c.suckAnim + deltaTime / 350);
      // Fertig eingesogen → neu spawnen
      if (c.suckAnim >= 1) {
        if (s.holdTarget === c) { s.holdTarget = null; s.holdProgress = 0; }
        Object.assign(c, this._newCloud(false));
      }
      continue;
    }
    c.x -= c.speed * (deltaTime / 1000);
    if (c.x < -c.size * 2) Object.assign(c, this._newCloud(false));
  }

  // Gedrückthalten → Wolke einsaugen
  if (s.holding) {
    // Ziel-Wolke bestimmen: nächste ungesaugte Wolke im Linsen-Radius
    if (!s.holdTarget) {
      for (const c of s.clouds) {
        if (c.sucked) continue;
        if (Math.hypot(c.x - s.lensX, c.y - s.lensY) < s.lensR * 0.65) {
          s.holdTarget   = c;
          s.holdProgress = 0;
          break;
        }
      }
    }

    if (s.holdTarget && !s.holdTarget.sucked) {
      // Noch im Radius?
      if (Math.hypot(s.holdTarget.x - s.lensX, s.holdTarget.y - s.lensY) < s.lensR * 0.8) {
        s.holdProgress += deltaTime / s.holdDuration;
        if (s.holdProgress >= 1) {
          s.holdTarget.sucked = true;
          s.holdTarget        = null;
          s.holdProgress      = 0;
          s.caught++;
          if (s.caught >= s.goal) {
            s.phase    = 'ending';
            s.endTimer = 3500;
          }
        }
      } else {
        // Ziel verlassen
        s.holdTarget   = null;
        s.holdProgress = 0;
      }
    }
  } else {
    s.holdTarget   = null;
    s.holdProgress = 0;
  }
};

PuzzleSystem.prototype._drawCloudShoot = function(ctx) {
  const s  = this._state;
  const lx = s.lensX, ly = s.lensY, lr = s.lensR;

  // ── Hintergrund: Nachthimmel ──────────────────────────────────────────────
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  sky.addColorStop(0, '#0a0e2a');
  sky.addColorStop(1, '#1a2a4a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Sterne
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  // Deterministisch via seed
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 137 + 42) % CANVAS_WIDTH);
    const sy = ((i * 97  + 13) % (CANVAS_HEIGHT * 0.7));
    const sr = 0.5 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Wolken hinter der Linse ───────────────────────────────────────────────
  for (const c of s.clouds) {
    if (c.suckAnim >= 1) continue;
    ctx.save();
    if (c.sucked) {
      // Zum Linsenmittelpunkt ziehen + schrumpfen
      const cx = c.x + (lx - c.x) * c.suckAnim;
      const cy = c.y + (ly - c.y) * c.suckAnim;
      ctx.translate(cx, cy);
      ctx.globalAlpha = c.alpha * (1 - c.suckAnim);
      ctx.scale(1 - c.suckAnim * 0.8, 1 - c.suckAnim * 0.8);
    } else {
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = c.alpha * 0.25; // außerhalb der Linse: kaum sichtbar
    }
    this._drawCloudShape(ctx, c.size, '#aac8e8');
    ctx.restore();
  }

  // ── Linsen-Clip: Innere Sicht ─────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.clip();

  // Heller Tageshimmel durch die Linse
  const innerSky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  innerSky.addColorStop(0, '#87CEEB');
  innerSky.addColorStop(1, '#dff0fa');
  ctx.fillStyle = innerSky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Wolken in der Linse (voll sichtbar)
  for (const c of s.clouds) {
    if (c.suckAnim >= 1) continue;
    ctx.save();
    if (c.sucked) {
      const cx = c.x + (lx - c.x) * c.suckAnim;
      const cy = c.y + (ly - c.y) * c.suckAnim;
      ctx.translate(cx, cy);
      ctx.globalAlpha = 1 - c.suckAnim;
      ctx.scale(1 - c.suckAnim * 0.8, 1 - c.suckAnim * 0.8);
    } else {
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = c.alpha;
    }
    this._drawCloudShape(ctx, c.size, '#ffffff');
    ctx.restore();
  }

  // Einsaug-Fortschritt: Wirbel-Ring
  if (s.holding && s.holdTarget && s.holdProgress > 0) {
    const p = s.holdProgress;
    ctx.save();
    ctx.translate(s.holdTarget.x, s.holdTarget.y);
    ctx.strokeStyle = `rgba(120,200,255,${0.4 + p * 0.5})`;
    ctx.lineWidth   = 3 + p * 4;
    ctx.beginPath();
    ctx.arc(0, 0, s.holdTarget.size * (1.1 - p * 0.4), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // Clip aufheben

  // ── Linsen-Rahmen & Fadenkreuz ────────────────────────────────────────────
  // Äußerer schwarzer Ring
  ctx.strokeStyle = '#0a0e1a';
  ctx.lineWidth   = 70;
  ctx.beginPath();
  ctx.arc(lx, ly, lr + 35, 0, Math.PI * 2);
  ctx.stroke();

  // Glasrand
  ctx.strokeStyle = '#3a5a7a';
  ctx.lineWidth   = 4;
  ctx.beginPath();
  ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.stroke();

  // Vignette
  const vign = ctx.createRadialGradient(lx, ly, lr * 0.55, lx, ly, lr);
  vign.addColorStop(0, 'rgba(0,0,0,0)');
  vign.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vign;
  ctx.beginPath();
  ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  ctx.fill();

  // Fadenkreuz
  const fc = s.holding ? 'rgba(80,200,255,0.9)' : 'rgba(255,80,80,0.8)';
  ctx.strokeStyle = fc;
  ctx.lineWidth   = 1.5;
  // Horizontale Linie
  ctx.beginPath();
  ctx.moveTo(lx - lr * 0.9, ly); ctx.lineTo(lx - lr * 0.15, ly);
  ctx.moveTo(lx + lr * 0.15, ly); ctx.lineTo(lx + lr * 0.9, ly);
  ctx.stroke();
  // Vertikale Linie
  ctx.beginPath();
  ctx.moveTo(lx, ly - lr * 0.9); ctx.lineTo(lx, ly - lr * 0.15);
  ctx.moveTo(lx, ly + lr * 0.15); ctx.lineTo(lx, ly + lr * 0.9);
  ctx.stroke();
  // Mittelkreis
  ctx.beginPath();
  ctx.arc(lx, ly, lr * 0.13, 0, Math.PI * 2);
  ctx.stroke();

  // ── HUD: Ätherkolben-Füllung ──────────────────────────────────────────────
  const fill    = s.phase === 'ending' ? s.kolbenFill : s.caught / s.goal;
  const kolbenX = CANVAS_WIDTH - 60, kolbenY = 30;
  const kolbenW = 28, kolbenH = 90;

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(kolbenX - 4, kolbenY - 4, kolbenW + 8, kolbenH + 8, 6);
  ctx.fill();

  // Leerer Kolben
  ctx.strokeStyle = 'rgba(180,220,255,0.7)';
  ctx.lineWidth   = 2;
  ctx.strokeRect(kolbenX, kolbenY, kolbenW, kolbenH);

  // Füllung (Wolkennebel: bläulich-weiß)
  if (fill > 0) {
    const fillH = kolbenH * fill;
    const nebel = ctx.createLinearGradient(0, kolbenY + kolbenH - fillH, 0, kolbenY + kolbenH);
    nebel.addColorStop(0, 'rgba(180,220,255,0.6)');
    nebel.addColorStop(1, 'rgba(220,240,255,0.9)');
    ctx.fillStyle = nebel;
    ctx.fillRect(kolbenX, kolbenY + kolbenH - fillH, kolbenW, fillH);
  }

  // Kolben-Label
  ctx.font      = '11px sans-serif';
  ctx.fillStyle = 'rgba(200,230,255,0.8)';
  ctx.textAlign = 'center';
  ctx.fillText('☁', kolbenX + kolbenW / 2, kolbenY + kolbenH + 16);

  // Zähler
  ctx.font      = 'bold 14px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(`${s.caught}/${s.goal}`, kolbenX + kolbenW / 2, kolbenY - 12);

  // Hinweis (nur am Anfang)
  if (s.caught === 0) {
    ctx.font      = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'center';
    ctx.fillText('Gedrückt halten zum Einsaugen', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
  }

  // ── Ending-Overlay ────────────────────────────────────────────────────────
  if (s.phase === 'ending') {
    const t = 1 - (s.endTimer / 3500);
    ctx.fillStyle = `rgba(10,14,42,${Math.min(0.85, t * 1.5)})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (t > 0.4) {
      ctx.globalAlpha = Math.min(1, (t - 0.4) * 2.5);
      ctx.font        = 'bold 24px sans-serif';
      ctx.fillStyle   = '#c8e8ff';
      ctx.textAlign   = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Der Ätherkolben ist gefüllt.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
      ctx.font        = '16px sans-serif';
      ctx.fillStyle   = 'rgba(180,210,255,0.8)';
      ctx.fillText('Ende von Akt I', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);
      ctx.globalAlpha = 1;
    }
  }

  ctx.textBaseline = 'alphabetic';
};

PuzzleSystem.prototype._drawCloudShape = function(ctx, size, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse( 0,              0,            size * 0.50, size * 0.33, 0, 0, Math.PI * 2);
  ctx.ellipse(-size * 0.30,    size * 0.08,  size * 0.30, size * 0.26, 0, 0, Math.PI * 2);
  ctx.ellipse( size * 0.30,    size * 0.08,  size * 0.30, size * 0.26, 0, 0, Math.PI * 2);
  ctx.ellipse( size * 0.05,   -size * 0.12,  size * 0.22, size * 0.20, 0, 0, Math.PI * 2);
  ctx.fill();
};
