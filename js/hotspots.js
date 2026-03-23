// ============================================================================
// HOTSPOT SYSTEM – A Cloud for Maybel
// Liest Hotspots aus der Szenen-JSON, prüft Bedingungen, reagiert auf Klicks.
// Glow: zwei PNG-Frames die langsam wechseln (kein Canvas-Glow mehr).
// ============================================================================

class HotspotSystem {
  constructor() {
    this.hotspots  = [];
    this.glowTimer = 0;    // Zeitgeber für Frame-Wechsel
    this.glowFrame = 0;    // 0 oder 1 (welches der zwei Bilder gerade sichtbar ist)
    this.images    = {};   // gecachte Image-Objekte { src: HTMLImageElement }
    this.hintsOn   = true; // Glow an/aus (Hint-System)
  }

  // -------------------------------------------------------------------------
  // Hotspots laden + Glow-Bilder vorladen
  // -------------------------------------------------------------------------
  load(hotspotList) {
    this.hotspots = hotspotList || [];
    this._preloadGlowImages();
  }

  _preloadGlowImages() {
    for (const hs of this.hotspots) {
      if (!hs.glow?.frames) continue;
      for (const src of hs.glow.frames) {
        if (this.images[src]) continue;
        const img = new Image();
        img.src = src;
        // Kein onload-Handler nötig – wenn das Bild noch lädt,
        // überspringen wir es einfach beim Zeichnen.
        this.images[src] = img;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Bedingung prüfen
  // -------------------------------------------------------------------------
  _checkCondition(hotspot, inventory, usedHotspots = new Set()) {
    const c = hotspot.condition;
    if (!c) return true;
    if (c.itemNotInInventory)  return !inventory.has(c.itemNotInInventory);
    if (c.allItemsInInventory) return c.allItemsInInventory.every(id => inventory.has(id));
    if (c.itemInInventory)     return inventory.has(c.itemInInventory);
    if (c.hotspotUsed)         return usedHotspots.has(c.hotspotUsed);
    return true;
  }

  activeHotspots(inventory, usedHotspots = new Set()) {
    return this.hotspots.filter(hs => this._checkCondition(hs, inventory, usedHotspots));
  }

  // -------------------------------------------------------------------------
  // Klick / Hover
  // -------------------------------------------------------------------------
  handleClick(x, y, actionMode, inventory, usedHotspots) {
    for (const hs of this.activeHotspots(inventory, usedHotspots)) {
      if (this._hit(x, y, hs)) return { hotspot: hs, action: actionMode };
    }
    return null;
  }

  isOverHotspot(x, y, inventory, usedHotspots) {
    return this.activeHotspots(inventory, usedHotspots).some(hs => this._hit(x, y, hs));
  }

  getLabelAt(x, y, inventory, usedHotspots) {
    for (const hs of this.activeHotspots(inventory, usedHotspots)) {
      if (this._hit(x, y, hs)) return hs.label || null;
    }
    return null;
  }

  _hit(x, y, hs) {
    return x >= hs.x && x <= hs.x + hs.w &&
           y >= hs.y && y <= hs.y + hs.h;
  }

  // -------------------------------------------------------------------------
  // Update – Frame-Wechsel
  // fps aus der JSON bestimmt wie schnell gewechselt wird (Standard: 2 fps)
  // Alle Hotspots ticken synchron – sieht ruhiger aus als wenn jeder
  // seinen eigenen Timer hätte.
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (!this.hintsOn) return;

    // Langsamster fps-Wert aller aktiven Hotspots bestimmt den Takt
    // (oder Standard 2 fps wenn keiner definiert ist)
    const fps = this.hotspots.reduce((min, hs) => {
      return hs.glow?.fps ? Math.min(min, hs.glow.fps) : min;
    }, 2);

    this.glowTimer += deltaTime;
    const interval = 1000 / fps;

    if (this.glowTimer >= interval) {
      this.glowTimer -= interval;
      this.glowFrame  = 1 - this.glowFrame; // zwischen 0 und 1 wechseln
    }
  }

  // -------------------------------------------------------------------------
  // Glow zeichnen
  // Jeder Hotspot mit glow.frames bekommt seinen Frame gezeichnet.
  // Kein Fallback mehr – ohne Bild kein Glow.
  // -------------------------------------------------------------------------
  drawGlow(ctx, inventory) {
    if (!this.hintsOn) return;

    for (const hs of this.activeHotspots(inventory)) {
      if (!hs.glow?.frames) continue;

      const src = hs.glow.frames[this.glowFrame];
      const img = this.images[src];

      // Bild noch nicht geladen → überspringen (kein Flackern)
      if (!img || !img.complete || img.naturalWidth === 0) continue;

      ctx.drawImage(img, hs.x, hs.y, hs.w, hs.h);
    }
  }

  // -------------------------------------------------------------------------
  // Label (Tooltip) zeichnen
  // -------------------------------------------------------------------------
  drawLabel(ctx, x, y, inventory) {
    const label = this.getLabelAt(x, y, inventory);
    if (!label) return;

    ctx.save();
    ctx.font      = 'bold 14px sans-serif';
    ctx.textAlign = 'center';

    const w  = ctx.measureText(label).width + 20;
    const lx = Math.min(Math.max(x, w / 2 + 8), CANVAS_WIDTH - w / 2 - 8);
    const ly = Math.max(y - 18, 24);

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(lx - w / 2, ly - 16, w, 22, 6);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx, ly);
    ctx.restore();
  }
}
