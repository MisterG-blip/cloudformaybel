// ============================================================================
// SCENE RENDERER – A Cloud for Maybel
// Lädt eine Szenen-JSON, zeichnet Ebenen, verwaltet Screen-Wechsel (Slide).
// ============================================================================

class SceneRenderer {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx    = ctx;

    this.sceneData    = null;   // geladene JSON
    this.currentIndex = 0;      // Index des aktiven Screens in sceneData.screens
    this.images       = {};     // gecachte Image-Objekte { src: HTMLImageElement }

    // Slide-Transition
    this.transition = null;
    // { fromIndex, toIndex, direction ('left'|'right'), progress (0→1) }
  }

  // -------------------------------------------------------------------------
  // Szene laden
  // -------------------------------------------------------------------------
  async load(jsonPath) {
    const res  = await fetch(jsonPath);
    this.sceneData = await res.json();
    this.currentIndex = 0;

    // Alle Bild-Quellen vorladen
    const srcs = [];
    for (const screen of this.sceneData.screens) {
      for (const layer of screen.layers) {
        if (layer.src) srcs.push(layer.src);
      }
    }
    await this._preloadImages(srcs);
  }

  _preloadImages(srcs) {
    const promises = srcs.map(src => new Promise(resolve => {
      if (this.images[src]) { resolve(); return; }
      const img = new Image();
      img.onload  = () => { this.images[src] = img; resolve(); };
      img.onerror = () => { this.images[src] = null; resolve(); }; // Fehler ignorieren → Platzhalter
      img.src = src;
    }));
    return Promise.all(promises);
  }

  // -------------------------------------------------------------------------
  // Aktuellen Screen-Datensatz zurückgeben
  // -------------------------------------------------------------------------
  get currentScreen() {
    if (!this.sceneData) return null;
    return this.sceneData.screens[this.currentIndex];
  }

  // Item-Daten aus der Szenen-JSON holen
  getItemData(itemId) {
    return this.sceneData?.items?.[itemId] || null;
  }

  // -------------------------------------------------------------------------
  // Screen wechseln (mit Slide-Animation)
  // direction: 'left' | 'right'
  // -------------------------------------------------------------------------
  goToScreen(screenId) {
    if (!this.sceneData) return;
    const toIndex = this.sceneData.screens.findIndex(s => s.id === screenId);
    if (toIndex < 0 || toIndex === this.currentIndex) return;

    const direction = toIndex > this.currentIndex ? 'right' : 'left';
    this.transition = {
      fromIndex: this.currentIndex,
      toIndex,
      direction,
      progress: 0
    };
  }

  // -------------------------------------------------------------------------
  // Update (Transition-Fortschritt)
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (!this.transition) return;

    const SLIDE_SPEED = 0.003; // pro Millisekunde
    this.transition.progress += SLIDE_SPEED * deltaTime;

    if (this.transition.progress >= 1) {
      this.currentIndex = this.transition.toIndex;
      this.transition   = null;
    }
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  draw() {
    if (!this.sceneData) return;

    if (this.transition) {
      this._drawSlide();
    } else {
      this._drawScreen(this.sceneData.screens[this.currentIndex], 0);
    }
  }

  // Einen einzelnen Screen bei offsetX zeichnen
  _drawScreen(screen, offsetX) {
    for (const layer of screen.layers) {
      const img = this.images[layer.src];

      if (img) {
        // Echtes Bild vorhanden
        this.ctx.drawImage(img, offsetX, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } else if (layer.placeholder) {
        // Platzhalter-Farbe
        this.ctx.fillStyle = layer.placeholder;
        this.ctx.fillRect(offsetX, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        // Beschriftung damit man sieht welche Ebene fehlt
        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.font = '13px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`[${layer.src}]`, offsetX + 12, 20);
      }
      // layer ohne placeholder und ohne Bild → unsichtbare Ebene (z. B. objects.png noch nicht da)
    }
  }

  // Slide-Transition: zwei Screens nebeneinander verschieben
  _drawSlide() {
    const t    = this._easeInOut(this.transition.progress);
    const dir  = this.transition.direction;

    // 'right': neuer Screen kommt von rechts → offset startet bei +800, geht zu 0
    // 'left':  neuer Screen kommt von links  → offset startet bei -800, geht zu 0
    const sign       = dir === 'right' ? 1 : -1;
    const fromOffset = -sign * t * CANVAS_WIDTH;
    const toOffset   =  sign * (1 - t) * CANVAS_WIDTH;

    this._drawScreen(this.sceneData.screens[this.transition.fromIndex], fromOffset);
    this._drawScreen(this.sceneData.screens[this.transition.toIndex],   toOffset);
  }

  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // Transition läuft gerade?
  get isTransitioning() {
    return this.transition !== null;
  }
}
