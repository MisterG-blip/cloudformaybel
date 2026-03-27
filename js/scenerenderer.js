// ============================================================================
// SCENE RENDERER – A Cloud for Maybel
// Lädt Szenen-JSON, zeichnet Layer + Objects, verwaltet Screen-Wechsel.
// Objects vereinen Hotspot + Dekoration + Glow in einem Eintrag.
// ============================================================================

class SceneRenderer {
  constructor(canvas, ctx) {
    this.canvas    = canvas;
    this.ctx       = ctx;
    this.sceneData = null;
    this.currentIndex = 0;
    this.images    = {};
    this.glowTimer = 0;
    this.glowFrame = 0;
    this.transition = null;
  }

  // -------------------------------------------------------------------------
  // Laden
  // -------------------------------------------------------------------------
  async load(jsonPath) {
    const res      = await fetch(jsonPath);
    this.sceneData = await res.json();
    this.currentIndex = 0;
    this.glowTimer = 0;
    this.glowFrame = 0;

    const srcs = [];
    for (const screen of this.sceneData.screens) {
      for (const layer of screen.layers || []) {
        if (layer.src) srcs.push(layer.src);
      }
      for (const obj of screen.objects || []) {
        if (obj.src) srcs.push(obj.src);
        for (const frame of obj.glow?.frames || []) srcs.push(frame);
      }
    }
    await this._preloadImages(srcs);
  }

  _preloadImages(srcs) {
    const unique = [...new Set(srcs)];
    return Promise.all(unique.map(src => new Promise(resolve => {
      if (this.images[src]) { resolve(); return; }
      const img = new Image();
      img.onload  = () => { this.images[src] = img; resolve(); };
      img.onerror = () => { this.images[src] = null; resolve(); };
      img.src = src;
    })));
  }

  get currentScreen() {
    return this.sceneData?.screens[this.currentIndex] || null;
  }

  // -------------------------------------------------------------------------
  // Screen-Wechsel
  // -------------------------------------------------------------------------
  goToScreen(screenId) {
    if (!this.sceneData) return;
    const toIndex = this.sceneData.screens.findIndex(s => s.id === screenId);
    if (toIndex < 0 || toIndex === this.currentIndex) return;
    const direction = toIndex > this.currentIndex ? 'right' : 'left';
    this.transition = { fromIndex: this.currentIndex, toIndex, direction, progress: 0 };
  }

  get isTransitioning() { return this.transition !== null; }

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------
  update(deltaTime) {
    // Glow-Frames
    const fps = 2;
    this.glowTimer += deltaTime;
    if (this.glowTimer >= 1000 / fps) {
      this.glowTimer -= 1000 / fps;
      this.glowFrame  = 1 - this.glowFrame;
    }

    if (!this.transition) return;
    this.transition.progress += 0.003 * deltaTime;
    if (this.transition.progress >= 1) {
      this.currentIndex = this.transition.toIndex;
      this.transition   = null;
    }
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  draw(inventory, usedHotspots) {
    if (!this.sceneData) return;
    if (this.transition) {
      this._drawSlide(inventory, usedHotspots);
    } else {
      this._drawScreen(this.sceneData.screens[this.currentIndex], 0, inventory, usedHotspots);
    }
  }

  _drawScreen(screen, offsetX, inventory, usedHotspots) {
    // 1. Hintergrund-Layer
    for (const layer of screen.layers || []) {
      const img = this.images[layer.src];
      if (img) {
        this.ctx.drawImage(img, offsetX, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else if (layer.placeholder) {
        this.ctx.fillStyle = layer.placeholder;
        this.ctx.fillRect(offsetX, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.font = '13px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`[${layer.src}]`, offsetX + 12, 20);
      }
    }

    // 2. Objects (Dekoration + Hotspot-Bild) — nur wenn condition erfüllt
    for (const obj of screen.objects || []) {
      if (!this._checkCondition(obj.condition, inventory, usedHotspots)) continue;
      if (!obj.src) continue;

      const img = this.images[obj.src];
      if (!img) continue;

      const x = offsetX + (obj.x || 0);
      const y = obj.y || 0;
      const w = obj.w || 256;
      const h = obj.h || 256;

      // Sichtbar aber nicht klickbar → leicht ausgegraut
      const notClickable = obj.clickable === false ||
        (obj.clickable && !this._checkCondition(obj.clickable, inventory, usedHotspots));

      this.ctx.save();
      const baseAlpha = obj.alpha !== undefined ? obj.alpha : 1.0;
      //this.ctx.globalAlpha = notClickable ? baseAlpha * 0.45 : baseAlpha; hier könnte ich Sachen halbtransparent machen.
      if (obj.flipX) {
        this.ctx.translate(x + w, y);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(img, 0, 0, w, h);
      } else {
        this.ctx.drawImage(img, x, y, w, h);
      }
      this.ctx.restore();

      // Glow nur wenn klickbar
      if (!notClickable && obj.glow?.frames) {
        const glowSrc = obj.glow.frames[this.glowFrame];
        const glowImg = this.images[glowSrc];
        if (glowImg) {
          this.ctx.save();
          this.ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.003) * 0.15;
          this.ctx.drawImage(glowImg, offsetX + obj.x, obj.y, obj.w, obj.h);
          this.ctx.restore();
        }
      }
    }
  }

  _drawSlide(inventory, usedHotspots) {
    const t   = this._easeInOut(this.transition.progress);
    const dir = this.transition.direction;
    const sign = dir === 'right' ? 1 : -1;
    this._drawScreen(this.sceneData.screens[this.transition.fromIndex],
      -sign * t * CANVAS_WIDTH, inventory, usedHotspots);
    this._drawScreen(this.sceneData.screens[this.transition.toIndex],
      sign * (1 - t) * CANVAS_WIDTH, inventory, usedHotspots);
  }

  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Bedingung prüfen (gleiche Logik wie HotspotSystem)
  _checkCondition(c, inventory, usedHotspots) {
    if (!c || !inventory) return true;
    if (c.allConditions)       return c.allConditions.every(sub => this._checkCondition(sub, inventory, usedHotspots));
    if (c.itemNotInInventory)  return !inventory.has(c.itemNotInInventory);
    if (c.itemInInventory)     return inventory.has(c.itemInInventory);
    if (c.allItemsInInventory) return c.allItemsInInventory.every(id => inventory.has(id));
    if (c.hotspotUsed)         return usedHotspots?.has(c.hotspotUsed) || false;
    if (c.hotspotUsedWith) {
      const actions = usedHotspots?.get(c.hotspotUsedWith.id);
      return actions ? actions.has(c.hotspotUsedWith.action) : false;
    }
    if (c.eggNotSeen) return !usedHotspots?.has(`__egg_seen_${c.eggNotSeen}`);
    return true;
  }
}
