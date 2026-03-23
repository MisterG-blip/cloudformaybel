// ============================================================================
// CHARACTER – A Cloud for Maybel
// Maybel läuft zu angeklicktem Zielpunkt, bleibt in der Walkarea (Polygon).
// Tiefen-Skalierung je nach Y-Position.
// Später: Sprite-Sheet hier einhängen, Logik bleibt gleich.
// ============================================================================

const CHAR_SPEED    = 180;   // Pixel pro Sekunde
const CHAR_WIDTH    = 36;
const CHAR_HEIGHT   = 64;

class Character {
  constructor() {
    this.x       = 400;
    this.y       = 500;
    this.targetX = null;
    this.targetY = null;
    this.facing  = 1;       // 1 = rechts, -1 = links
    this.walking = false;
    this.frame   = 0;
    this.frameTimer = 0;
    this.onArrived  = null;

    // Walkarea-Polygon des aktuellen Screens (Array von {x,y})
    this.walkareaPoints = null;
    // Tiefen-Skalierung
    this.depthscale = null;
    // Basis-Größe der Szene (1.0 = normal, 2.0 = doppelt so groß)
    this.characterScale = 1.0;
  }

  // Walkarea + Depthscale aus Szenen-Screen laden
  loadFromScreen(screen) {
    this.walkareaPoints = screen?.walkarea?.points   || null;
    this.depthscale     = screen?.depthscale         || null;
    this.characterScale = screen?.characterScale     ?? 1.0;
    // Startposition
    if (screen?.playerStart) {
      this.x = screen.playerStart.x;
      this.y = screen.playerStart.y;
    }
  }

  // -------------------------------------------------------------------------
  // Ziel setzen – Punkt wird auf Walkarea geclampt
  // -------------------------------------------------------------------------
  walkTo(x, y = null, callback = null) {
    let tx = x;
    let ty = y !== null ? y : this.y;

    // Ziel auf Walkarea clampen
    if (this.walkareaPoints) {
      const clamped = this._clampToWalkarea(tx, ty);
      tx = clamped.x;
      ty = clamped.y;
    }

    this.targetX   = tx;
    this.targetY   = ty;
    this.onArrived = callback;
    this.walking   = true;
    this.facing    = tx > this.x ? 1 : -1;
  }

  stop() {
    this.targetX   = null;
    this.targetY   = null;
    this.walking   = false;
    this.onArrived = null;
  }

  // -------------------------------------------------------------------------
  // Punkt auf Walkarea clampen
  // Ist der Punkt im Polygon → direkt verwenden
  // Sonst → nächsten Punkt auf dem Polygon-Rand finden
  // -------------------------------------------------------------------------
  _clampToWalkarea(x, y) {
    if (!this.walkareaPoints || this.walkareaPoints.length < 3) return { x, y };

    if (this._pointInPolygon(x, y, this.walkareaPoints)) return { x, y };

    // Nächsten Punkt auf dem Polygon-Rand suchen
    let best = null;
    let bestDist = Infinity;
    const pts = this.walkareaPoints;

    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const closest = this._closestPointOnSegment(x, y, a, b);
      const dist = Math.hypot(closest.x - x, closest.y - y);
      if (dist < bestDist) { bestDist = dist; best = closest; }
    }

    return best || { x, y };
  }

  // Punkt-im-Polygon Test (Ray Casting)
  _pointInPolygon(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Nächster Punkt auf einer Linie A→B
  _closestPointOnSegment(px, py, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return { x: a.x, y: a.y };
    const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lenSq));
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  // -------------------------------------------------------------------------
  // Tiefen-Skalierung: Maybel wird kleiner wenn sie nach hinten geht
  // -------------------------------------------------------------------------
  _getScale() {
    const base = this.characterScale ?? 1.0;
    if (!this.depthscale) return base;
    const { yNear, yFar, scaleNear, scaleFar } = this.depthscale;
    const t = Math.max(0, Math.min(1, (this.y - yFar) / (yNear - yFar)));
    return base * (scaleFar + t * (scaleNear - scaleFar));
  }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (!this.walking || this.targetX === null) return;

    const distX = this.targetX - this.x;
    const distY = this.targetY - this.y;
    const total = Math.hypot(distX, distY);
    const step  = CHAR_SPEED * (deltaTime / 1000);

    if (total <= step) {
      // Ziel erreicht
      this.x       = this.targetX;
      this.y       = this.targetY;
      this.walking = false;
      this.targetX = null;
      this.targetY = null;
      if (this.onArrived) {
        const cb = this.onArrived;
        this.onArrived = null;
        cb();
      }
    } else {
      // Schritt diagonal berechnen
      const nx = this.x + (distX / total) * step;
      const ny = this.y + (distY / total) * step;

      // Position nach Schritt auf Walkarea clampen
      if (this.walkareaPoints) {
        const clamped = this._clampToWalkarea(nx, ny);
        this.x = clamped.x;
        this.y = clamped.y;
      } else {
        this.x = nx;
        this.y = ny;
      }

      this.facing = distX !== 0 ? Math.sign(distX) : this.facing;
    }

    this.frameTimer += deltaTime;
    if (this.frameTimer > 200) {
      this.frame = 1 - this.frame;
      this.frameTimer = 0;
    }
  }

  // -------------------------------------------------------------------------
  // Draw – Platzhalter-Figur mit Tiefen-Skalierung
  // Später: ctx.drawImage(spriteSheet, ...) hier einsetzen
  // -------------------------------------------------------------------------
  draw(ctx) {
    ctx.save();
    const scale = this._getScale();
    ctx.translate(this.x, this.y);
    ctx.scale(scale * this.facing, scale);

    const w = CHAR_WIDTH;
    const h = CHAR_HEIGHT;
    const bob = this.walking ? (this.frame === 0 ? -2 : 2) : 0;

    // Körper
    ctx.fillStyle = '#e8a87c';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h + bob, w, h * 0.55, 6);
    ctx.fill();

    // Kopf
    ctx.fillStyle = '#f5c5a0';
    ctx.beginPath();
    ctx.arc(0, -h + bob - 14, 16, 0, Math.PI * 2);
    ctx.fill();

    // Haare
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(0, -h + bob - 22, 16, Math.PI, 0);
    ctx.fill();

    // Augen
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-5, -h + bob - 14, 2.5, 0, Math.PI * 2);
    ctx.arc( 5, -h + bob - 14, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Beine
    ctx.fillStyle = '#6b8cba';
    if (this.walking) {
      const swing = this.frame === 0 ? 6 : -6;
      ctx.fillRect(-w / 2,           -h * 0.45 + bob,          w * 0.42, h * 0.45);
      ctx.fillRect( w / 2 - w * 0.42, -h * 0.45 + bob + swing, w * 0.42, h * 0.45);
    } else {
      ctx.fillRect(-w / 2, -h * 0.45 + bob, w, h * 0.45);
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Debug: Walkarea einzeichnen
  // -------------------------------------------------------------------------
  drawWalkarea(ctx) {
    if (!this.walkareaPoints || this.walkareaPoints.length < 3) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 100, 0.5)';
    ctx.fillStyle   = 'rgba(0, 255, 100, 0.08)';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(this.walkareaPoints[0].x, this.walkareaPoints[0].y);
    for (let i = 1; i < this.walkareaPoints.length; i++) {
      ctx.lineTo(this.walkareaPoints[i].x, this.walkareaPoints[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
