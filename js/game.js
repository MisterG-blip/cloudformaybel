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
    this.puzzle        = new PuzzleSystem();
    this.npc           = new NpcSystem();
    this.logbook       = new Logbook();
    this.saveSystem    = new SaveSystem();

    this.itemDefs     = {};
    this.usedHotspots = new Map();
    this.tapEffect    = null;
    this._lastTime    = 0;

    // Easter-Egg-Effekt-State
    this.easterEffect = null;

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
        this.logbook.logItem({ label: result.label }, 'combined');
        this.dialog.show(`✨ ${draggedItem.label} + ${targetItem.label}\n→ ${result.label} entstanden!`);
        return;
      }
      if (targetItem.canContain && !targetItem.contains) {
        const ok = this.inventory.insertInto(targetItem.id, draggedItem.id);
        if (ok) { this.dialog.show(`${draggedItem.label} verstaut in ${targetItem.label}.`); return; }
      }
      this.dialog.show(`${draggedItem.label} und ${targetItem.label} passen nicht zusammen.`);
    };

    this.drag.onDropInScene = (item, x, y) => {
      const hit = this.hotspots.handleClick(x, y, 'use', this.inventory, this.usedHotspots, item);
      if (hit?.action === 'useWith') {
        this._executeUseWith(hit.object, item);
      } else {
        this.dialog.show(`Hier kann ich ${item.label} nicht ablegen.`);
      }
    };
  }

  // -------------------------------------------------------------------------
  // Klick
  // -------------------------------------------------------------------------
  _handleClick(x, y) {
    if (this.puzzle.active)   { this.puzzle.handleClick(x, y); return; }
    if (this.npc.active)      { this.npc.handleClick(x, y, this.inventory, this.itemDefs); return; }
    if (this.logbook.visible) { this.logbook.handleClick(x, y); return; }
    if (this.logbook.iconHit(x, y)) { this.logbook.toggle(); return; }
    if (this.dialog.handleClick()) return;
    if (this.actionBar.handleClick(x, y)) return;

    // Easter-Egg-Effekt wegklicken
    if (this.easterEffect) { this.easterEffect = null; return; }

    const slotIndex = this.inventory.getSlotAt(x, y);
    if (slotIndex !== null) { this._handleInventoryClick(slotIndex); return; }

    const activeItem = this.inventory.activeItem;
    const hit = this.hotspots.handleClick(
      x, y, this.actionBar.mode, this.inventory, this.usedHotspots, activeItem
    );
    if (hit) {
      if (activeItem) this.inventory.clearActive();
      this._handleObject(hit.object, hit.action, hit.itemId);
      return;
    }

    // Aktives Item wegklicken wenn man daneben klickt
    if (activeItem) { this.inventory.clearActive(); return; }

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
    this.inventory.clearActive();

    if (item.contains) {
      if (def?.unlockedBy && this.inventory.has(def.unlockedBy)) {
        this.inventory.remove(def.unlockedBy);
        const found = this.inventory.openContainer(item.id, this.itemDefs);
        if (found) {
          this.logbook.logItem({ label: found.label }, 'found');
          this.dialog.show(`🔑 Schlüssel passt!\n${item.label} öffnet sich...\nDu findest: ${found.label}! 🎉`);
        }
        return;
      }
      if (def?.unlockedBy && !def?.containsPuzzle) {
        this.dialog.show(`${item.label} ist verschlossen.\nIch brauche den richtigen Schlüssel.`);
        return;
      }
      if (def?.containsPuzzle) {
        const puzzleConfig = typeof def.containsPuzzle === 'object'
          ? def.containsPuzzle
          : { type: def.containsPuzzle, digits: 4, solution: [0,0,0,0] };
        const hint = def?.unlockedBy
          ? `${item.label} ist verschlossen.\nKein Schlüssel dabei — Rätsel lösen?`
          : `${item.label} hat ein Zahlenschloss.\n${puzzleConfig.hint || ''}`;
        this.dialog.show(hint, () => {
          this.puzzle.start(puzzleConfig, () => {
            const found = this.inventory.openContainer(item.id, this.itemDefs);
            if (found) {
              this.logbook.logItem({ label: found.label }, 'found');
              this.dialog.show(`✨ Richtig!\n${item.label} öffnet sich...\nDu findest: ${found.label}! 🎉`);
            }
          });
        });
        return;
      }
      const found = this.inventory.openContainer(item.id, this.itemDefs);
      if (found) {
        this.logbook.logItem({ label: found.label }, 'found');
        this.dialog.show(`${item.label} öffnen...\nDarin findest du: ${found.label}! 🎉`);
      }
      return;
    }

    this.dialog.show(`${item.label}\n${def?.description || 'Ein mysteriöser Gegenstand.'}`);
  }

  // -------------------------------------------------------------------------
  // Object-Aktion (ersetzt _handleHotspot)
  // -------------------------------------------------------------------------
  _handleObject(obj, action, itemId = null) {
    // Als benutzt markieren
    if (!this.usedHotspots.has(obj.id)) this.usedHotspots.set(obj.id, new Set());
    this.usedHotspots.get(obj.id).add(action);

    const tx = obj.walkTo?.x ?? (obj.x + obj.w / 2);
    const ty = obj.walkTo?.y ?? (obj.y + obj.h);

    // useWith — Item auf Object anwenden
    if (action === 'useWith' && itemId) {
      this.character.walkTo(tx, ty, () => this._executeUseWith(obj, this.inventory.get(itemId)));
      return;
    }

    // Action-Text mit states auflösen
    const rawAction = obj.actions?.[action];
    const actionData = this.hotspots.resolveAction(rawAction, this.inventory, this.usedHotspots);

    // goToScene
    if (actionData?.goToScene) {
      this.character.walkTo(tx, ty, () => {
        this.loadScene(`scenes/${actionData.goToScene}.json`, actionData.arriveAt || null);
      });
      return;
    }

    // NPC
    if (actionData?.npc) {
      const npcDef = this.sceneRenderer.sceneData?.npcs?.[actionData.npc];
      if (npcDef) {
        this.character.walkTo(tx, ty, () => {
          this.npc.start(npcDef, this.inventory, this.itemDefs);
        });
      }
      return;
    }

    // Kein Eintrag
    if (!actionData) {
      this.dialog.show(this._noActionComment(action, obj.label));
      return;
    }

    this.character.walkTo(tx, ty, () => this._executeAction(obj, action, actionData));
  }

  // -------------------------------------------------------------------------
  // useWith — aktives Item auf Object anwenden
  // -------------------------------------------------------------------------
  _executeUseWith(obj, item) {
    if (!item) return;
    const result = obj.actions?.useWith?.[item.id];

    if (result === undefined || result === null) {
      this.dialog.show(`${item.label} passt hier nicht.`);
      return;
    }

    // String → Dialog
    if (typeof result === 'string') {
      this.dialog.show(result);
      // Item verbraucht?
      if (obj.actions?.useWithConsumes?.[item.id]) {
        this.inventory.remove(item.id);
        this.logbook.logItem({ label: item.label }, 'used');
      }
      return;
    }

    // Objekt → komplexe Aktion
    if (result.dialog) this.dialog.show(result.dialog);
    if (result.removeItem) {
      this.inventory.remove(item.id);
      this.logbook.logItem({ label: item.label }, 'used');
    }
    if (result.giveItem) {
      const def = this.itemDefs[result.giveItem];
      if (def) {
        this.inventory.add({ id: result.giveItem, ...def });
        this.logbook.logItem({ label: def.label }, 'found');
      }
    }
    if (result.puzzle) {
      this.puzzle.start(result.puzzle, (r) => {
        if (result.puzzle.onSolveDialog) this.dialog.show(result.puzzle.onSolveDialog);
      });
    }
  }

  // -------------------------------------------------------------------------
  // Aktion ausführen
  // -------------------------------------------------------------------------
  _executeAction(obj, action, actionData) {
    // Puzzle direkt starten
    if (actionData?.puzzle) {
      this.puzzle.start(actionData.puzzle, (result) => {
        if (actionData.puzzle.onSolveDialog) this.dialog.show(actionData.puzzle.onSolveDialog);
      });
      return;
    }

    // Easter-Egg-Effekt
    if (actionData?.easterEgg) {
      this._triggerEasterEgg(actionData.easterEgg, obj);
      return;
    }

    if (action === 'look' || action === 'use') {
      // Nochmal auflösen falls states vorhanden
      const resolved = this.hotspots.resolveAction(actionData, this.inventory, this.usedHotspots);
      if (typeof resolved === 'string') this.dialog.show(resolved);
      return;
    }

    if (action === 'take' && actionData) {
      const itemDef = this.itemDefs[actionData];
      if (!itemDef) { this.dialog.show(actionData); return; }
      const added = this.inventory.add({ id: actionData, ...itemDef });
      if (added) {
        this.logbook.logItem({ label: itemDef.label }, 'found');
        this.dialog.show(`${itemDef.emoji || ''} ${itemDef.label} eingesammelt!\n${itemDef.description || ''}`);
        // disappearsAfter: 'take' → Object aus usedHotspots entfernen reicht nicht,
        // wir markieren es als "collected" damit condition greift
        // (condition: { itemNotInInventory: "..." } erledigt das automatisch)
      } else {
        this.dialog.show('Das habe ich schon, oder das Inventar ist voll.');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Easter-Egg-Effekte
  // -------------------------------------------------------------------------
  _triggerEasterEgg(type, obj) {
    this.easterEffect = { type, timer: 3000, obj };

    const dialogs = {
      galaxy:     'Eine kleine Galaxie dehnt sich aus... und zieht sich wieder zusammen.\n„Vielleicht gehört das einfach woanders hin."',
      homunkulus: 'Ein Schemen erscheint kurz... und löst sich auf.\n„Kein echtes Leben… nur eine Idee davon."',
      sulphorium: 'Alles leuchtet kurz auf.\n„Vielleicht braucht Materie keine Seele von mir.\nSie hat schon eine."'
    };

    setTimeout(() => {
      this.dialog.show(dialogs[type] || 'Etwas Merkwürdiges passiert...');
      this.easterEffect = null;

      // Easter Egg als "gesehen" markieren — löst disappearsAfterEasterEgg aus
      // Das Object bekommt automatisch condition: itemNotInInventory: id_seen
      // Wir setzen einen internen Flag indem wir ein Pseudo-Item ins usedHotspots eintragen
      if (obj?.id) {
        const key = `__egg_seen_${obj.id}`;
        if (!this.usedHotspots.has(key)) this.usedHotspots.set(key, new Set());
        this.usedHotspots.get(key).add('use');
        this.logbook.logCustom('🥚', `Easter Egg entdeckt.`);
      }
    }, 1500);
  }

  // -------------------------------------------------------------------------
  // Kommentare
  // -------------------------------------------------------------------------
  _noActionComment(action, label) {
    const comments = {
      take: [`${label} nehmen? Das geht nicht.`, `${label} passt nicht in meine Tasche.`],
      use:  [`Mit ${label} kann ich nichts anfangen.`, `${label} benutzen? Wie denn?`],
      look: [`Dazu fällt mir nichts ein.`, `Nicht besonders interessant.`]
    };
    const list = comments[action] || ['Das geht nicht.'];
    return list[Math.floor(Math.random() * list.length)];
  }

  // -------------------------------------------------------------------------
  // Szene laden
  // -------------------------------------------------------------------------
  async loadItems() {
    try {
      const res = await fetch('scenes/items.json');
      this.itemDefs = await res.json();
      console.log(`✅ ${Object.keys(this.itemDefs).length} Items geladen`);
    } catch(e) {
      console.warn('⚠️ items.json nicht gefunden');
    }
  }

  async loadScene(jsonPath, arriveAt = null) {
    await this.sceneRenderer.load(jsonPath);
    const sceneItems = this.sceneRenderer.sceneData?.items || {};
    this.itemDefs = { ...this.itemDefs, ...sceneItems };
    this._syncObjects(arriveAt);
    const sceneName = this.sceneRenderer.sceneData?.name || jsonPath;
    this.logbook?.logScene(sceneName);
    this.saveSystem?.save(this);
  }

  _syncObjects(arriveAt = null) {
    const screen = this.sceneRenderer.currentScreen;
    this.hotspots.load(screen?.objects || []);
    this.character.loadFromScreen(screen);
    if (arriveAt) { this.character.x = arriveAt.x; this.character.y = arriveAt.y; }
  }

  // -------------------------------------------------------------------------
  // Game Loop
  // -------------------------------------------------------------------------
  update(deltaTime) {
    if (this.sceneRenderer.isTransitioning) {
      this.sceneRenderer.update(deltaTime);
      if (!this.sceneRenderer.isTransitioning) this._syncObjects();
      return;
    }
    this.sceneRenderer.update(deltaTime);
    this.character.update(deltaTime);
    this.puzzle.update(deltaTime);

    const overObject = this.hotspots.isOverObject(
      this.cursor.x, this.cursor.y, this.inventory, this.usedHotspots
    );
    this.cursor.update(deltaTime, overObject, this.actionBar.mode);

    if (this.tapEffect) {
      this.tapEffect.alpha -= deltaTime * 0.003;
      if (this.tapEffect.alpha <= 0) this.tapEffect = null;
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Szene (Layer + Objects) mit Condition-Prüfung
    this.sceneRenderer.draw(this.inventory, this.usedHotspots);

    // Easter-Egg-Effekt
    if (this.easterEffect) this._drawEasterEffect(ctx);

    this.character.draw(ctx);
    this.inventory.draw(ctx, this.drag);
    this.actionBar.draw(ctx);
    this.dialog.draw(ctx);
    this.hotspots.drawLabel(ctx, this.cursor.x, this.cursor.y, this.inventory, this.usedHotspots);
    this._drawTapEffect(ctx);
    this.drag.draw(ctx);
    this.puzzle.draw(ctx);
    this.npc.draw(ctx);
    this.logbook.drawIcon(ctx);
    this.logbook.draw(ctx);

    if (DEBUG) this._drawDebug(ctx);

    this.cursor.draw(ctx);
  }

  // -------------------------------------------------------------------------
  // Easter-Egg Visuals
  // -------------------------------------------------------------------------
  _drawEasterEffect(ctx) {
    const e = this.easterEffect;
    if (!e) return;
    const t = 1 - e.timer / 3000;
    ctx.save();

    if (e.type === 'galaxy') {
      ctx.globalAlpha = Math.sin(t * Math.PI);
      const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 200 * t);
      grad.addColorStop(0,   'rgba(200,150,255,0.9)');
      grad.addColorStop(0.5, 'rgba(100,50,200,0.5)');
      grad.addColorStop(1,   'rgba(0,0,30,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // Sterne
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 2 + t * 3;
        const r     = 20 + i * 4 * t;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (e.type === 'sulphorium') {
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.4;
      ctx.fillStyle   = '#ffffaa';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Debug
  // -------------------------------------------------------------------------
  _drawDebug(ctx) {
    ctx.save();

    // Walkarea
    this.character.drawWalkarea(ctx);

    // Objects — aktiv (rot) / inaktiv (grau)
    const active   = this.hotspots.activeObjects(this.inventory, this.usedHotspots);
    const inactive = this.hotspots.objects.filter(o => !active.includes(o));

    for (const obj of active) {
      ctx.strokeStyle = 'rgba(255,80,80,0.9)';
      ctx.fillStyle   = 'rgba(255,80,80,0.12)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 4);
      ctx.fill(); ctx.stroke();
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(obj.id, obj.x + 3, obj.y + 12);
    }
    for (const obj of inactive) {
      ctx.strokeStyle = 'rgba(180,180,180,0.4)';
      ctx.fillStyle   = 'rgba(180,180,180,0.05)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 4);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(180,180,180,0.5)';
      ctx.textAlign = 'left';
      ctx.fillText(`[${obj.id}]`, obj.x + 3, obj.y + 12);
    }

    // Maybel-Position
    ctx.fillStyle = 'rgba(80,160,255,0.9)';
    ctx.beginPath();
    ctx.arc(this.character.x, this.character.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(80,160,255,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(`x:${Math.round(this.character.x)} y:${Math.round(this.character.y)}`,
      this.character.x + 8, this.character.y - 6);

    // Status oben links
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(255,220,80,0.9)';
    ctx.textAlign = 'left';
    const itemList = this.inventory.items.map(i => i.id).join(', ') || '—';
    ctx.fillText(`items: ${itemList}`, 8, 16);
    const usedList = this.usedHotspots.size > 0
      ? [...this.usedHotspots.entries()]
          .map(([id, a]) => `${id}(${[...a].join(',')})`)
          .join(' ')
      : '—';
    ctx.fillText(`used: ${usedList}`, 8, 30);
    const active2 = this.inventory.activeItem;
    if (active2) { ctx.fillStyle = 'rgba(255,220,80,1)'; ctx.fillText(`active: ${active2.id}`, 8, 44); }

    ctx.font = 'bold 11px monospace';
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
    await this.loadItems();
    const loaded = await this.saveSystem.applyTo(this, this.itemDefs);
    if (!loaded) await this.loadScene('scenes/street_act1.json');

    if (DEBUG && DEBUG_START_PUZZLE) this._startDebugPuzzle(DEBUG_START_PUZZLE);

    console.log('☁️ A Cloud for Maybel gestartet');
    this.gameLoop(0);
  }

  _startDebugPuzzle(puzzleId) {
    const puzzles = {
      'cloud_shoot_1':   { type: 'cloud_shoot', round: 1 },
      'cloud_shoot_2':   { type: 'cloud_shoot', round: 2 },
      'combination_lock':{ type: 'combination_lock', digits: 4, solution: [1,2,3,4], hint: 'Debug' }
    };
    const cfg = puzzles[puzzleId];
    if (cfg) this.puzzle.start(cfg, r => console.log('Debug puzzle solved:', r));
  }
}
