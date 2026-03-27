// ============================================================================
// HOTSPOT SYSTEM – A Cloud for Maybel
// Liest Hotspots aus screen.objects (unified format).
// Jedes Object ist gleichzeitig Dekoration + Hotspot.
// ============================================================================

class HotspotSystem {
  constructor() {
    this.objects = [];   // aktuelle Objects des Screens
  }

  load(objectList) {
    this.objects = objectList || [];
  }

  // -------------------------------------------------------------------------
  // Condition prüfen
  // -------------------------------------------------------------------------
  _checkCondition(c, inventory, usedHotspots) {
    if (!c) return true;
    if (c.allConditions) return c.allConditions.every(sub => this._checkCondition(sub, inventory, usedHotspots));
    if (c.itemNotInInventory)  return !inventory.has(c.itemNotInInventory);
    if (c.itemInInventory)     return inventory.has(c.itemInInventory);
    if (c.allItemsInInventory) return c.allItemsInInventory.every(id => inventory.has(id));
    if (c.hotspotUsed)         return usedHotspots.has(c.hotspotUsed);
    if (c.hotspotUsedWith) {
      const actions = usedHotspots.get(c.hotspotUsedWith.id);
      return actions ? actions.has(c.hotspotUsedWith.action) : false;
    }
    if (c.hotspotNotUsed) {
      const actions = usedHotspots?.get(c.hotspotNotUsed.id);
      return actions ? !actions.has(c.hotspotNotUsed.action) : true;
    }
    // Easter Egg verschwindet nach Trigger
    if (c.eggNotSeen) return !usedHotspots.has(`__egg_seen_${c.eggNotSeen}`);
    return true;
  }

  // Sichtbare Objects (condition erfüllt)
  visibleObjects(inventory, usedHotspots) {
    return this.objects.filter(o =>
      this._checkCondition(o.condition, inventory, usedHotspots)
    );
  }

  // Klickbare Objects (condition UND clickable erfüllt)
  activeObjects(inventory, usedHotspots) {
    return this.visibleObjects(inventory, usedHotspots).filter(o => {
      // Kein clickable-Feld → immer klickbar wenn sichtbar
      if (!o.clickable) return true;
      // clickable kann auch false sein → nie klickbar
      if (o.clickable === false) return false;
      // clickable ist eine Condition
      return this._checkCondition(o.clickable, inventory, usedHotspots);
    });
  }

  // -------------------------------------------------------------------------
  // Klick + useWith
  // -------------------------------------------------------------------------
  // activeItem: das gerade selektierte Item im Inventar (oder null)
  handleClick(x, y, actionMode, inventory, usedHotspots, activeItem = null) {
    for (const obj of this.activeObjects(inventory, usedHotspots)) {
      if (!this._hit(x, y, obj)) continue;

      // useWith — aktives Item auf dieses Object anwenden
      if (activeItem && obj.actions?.useWith?.[activeItem.id] !== undefined) {
        return { object: obj, action: 'useWith', itemId: activeItem.id };
      }

      // Normaler Aktionsmodus
      return { object: obj, action: actionMode };
    }
    return null;
  }

  isOverObject(x, y, inventory, usedHotspots) {
    return this.activeObjects(inventory, usedHotspots).some(o => this._hit(x, y, o));
  }

  getLabelAt(x, y, inventory, usedHotspots) {
    for (const o of this.activeObjects(inventory, usedHotspots)) {
      if (this._hit(x, y, o)) return o.label || null;
    }
    return null;
  }

  _hit(x, y, obj) {
    return x >= obj.x && x <= obj.x + obj.w &&
           y >= obj.y && y <= obj.y + obj.h;
  }

  // Aktion-Text auflösen — unterstützt states für kontextabhängige Texte
  // actionData kann sein: string, object mit goToScene/npc/puzzle/easterEgg,
  // oder { default, states: { "itemInInventory:id": "...", ... } }
  resolveAction(actionData, inventory, usedHotspots) {
    if (!actionData || typeof actionData !== 'object') return actionData;
    if (actionData.default !== undefined) {
      // States prüfen — erste passende gewinnt
      for (const [key, text] of Object.entries(actionData.states || {})) {
        if (this._checkStateKey(key, inventory, usedHotspots)) return text;
      }
      return actionData.default;
    }
    return actionData;
  }

  _checkStateKey(key, inventory, usedHotspots) {
    // Format: "itemInInventory:id" | "itemNotInInventory:id" | "hotspotUsed:id"
    const [type, value] = key.split(':');
    if (type === 'itemInInventory')    return inventory.has(value);
    if (type === 'itemNotInInventory') return !inventory.has(value);
    if (type === 'hotspotUsed')        return usedHotspots.has(value);    
    return false;
  }

  // -------------------------------------------------------------------------
  // Label zeichnen
  // -------------------------------------------------------------------------
  drawLabel(ctx, mx, my, inventory, usedHotspots) {
    const label = this.getLabelAt(mx, my, inventory, usedHotspots);
    if (!label) return;

    ctx.save();
    ctx.font      = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    const w  = ctx.measureText(label).width + 20;
    const lx = Math.min(Math.max(mx, w / 2 + 8), CANVAS_WIDTH - w / 2 - 8);
    const ly = Math.max(my - 18, 24);

    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath();
    ctx.roundRect(lx - w / 2, ly - 16, w, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, lx, ly);
    ctx.restore();
  }
}
