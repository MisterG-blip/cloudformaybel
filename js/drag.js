// ============================================================================
// DRAG SYSTEM – A Cloud for Maybel
// Verwaltet Drag & Drop für Items:
//   - Inventar-Slot → Inventar-Slot  (kombinieren oder in Item stecken)
//   - Inventar-Slot → Szene          (platzieren)
// ============================================================================

class DragSystem {
  constructor(canvas, inventory) {
    this.canvas      = canvas;
    this.inventory   = inventory;

    this.isDragging  = false;
    this.item        = null;    // das gezogene Item
    this.sourceType  = null;    // 'inventory'
    this.sourceIndex = null;    // Slot-Index

    this.x = 0;   // aktuelle Maus/Touch-Position
    this.y = 0;

    this._setupEvents();
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  _setupEvents() {
    // Maus
    this.canvas.addEventListener('mousedown',  e => this._onStart(e.clientX, e.clientY));
    this.canvas.addEventListener('mousemove',  e => this._onMove(e.clientX, e.clientY));
    this.canvas.addEventListener('mouseup',    e => this._onEnd(e.clientX, e.clientY));

    // Touch
    this.canvas.addEventListener('touchstart', e => {
      const t = e.touches[0];
      this._onStart(t.clientX, t.clientY);
    }, { passive: true });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      this._onMove(t.clientX, t.clientY);
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      const t = e.changedTouches[0];
      this._onEnd(t.clientX, t.clientY);
    }, { passive: true });
  }

  _toCanvas(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const s = parseFloat(
      this.canvas.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || 1
    );
    return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
  }

  // -------------------------------------------------------------------------
  // Drag starten
  // -------------------------------------------------------------------------
  _onStart(clientX, clientY) {
    const { x, y } = this._toCanvas(clientX, clientY);
    const slotIndex = this.inventory.getSlotAt(x, y);

    if (slotIndex !== null && this.inventory.items[slotIndex]) {
      this.isDragging  = true;
      this.item        = this.inventory.items[slotIndex];
      this.sourceType  = 'inventory';
      this.sourceIndex = slotIndex;
      this.x = x;
      this.y = y;
    }
  }

  // -------------------------------------------------------------------------
  // Drag bewegen
  // -------------------------------------------------------------------------
  _onMove(clientX, clientY) {
    if (!this.isDragging) return;
    const { x, y } = this._toCanvas(clientX, clientY);
    this.x = x;
    this.y = y;
  }

  // -------------------------------------------------------------------------
  // Drop
  // -------------------------------------------------------------------------
  _onEnd(clientX, clientY) {
    if (!this.isDragging) return;
    const { x, y } = this._toCanvas(clientX, clientY);
    this._processDrop(x, y);
    this.isDragging  = false;
    this.item        = null;
    this.sourceType  = null;
    this.sourceIndex = null;
  }

  _processDrop(x, y) {
    // Auf einen Inventar-Slot gedroppt?
    const targetIndex = this.inventory.getSlotAt(x, y);

    if (targetIndex !== null && targetIndex !== this.sourceIndex) {
      const targetItem = this.inventory.items[targetIndex];
      if (targetItem) {
        // Callback: Game entscheidet was passiert (kombinieren / in Item stecken)
        this.onDropOnItem?.(this.item, targetItem);
        return;
      }
    }

    // In die Szene gedroppt (außerhalb Inventar-Leiste)?
    if (y < SLOT_Y - 10) {
      this.onDropInScene?.(this.item, x, y);
      return;
    }

    // Sonst: zurück in den Ursprungs-Slot (nichts tun)
  }

  // -------------------------------------------------------------------------
  // Callbacks — werden von Game gesetzt
  // -------------------------------------------------------------------------
  // onDropOnItem(draggedItem, targetItem)  → kombinieren / in Item stecken
  // onDropInScene(item, x, y)              → in Szene platzieren

  // -------------------------------------------------------------------------
  // Drag-Ghost zeichnen
  // -------------------------------------------------------------------------
  draw(ctx) {
    if (!this.isDragging || !this.item) return;
    ctx.save();
    ctx.globalAlpha = 0.75;
    // Leichter Schatten damit man sieht dass es "schwebt"
    ctx.shadowColor   = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur    = 8;
    ctx.shadowOffsetY = 4;
    this.inventory.drawItemAt(ctx, this.item, this.x, this.y);
    ctx.restore();
  }
}
