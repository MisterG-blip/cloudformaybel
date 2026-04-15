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
        if (obj.visual?.src) srcs.push(obj.visual.src);
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
  draw(inventory, usedHotspots, consumedItems) {
    if (!this.sceneData) return;
    if (this.transition) {
      this._drawSlide(inventory, usedHotspots, consumedItems);
    } else {
      this._drawScreen(this.sceneData.screens[this.currentIndex], 0, inventory, usedHotspots, consumedItems);
    }
  }

  _drawScreen(screen, offsetX, inventory, usedHotspots, consumedItems, deltaTime) {
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

    // 2. Objects — condition prüfen, dann zeichnen
    for (const obj of screen.objects || []) {
      if (!this._checkCondition(obj.condition, inventory, usedHotspots, consumedItems)) continue;

      // NPC-Object: visual-Block + Spritesheet-Support
      if (obj.type === 'npc') {
        this._drawNpc(obj, offsetX, inventory, usedHotspots, consumedItems, deltaTime);
        continue;
      }

      // Normales Object
      if (!obj.src) continue;
      const img = this.images[obj.src];
      if (!img) continue;      

      const x = offsetX + (obj.x || 0);
      const y = obj.y || 0;
      const w = obj.w || 256;
      const h = obj.h || 256;

      const notClickable = obj.clickable === false ||
        (obj.clickable && !this._checkCondition(obj.clickable, inventory, usedHotspots, consumedItems));

      this.ctx.save();
      this.ctx.globalAlpha = notClickable ? (obj.alpha ?? 1) * 0.45 : (obj.alpha ?? 1);
      if (obj.flipX) {
        this.ctx.translate(x + w, y);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(img, 0, 0, w, h);
      } else {
        this.ctx.drawImage(img, x, y, w, h);
      }
      this.ctx.restore();

      // Glow
      if (!notClickable && obj.glow?.frames) {
        const glowSrc = obj.glow.frames[this.glowFrame];
        const glowImg = this.images[glowSrc];
        if (glowImg) {
          this.ctx.save();
          this.ctx.globalAlpha = 0.7 + Math.sin(Date.now() * 0.003) * 0.15;
          this.ctx.drawImage(glowImg, x, y, w, h);
          this.ctx.restore();
        }
      }
    }
  }

  // NPC zeichnen — Spritesheet mit frame-Ausschnitt
  _drawNpc(obj, offsetX, inventory, usedHotspots, consumedItems, deltaTime) {
    const visual = obj.visual;
    if (!visual?.src) return;

    const img = this.images[visual.src];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    // -----------------------------
    // Animation Update (STATE LAYER)
    // -----------------------------
    this._updateNpcAnimation(obj, visual, deltaTime);

    const scale = visual.scale ?? 1;

    // Basis Frame-Größe
    const frameW = visual.frameW ?? img.naturalWidth;
    const frameH = visual.frameH ?? img.naturalHeight;

    // -----------------------------
    // STATE → ANIMATION
    // -----------------------------
    const state = visual.state || 'idle';
    const config = visual.states?.[state];

    const frameCount = config?.frames ?? 1;
    const row = config?.row ?? 0;

    const frameIndex = (obj._animFrame ?? 0) % frameCount;

    const frameX = frameIndex * frameW;
    const frameY = row * frameH;

    // -----------------------------
    // DRAW SIZE
    // -----------------------------
    const drawW = frameW * scale;
    const drawH = frameH * scale;

    // -----------------------------
    // PIVOT SYSTEM
    // -----------------------------
    const pivotX = visual.pivotX ?? 0.5;
    const pivotY = visual.pivotY ?? (visual.anchor === 'bottom' ? 1 : 0.5);

    const offsetXv = visual.offsetX ?? 0;
    const offsetYv = visual.offsetY ?? 0;

    // Weltposition (Fußpunkt)
    const baseX = offsetX + (obj.x || 0);
    const baseY = obj.y || 0;

    // -----------------------------
    // FINAL POSITION
    // -----------------------------
    const x = baseX - drawW * pivotX + offsetXv;
    const y = baseY - drawH * pivotY + offsetYv;

    // -----------------------------
    // RENDER
    // -----------------------------
    this.ctx.drawImage(
      img,
      frameX, frameY,
      frameW, frameH,
      x, y,
      drawW, drawH
    );
  }

  _updateNpcAnimation(obj, visual, deltaTime) {
    const state = visual.state || 'idle';
    const config = visual.states?.[state];
    if (!config) return;

    const fps = config.fps ?? 1;
    const frameTime = 1000 / fps;

    obj._animTimer = (obj._animTimer || 0) + deltaTime;

    if (obj._animTimer >= frameTime) {
      obj._animTimer -= frameTime; // 🔥 wichtig: NICHT resetten
      obj._animFrame = ((obj._animFrame || 0) + 1) % (config.frames ?? 1);
    }
  }

  _drawSlide(inventory, usedHotspots, consumedItems) {
    const t   = this._easeInOut(this.transition.progress);
    const dir = this.transition.direction;
    const sign = dir === 'right' ? 1 : -1;
    this._drawScreen(this.sceneData.screens[this.transition.fromIndex],
      -sign * t * CANVAS_WIDTH, inventory, usedHotspots, consumedItems);
    this._drawScreen(this.sceneData.screens[this.transition.toIndex],
      sign * (1 - t) * CANVAS_WIDTH, inventory, usedHotspots, consumedItems);
  }



  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Bedingung prüfen (gleiche Logik wie HotspotSystem)
  _checkCondition(c, inventory, usedHotspots, consumedItems) {
    if (!c || !inventory) return true;
    if (c.allConditions)       return c.allConditions.every(sub => this._checkCondition(sub, inventory, usedHotspots, consumedItems));
    if (c.itemNotInInventory)  return !inventory.has(c.itemNotInInventory);
    if (c.itemInInventory)     return inventory.has(c.itemInInventory);
    if (c.allItemsInInventory) return c.allItemsInInventory.every(id => inventory.has(id));
    if (c.hotspotUsed)         return usedHotspots?.has(c.hotspotUsed) || false;
    if (c.hotspotUsedWith) {
      const actions = usedHotspots?.get(c.hotspotUsedWith.id);
      return actions ? actions.has(c.hotspotUsedWith.action) : false;
    }
    if (c.eggNotSeen)       return !usedHotspots?.has(`__egg_seen_${c.eggNotSeen}`);
    if (c.itemConsumed)    return consumedItems?.has(c.itemConsumed)    || false;
    if (c.itemNotConsumed) return !consumedItems?.has(c.itemNotConsumed) ?? true;
    return true;
  }
}
