// ============================================================================
// INVENTAR – A Cloud for Maybel
// Max. 5 Items. Unterstützt PNG/GIF-Bilder, aktive Selektion,
// Item-in-Item (contains), Kombinationsregeln.
// ============================================================================

const INVENTORY_MAX = 5;
const SLOT_SIZE     = 54;
const SLOT_GAP      = 10;
const SLOT_START_X  = (CANVAS_WIDTH - (INVENTORY_MAX * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP)) / 2;
const SLOT_Y        = CANVAS_HEIGHT - 68;

class Inventory {
  constructor() {
    this.items       = [];     // [{ id, label, emoji, src, contains, canContain, combinesWith, ... }]
    this.activeIndex = null;   // Index des aktuell selektierten Items (null = keins)
    this.images      = {};     // gecachte Image-Objekte { src: HTMLImageElement }
  }

  // -------------------------------------------------------------------------
  // Items verwalten
  // -------------------------------------------------------------------------
  add(item) {
    if (this.items.length >= INVENTORY_MAX) return false;
    if (this.has(item.id)) return false;
    this.items.push(item);
    if (item.src) this._loadImage(item.src);
    return true;
  }

  remove(id) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx < 0) return false;
    this.items.splice(idx, 1);
    if (this.activeIndex >= this.items.length) this.activeIndex = null;
    return true;
  }

  has(id) {
    return this.items.some(i => i.id === id);
  }

  get(id) {
    return this.items.find(i => i.id === id) || null;
  }

  // Bild vorladen
  _loadImage(src) {
    if (this.images[src]) return;
    const img = new Image();
    img.src = src;
    this.images[src] = img;
  }

  // -------------------------------------------------------------------------
  // Selektion
  // -------------------------------------------------------------------------
  setActive(index) {
    this.activeIndex = (this.activeIndex === index) ? null : index;
  }

  get activeItem() {
    return this.activeIndex !== null ? this.items[this.activeIndex] : null;
  }

  clearActive() {
    this.activeIndex = null;
  }

  // -------------------------------------------------------------------------
  // Slot-Position ermitteln (für Klick- und Drag-Prüfung)
  // -------------------------------------------------------------------------
  getSlotAt(x, y) {
    for (let i = 0; i < INVENTORY_MAX; i++) {
      const sx = SLOT_START_X + i * (SLOT_SIZE + SLOT_GAP);
      if (x >= sx && x <= sx + SLOT_SIZE &&
          y >= SLOT_Y && y <= SLOT_Y + SLOT_SIZE) {
        return i;
      }
    }
    return null;
  }

  slotPos(index) {
    return {
      x: SLOT_START_X + index * (SLOT_SIZE + SLOT_GAP) + SLOT_SIZE / 2,
      y: SLOT_Y + SLOT_SIZE / 2
    };
  }

  // -------------------------------------------------------------------------
  // Kombinieren: Item A + Item B → Item C
  // Gibt die neue Item-Definition zurück oder null
  // -------------------------------------------------------------------------
  tryCombine(idA, idB, itemDefs) {
    const defA = itemDefs[idA];
    const defB = itemDefs[idB];
    if (!defA || !defB) return null;

    // Prüfe A.combinesWith[B] oder B.combinesWith[A]
    const resultId = defA.combinesWith?.[idB] || defB.combinesWith?.[idA];
    if (!resultId) return null;

    return itemDefs[resultId] ? { id: resultId, ...itemDefs[resultId] } : null;
  }

  // -------------------------------------------------------------------------
  // Item in Item stecken
  // -------------------------------------------------------------------------
  insertInto(containerId, itemId) {
    const container = this.get(containerId);
    if (!container?.canContain) return false;
    if (container.contains) return false;  // schon was drin
    container.contains = itemId;
    this.remove(itemId);
    return true;
  }

  // Item aus Item nehmen (beide bleiben erhalten)
  extractFrom(containerId) {
    const container = this.get(containerId);
    if (!container?.contains) return false;
    const innerId = container.contains;
    container.contains = null;
    // Inneres Item braucht Definition aus itemDefs → Game kümmert sich darum
    return innerId;
  }

  // Hülle öffnen (verstecktes Item durch Rätsel gefunden):
  // Hülle verschwindet, Inhalt erscheint
  openContainer(containerId, itemDefs) {
    const container = this.get(containerId);
    if (!container?.contains) return null;
    const innerDef = itemDefs[container.contains];
    if (!innerDef) return null;
    const innerItem = { id: container.contains, ...innerDef };
    this.remove(containerId);   // Hülle weg
    this.add(innerItem);        // Inhalt ins Inventar
    return innerItem;
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  draw(ctx, dragSystem) {
    ctx.save();

    // Hintergrund-Leiste
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(
      SLOT_START_X - 10, SLOT_Y - 8,
      INVENTORY_MAX * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP + 20,
      SLOT_SIZE + 16, 10
    );
    ctx.fill();

    for (let i = 0; i < INVENTORY_MAX; i++) {
      const x    = SLOT_START_X + i * (SLOT_SIZE + SLOT_GAP);
      const item = this.items[i];
      const isActive   = i === this.activeIndex;
      // Item das gerade gezogen wird: leerer Slot anzeigen
      const isDragging = dragSystem?.isDragging &&
                         dragSystem.sourceType === 'inventory' &&
                         dragSystem.sourceIndex === i;

      // Slot-Hintergrund
      ctx.fillStyle   = isActive
        ? 'rgba(255,220,80,0.3)'
        : item ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = isActive
        ? 'rgba(255,220,80,0.9)'
        : 'rgba(255,255,255,0.35)';
      ctx.lineWidth   = isActive ? 2 : 1.5;
      ctx.beginPath();
      ctx.roundRect(x, SLOT_Y, SLOT_SIZE, SLOT_SIZE, 6);
      ctx.fill();
      ctx.stroke();

      // Item zeichnen (außer wenn es gerade gezogen wird)
      if (item && !isDragging) {
        this._drawItem(ctx, item, x + SLOT_SIZE / 2, SLOT_Y + SLOT_SIZE / 2);

        // "Enthält etwas" Indikator
        if (item.contains) {
          ctx.fillStyle = 'rgba(255,220,80,0.9)';
          ctx.beginPath();
          ctx.arc(x + SLOT_SIZE - 8, SLOT_Y + 8, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  // Item-Inhalt zeichnen (PNG/GIF oder Emoji als Fallback)
  _drawItem(ctx, item, cx, cy) {
    const img = item.src ? this.images[item.src] : null;

    if (img && img.complete && img.naturalWidth > 0) {
      // Bild zentriert im Slot
      const size = SLOT_SIZE - 12;
      ctx.drawImage(img, cx - size / 2, cy - size / 2 - 4, size, size);
    } else {
      // Emoji-Fallback
      ctx.font         = '26px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#fff';
      ctx.fillText(item.emoji || '?', cx, cy - 4);
    }

    // Label
    ctx.font         = '10px sans-serif';
    ctx.fillStyle    = 'rgba(255,255,255,0.8)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(item.label, cx, SLOT_Y + SLOT_SIZE - 5);
  }

  // Item an beliebiger Position zeichnen (für Drag-Ghost)
  drawItemAt(ctx, item, cx, cy) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    this._drawItem(ctx, item, cx, cy);
    ctx.restore();
  }
}
