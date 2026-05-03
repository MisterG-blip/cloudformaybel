// ============================================================================
// NPC SYSTEM – A Cloud for Maybel
// Verwaltet NPC-Dialoge (linear + verzweigt) und Item-Tausch.
// NPCs werden pro Szene in der JSON definiert.
// ============================================================================

class NpcSystem {
  constructor() {
    this.active   = false;
    this.npc      = null;    // aktueller NPC aus JSON
    this.node     = null;    // aktueller Dialog-Knoten
    this.choices  = [];      // aktuelle Auswahloptionen
    this.onClose  = null;    // Callback wenn Dialog endet
  }

  // -------------------------------------------------------------------------
  // Dialog starten
  // npcDef: NPC-Definition aus der JSON
  // inventory + itemDefs: für Tausch-Bedingungen
  // -------------------------------------------------------------------------
  start(npcDef, inventory, itemDefs, onClose = null) {
    this.active  = true;
    this.npc     = npcDef;
    this.onClose = onClose;

    // Einstiegs-Knoten bestimmen (kann je nach Inventar variieren)
    const entryId = this._getEntryNode(npcDef, inventory);
    this._goToNode(entryId, inventory, itemDefs);
  }

  // -------------------------------------------------------------------------
  // Dialog starten wenn Spieler aktives Item auf NPC wirft (giveEntries)
  // Gibt true zurück wenn giveEntries behandelt wurde, sonst false
  // -------------------------------------------------------------------------
  startWithItem(npcDef, itemId, inventory, itemDefs, onClose = null) {
    const entries = npcDef.giveEntries;
    if (!entries) return false;

    // Spezifischen Eintrag suchen, dann Fallback '*'
    const nodeId = entries[itemId] ?? entries['*'] ?? null;
    if (!nodeId) return false;

    this.active  = true;
    this.npc     = npcDef;
    this.onClose = onClose;
    this._goToNode(nodeId, inventory, itemDefs);
    return true;
  }

  close() {
    this.active  = false;
    this.npc     = null;
    this.node    = null;
    this.choices = [];
    if (this.onClose) { const cb = this.onClose; this.onClose = null; cb(); }
  }

  // -------------------------------------------------------------------------
  // Einstiegs-Knoten ermitteln
  // NPCs können je nach Akt oder Inventar unterschiedlich starten
  // -------------------------------------------------------------------------
  _getEntryNode(npcDef, inventory) {
    if (!npcDef.entry) return 'start';

    // Bedingte Einstiege prüfen (erste passende gewinnt)
    if (Array.isArray(npcDef.entry)) {
      for (const e of npcDef.entry) {
        if (!e.condition) return e.node;
        if (this._checkCondition(e.condition, inventory)) return e.node;
      }
    }
    return npcDef.entry;
  }

  // -------------------------------------------------------------------------
  // Zu einem Dialog-Knoten navigieren
  // -------------------------------------------------------------------------
  _goToNode(nodeId, inventory, itemDefs) {
    const nodes = this.npc.dialog;
    const node  = nodes[nodeId];
    if (!node) { this.close(); return; }

    this.node = { ...node, id: nodeId };

    // Tausch auf Knoten-Ebene sofort ausführen (z.B. "tausch"-Knoten bei giveEntries)
    if (node.trade) {
      const { give, receive } = node.trade;
      if (give && inventory.has(give)) inventory.remove(give);
      if (receive) {
        const itemDef = itemDefs[receive];
        if (itemDef) inventory.add({ id: receive, ...itemDef });
      }
    }

    // Auswahloptionen filtern (Bedingungen prüfen)
    this.choices = (node.choices || []).filter(c =>
      !c.condition || this._checkCondition(c.condition, inventory)
    );

    // Merken für handleClick
    this._inventory = inventory;
    this._itemDefs  = itemDefs;
  }

