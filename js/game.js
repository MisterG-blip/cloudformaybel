// ============================================================================
// GAME – A Cloud for Maybel
// ============================================================================

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.canvas.width  = CANVAS_WIDTH;
    this.canvas.height = CANVAS_HEIGHT;

    this.sceneRenderer = new SceneRenderer(this.canvas, this.ctx);
    this.hotspots      = new HotspotSystem();
    this.inventory     = new Inventory();
    this.character     = new Character();
    this.actionBar     = new ActionBar();
    this.cursor        = new CursorSystem(this.canvas);
    this.dialog        = new DialogSystem();
    this.drag          = new DragSystem(this.canvas, this.inventory);

    this.itemDefs     = {};
    this.usedHotspots = new Set();   // merkt sich welche Hotspots bereits benutzt wurden
    this.tapEffect    = null;
    this._lastTime    = 0;

    this.setupCanvasScaling();
    this.setupInput();
    this.setupDrag();
  }

  // -------------------------------------------------------------------------
  // Skalierung
  // -------------------------------------------------------------------------
  setupCanvasScaling() {
    const scale = () => {
      const container = document.getElementById('gameContainer');
      const s = Math.min(
        container.clientWidth  / CANVAS_WIDTH,
        container.clientHeight / CANVAS_HEIGHT
      );
      this.canvas.style.transform       = `scale(${s})`;
      this.canvas.style.transformOrigin = 'top left';
      this.canvas.style.marginLeft = `${(container.clientWidth  - CANVAS_WIDTH  * s) / 2}px`;
      this.canvas.style.marginTop  = `${(container.clientHeight - CANVAS_HEIGHT * s) / 2}px`;
      this._scale = s;
    };
    scale();
    window.addEventListener('resize', scale);
  }

  _toCanvas(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const s = this._scale || 1;
    return { x: (clientX - r.left) / s, y: (clientY - r.top) / s };
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------
  setupInput() {
    this.canvas.addEventListener('click', (e) => {
      if (this.drag.isDragging) return;
      const { x, y } = this._toCanvas(e.clientX, e.clientY);
      this.cursor.triggerClick();
      this._handleClick(x, y);
    });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const { x, y } = this._toCanvas(t.clientX, t.clientY);
      this.tapEffect = { x, y, alpha: 1.0 };
      this._handleClick(x, y);
    }, { passive: false });
  }

  // -------------------------------------------------------------------------
  // Drag
  // -------------------------------------------------------------------------
  setupDrag() {
    this.drag.onDropOnItem = (draggedItem, targetItem) => {
      const result = this.inventory.tryCombine(draggedItem.id, targetItem.id, this.itemDefs);
      if (result) {
        this.inventory.remove(draggedItem.id);
        this.inventory.remove(targetItem.id);
        this.inventory.add(result);
        this.dialog.show(`✨ ${draggedItem.label} + ${targetItem.label}\n→ ${result.label} entstanden!`);
        return;
      }
      if (targetItem.canContain && !targetItem.contains) {
        const ok = this.inventory.insertInto(targetItem.id, draggedItem.id);
        if (ok) {
          this.dialog.show(`${draggedItem.label} verstaut in ${targetItem.label}.`);
          return;
        }
      }
      this.dialog.show(`${draggedItem.label} und ${targetItem.label} passen nicht zusammen.`);
    };

    this.drag.onDropInScene = (item, x, y) => {
      const hit = this.hotspots.handleClick(x, y, "use", this.inventory, this.usedHotspots);
      if (hit) {
        const accepts = hit.hotspot.acceptsItem;
        if (accepts && accepts === item.id) {
          this.inventory.remove(item.id);
          this.dialog.show(`${item.label} wurde platziert. ✓`);
          hit.hotspot.condition = { itemNotInInventory: item.id };
          return;
        }
      }
      this.dialog.show(`Hier kann ich ${item.label} nicht ablegen.`);
    };
  }

  // -------------------------------------------------------------------------
  // Klick
  // -------------------------------------------------------------------------
  _handleClick(x, y) {
    if (this.dialog.handleClick()) return;
    if (this.actionBar.handleClick(x, y)) return;

    const slotIndex = this.inventory.getSlotAt(x, y);
    if (slotIndex !== null) {
      this._handleInventoryClick(slotIndex);
      return;
    }

    const hit = this.hotspots.handleClick(x, y, this.actionBar.mode, this.inventory, this.usedHotspots);
    if (hit) {
      this._handleHotspot(hit.hotspot, hit.action);
      return;
    }

    this.character.walkTo(x, y);
  }

  // -------------------------------------------------------------------------
  // Inventar-Klick
  // -------------------------------------------------------------------------
  _handleInventoryClick(slotIndex) {
    const item = this.inventory.items[slotIndex];
    if (!item) return;

    if (this.inventory.activeIndex === slotIndex) {
      this._examineItem(item);
      return;
    }
    this.inventory.setActive(slotIndex);
  }

  _examineItem(item) {
    const def = this.itemDefs[item.id];

    if (item.contains) {
      if (item.containsPuzzle) {
        this.dialog.show(
          `${item.label}: "${def?.description || ''}"\n` +
          `🔒 Verschlossen. [Puzzle: ${item.containsPuzzle}]`,
          () => {
            const found = this.inventory.openContainer(item.id, this.itemDefs);
            if (found) this.dialog.show(`Du hast ${found.label} gefunden! 🎉`);
          }
        );
      } else {
        const found = this.inventory.openContainer(item.id, this.itemDefs);
        if (found) {
          this.dialog.show(`${item.label} öffnen...\nDarin findest du: ${found.label}! 🎉`);
        }
      }
      this.inventory.clearActive();
      return;
    }

    this.dialog.show(`${item.label}\n${def?.description || 'Ein mysteriöser Gegenstand.'}`);
    this.inventory.clearActive();
  }

  // -------------------------------------------------------------------------
  // Hotspot-Aktion
  // -------------------------------------------------------------------------
  _handleHotspot(hs, action) {
    const actionData = hs.actions?.[action];

    // Hotspot als benutzt markieren (für hotspotUsed-Conditions)
    this.usedHotspots.add(hs.id);

    // Zielpunkt: walkTo aus JSON oder Fallback auf Fußpunkt (Mitte-X, untere Kante)
    const tx = hs.walkTo?.x ?? (hs.x + hs.w / 2);
    const ty = hs.walkTo?.y ?? (hs.y + hs.h);

    // goToScene – Szenen-Wechsel
    if (actionData?.goToScene) {
      this.character.walkTo(tx, ty, () => {
        this.loadScene(
          `scenes/${actionData.goToScene}.json`,
          actionData.arriveAt || null
        );
      });
      return;
    }

    // Keine Aktion definiert → witziger Kommentar
    if (!actionData) {
      this.dialog.show(this._noActionComment(action, hs.label));
      return;
    }

    this.character.walkTo(tx, ty, () => this._executeAction(hs, action, actionData));
  }

  // Witzige Kommentare für unsinnige Aktionen
  _noActionComment(action, label) {
    const comments = {
      take: [
        `${label} nehmen? Das geht nicht.`,
        `${label} passt nicht in meine Tasche.`,
        `Das nehme ich lieber nicht mit.`
      ],
      use: [
        `Mit ${label} kann ich nichts anfangen.`,
        `Das bringt mir gerade nichts.`,
        `${label} benutzen? Wie denn?`
      ],
      look: [
        `Dazu fällt mir nichts ein.`,
        `Nicht besonders interessant.`
      ]
    };
    const list = comments[action] || [`Das geht nicht.`];
    return list[Math.floor(Math.random() * list.length)];
  }

  _executeAction(hs, action, actionData) {
    if (action === 'look' || action === 'use') {
      if (typeof actionData === 'string') {
        this.dialog.show(actionData);
      }
      return;
    }
    if (action === 'take' && actionData) {
      const itemDef = this.itemDefs[actionData];

      if (!itemDef) {
        // Kein Item mit dieser ID → actionData ist ein Text-Kommentar
        this.dialog.show(actionData);
        return;
      }

      const added = this.inventory.add({ id: actionData, ...itemDef });
      if (added) {
        this.dialog.show(`${itemDef.emoji || ''} ${itemDef.label} eingesammelt!\n${itemDef.description || ''}`);
      } else {
        this.dialog.show('Das habe ich schon, oder das Inventar ist voll.');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Szene laden
  // arriveAt: optionaler {x,y} Punkt der playerStart überschreibt
  // -------------------------------------------------------------------------
  async loadScene(jsonPath, arriveAt = null) {
    await this.sceneRenderer.load(jsonPath);
    this.itemDefs = this.sceneRenderer.sceneData?.items || {};
    this._syncHotspots(arriveAt);
  }

  _syncHotspots(arriveAt = null) {
    const screen = this.sceneRenderer.currentScreen;
    this.hotspots.load(screen?.hotspots || []);

    // Szenen-Screen laden (setzt playerStart)
    this.character.loadFromScreen(screen);

    // arriveAt überschreibt playerStart wenn angegeben
    if (arriveAt) {
      this.character.x = arriveAt.x;
      this.character.y = arriveAt.y;
    }
  }

  // -------------------------------------------------------------------------
  // Game Loop
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (this.sceneRenderer.isTransitioning) {
      this.sceneRenderer.update(deltaTime);
      if (!this.sceneRenderer.isTransitioning) this._syncHotspots();
      return;
    }

    this.sceneRenderer.update(deltaTime);
    this.hotspots.update(deltaTime);
    this.character.update(deltaTime);

    const overHotspot = this.hotspots.isOverHotspot(
      this.cursor.x, this.cursor.y, this.inventory, this.usedHotspots
    );
    this.cursor.update(deltaTime, overHotspot, this.actionBar.mode);

    if (this.tapEffect) {
      this.tapEffect.alpha -= deltaTime * 0.003;
      if (this.tapEffect.alpha <= 0) this.tapEffect = null;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.sceneRenderer.draw();
    this.hotspots.drawGlow(ctx, this.inventory);
    this.character.draw(ctx);
    this.inventory.draw(ctx, this.drag);
    this.actionBar.draw(ctx);
    this.dialog.draw(ctx);
    this.hotspots.drawLabel(ctx, this.cursor.x, this.cursor.y, this.inventory, this.usedHotspots);
    this._drawTapEffect(ctx);
    this.drag.draw(ctx);

    if (DEBUG) this._drawDebug(ctx);

    this.cursor.draw(ctx);
  }

  _drawDebug(ctx) {
    ctx.save();

    // Walkarea (grün)
    this.character.drawWalkarea(ctx);

    // Hotspots (rot)
    const active = this.hotspots.activeHotspots(this.inventory, this.usedHotspots);
    const inactive = this.hotspots.hotspots.filter(hs => !active.includes(hs));

    for (const hs of active) {
      ctx.strokeStyle = 'rgba(255, 80, 80, 0.9)';
      ctx.fillStyle   = 'rgba(255, 80, 80, 0.15)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.roundRect(hs.x, hs.y, hs.w, hs.h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.font      = '10px monospace';
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(hs.id, hs.x + 3, hs.y + 12);
    }

    // Inaktive Hotspots (grau gestrichelt)
    for (const hs of inactive) {
      ctx.strokeStyle = 'rgba(180,180,180,0.5)';
      ctx.fillStyle   = 'rgba(180,180,180,0.05)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(hs.x, hs.y, hs.w, hs.h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font      = '10px monospace';
      ctx.fillStyle = 'rgba(180,180,180,0.6)';
      ctx.textAlign = 'left';
      ctx.fillText(`[${hs.id}]`, hs.x + 3, hs.y + 12);
    }

    // Maybel-Position (blauer Punkt)
    ctx.fillStyle = 'rgba(80, 160, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(this.character.x, this.character.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font      = '10px monospace';
    ctx.fillStyle = 'rgba(80,160,255,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(
      `x:${Math.round(this.character.x)} y:${Math.round(this.character.y)}`,
      this.character.x + 8, this.character.y - 6
    );

    // Items in Inventar (gelb, oben links)
    ctx.font      = '11px monospace';
    ctx.fillStyle = 'rgba(255,220,80,0.9)';
    ctx.textAlign = 'left';
    const itemList = this.inventory.items.map(i => i.id).join(', ') || '—';
    ctx.fillText(`items: ${itemList}`, 8, 16);
    const usedList = [...this.usedHotspots].join(', ') || '—';
    ctx.fillText(`used:  ${usedList}`, 8, 30);

    // DEBUG-Label oben rechts
    ctx.font      = 'bold 11px monospace';
    ctx.fillStyle = 'rgba(255,80,80,0.8)';
    ctx.textAlign = 'right';
    ctx.fillText('DEBUG', CANVAS_WIDTH - 8, 16);

    ctx.restore();
  }

  _drawTapEffect(ctx) {
    if (!this.tapEffect) return;
    ctx.save();
    ctx.globalAlpha = this.tapEffect.alpha;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(this.tapEffect.x, this.tapEffect.y, 18 * (1 - this.tapEffect.alpha * 0.5), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  gameLoop(timestamp) {
    const delta = Math.min(timestamp - this._lastTime, 100);
    this._lastTime = timestamp;
    this.update(delta);
    this.draw();
    requestAnimationFrame(t => this.gameLoop(t));
  }

  async start() {
    await this.loadScene('scenes/street_act1.json');
    console.log('☁️ A Cloud for Maybel gestartet');
    this.gameLoop(0);
  }
}