  // -------------------------------------------------------------------------
  // Klick verarbeiten
  // -------------------------------------------------------------------------
  handleClick(x, y, inventory, itemDefs) {
    if (!this.active || !this.node) return false;

    // Immer aktuell halten
    this._inventory = inventory;
    this._itemDefs  = itemDefs;

    // Auswahl geklickt?
    const layout = this._layout();
    for (let i = 0; i < this.choices.length; i++) {
      const btn = layout.choices[i];
      if (btn && x >= btn.x && x <= btn.x + btn.w &&
                 y >= btn.y && y <= btn.y + btn.h) {
        this._selectChoice(i, inventory, itemDefs);
        return true;
      }
    }

    // Kein Auswahlmenü → weiterklicken
    if (this.choices.length === 0) {
      const next = this.node.next;
      if (next) {
        this._goToNode(next, inventory, itemDefs);
      } else {
        this.close();
      }
      return true;
    }

    return true;
  }

  _selectChoice(index, inventory, itemDefs) {
    const choice = this.choices[index];
    if (!choice) return;

    // Tausch ausführen
    if (choice.trade) {
      const { give, receive } = choice.trade;
      if (inventory.has(give)) {
        inventory.remove(give);
        const itemDef = itemDefs[receive];
        if (itemDef) inventory.add({ id: receive, ...itemDef });
      }
    }

    // Nächsten Knoten laden
    if (choice.next) {
      this._goToNode(choice.next, inventory, itemDefs);
    } else {
      this.close();
    }
  }

  // -------------------------------------------------------------------------
  // Bedingung prüfen (gleiche Logik wie HotspotSystem)
  // -------------------------------------------------------------------------
  _checkCondition(c, inventory) {
    if (!c) return true;
    if (c.itemInInventory)     return inventory.has(c.itemInInventory);
    if (c.itemNotInInventory)  return !inventory.has(c.itemNotInInventory);
    if (c.allItemsInInventory) return c.allItemsInInventory.every(id => inventory.has(id));
    return true;
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  draw(ctx) {
    if (!this.active || !this.node) return;

    const layout = this._layout();

    ctx.save();

    // Hintergrund-Box
    ctx.fillStyle   = 'rgba(10,10,30,0.88)';
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(layout.box.x, layout.box.y, layout.box.w, layout.box.h, 12);
    ctx.fill();
    ctx.stroke();

    // NPC-Name
    if (this.npc.name) {
      ctx.font      = 'bold 14px sans-serif';
      ctx.fillStyle = '#ffe080';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(this.npc.name, layout.box.x + 16, layout.box.y + 14);
    }

    // NPC-Text (mehrzeilig)
    const lines = (this.node.text || '').split('\n');
    ctx.font      = '15px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const textY = layout.box.y + (this.npc.name ? 36 : 16);
    lines.forEach((line, i) => {
      ctx.fillText(line, layout.box.x + 16, textY + i * 22);
    });

    // Auswahloptionen oder Weiter-Hinweis
    if (this.choices.length > 0) {
      for (let i = 0; i < this.choices.length; i++) {
        const btn = layout.choices[i];
        const c   = this.choices[i];

        ctx.fillStyle   = 'rgba(255,255,255,0.1)';
        ctx.strokeStyle = 'rgba(255,220,80,0.6)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 6);
        ctx.fill();
        ctx.stroke();

        ctx.font      = '13px sans-serif';
        ctx.fillStyle = '#ffe080';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`▸ ${c.text}`, btn.x + 10, btn.y + btn.h / 2);
      }
    } else {
      ctx.font      = '11px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('[ klicken ]',
        layout.box.x + layout.box.w - 12,
        layout.box.y + layout.box.h - 10
      );
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------
  _layout() {
    const choiceCount = this.choices.length;
    const baseH  = 110;
    const extraH = choiceCount * 36;
    const bh     = baseH + extraH;
    const bx     = 60;
    const by     = CANVAS_HEIGHT - bh - 20;
    const bw     = CANVAS_WIDTH - 120;

    const choices = this.choices.map((_, i) => ({
      x: bx + 10,
      y: by + baseH - 10 + i * 36,
      w: bw - 20,
      h: 30
    }));

    return { box: { x: bx, y: by, w: bw, h: bh }, choices };
  }
}
