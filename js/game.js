// ============================================================================
// GAME – A Cloud for Maybel
// ============================================================================

class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.itemDefs = null;
    this.inventory = null;
    this.drag = null;
    
    this.sceneRenderer = new SceneRenderer(this.canvas, this.ctx);
    this.hotspots = new HotspotSystem();
    this.character = new Character();
    this.actionBar = new ActionBar();
    this.cursor = new CursorSystem(this.canvas);
    this.dialog = new DialogSystem();
    this.puzzle = new PuzzleSystem();
    this.npc = new NpcSystem();
    this.logbook = new Logbook();
    this.saveSystem = new SaveSystem();

    this.setupCanvasScaling(); // 🔥 HIER ist es stabil
        
    this.usedHotspots = new Map();
    this.consumedItems = new Set();    
  }
  
  // -------------------------------------------------------------------------
  // Skalierung
  // -------------------------------------------------------------------------
  setupCanvasScaling() {
    const scale = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s  = Math.min(vw / CANVAS_WIDTH, vh / CANVAS_HEIGHT);

      // Canvas immer auf interne Auflösung setzen
      this.canvas.width  = CANVAS_WIDTH;
      this.canvas.height = CANVAS_HEIGHT;

      // Canvas skalieren und im Viewport zentrieren
      this.canvas.style.transform       = `scale(${s})`;
      this.canvas.style.transformOrigin = 'top left';
      this.canvas.style.position        = 'absolute';
      this.canvas.style.left = `${(vw - CANVAS_WIDTH  * s) / 2}px`;
      this.canvas.style.top  = `${(vh - CANVAS_HEIGHT * s) / 2}px`;

      this._scale = s;
    };
    scale();
    window.addEventListener('resize', scale);
    window.addEventListener('orientationchange', () => setTimeout(scale, 150));
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
      console.log("DROP:", draggedItem.id, "→", targetItem.id);

      const targetDef = this.itemDefs[targetItem.id];
      console.log("TARGET DEF:", targetDef);

      // Prüfen ob Ziel Slots hat
      if (targetDef?.slots && targetDef?.machinePart) {
        const result = this.inventory.insertInto(targetItem.id, draggedItem.id);

        console.log("INSERT RESULT:", result);

        if (result) {
          this.dialog.show(`${draggedItem.label} wurde in ${targetItem.label} eingesetzt.`);

          // 🔥 Prüfen ob Maschine fertig ist
          this._checkMachineComplete(targetItem.id, targetDef);
          return;
        }
      this.dialog.show(`${draggedItem.label} passt nicht.`);
      return;
      }
      //Püfen ob Item Combine-fähig.
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
      const hit = this.hotspots.handleClick(x, y, 'use', this.inventory, this.usedHotspots, this.consumedItems, item);
      if (!hit) { this.dialog.show(`Hier kann ich ${item.label} nicht ablegen.`); return; }

      // Item auf NPC gedroppt → giveEntries
      if (hit.object.type === 'npc') {
        const npcId  = hit.object.id.replace('_obj', '');
        const npcDef = this.sceneRenderer.sceneData?.npcs?.[npcId];
        if (npcDef) {
          const tx = hit.object.x + (hit.object.hotspot?.w ?? 0) / 2;
          const ty = hit.object.y + (hit.object.hotspot?.h ?? 0) / 2;
          this.character.walkTo(tx, ty, () => {
            const handled = this.npc.startWithItem(npcDef, item.id, this.inventory, this.itemDefs);
            if (!handled) this.dialog.show(`${npcDef.name || 'NPC'} weiß damit nichts anzufangen.`);
          });
          return;
        }
      }

      // useWith auf normalem Objekt
      if (hit.action === 'useWith') {
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
      x, y, this.actionBar.mode, this.inventory, this.usedHotspots, this.consumedItems, activeItem
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

    // Easter Egg: easterEgg-Feld in items.json → Effekt auslösen, Item sofort entfernen
    if (def?.easterEgg) {
      this.inventory.remove(item.id);
      this.logbook.logCustom('🥚', `${item.label} — Easter Egg entdeckt.`);
      // easterEgg kann String (legacy) oder { effect, src } sein
      const eggConfig = typeof def.easterEgg === 'object'
        ? def.easterEgg
        : { effect: def.easterEgg, src: null };
      this._triggerEasterEgg(eggConfig, item);
      return;
    }

    if (item.contains) {
      // canContain-Container (Eimer, Behälter): Inhalt rausnehmen, Hülle bleibt erhalten
      if (item.canContain) {
        const innerDef   = this.itemDefs[item.contains];
        const innerLabel = innerDef?.label || item.contains;
        this.dialog.show(
          `Im ${item.label} liegt: ${innerLabel}.\nHerausnehmen?`,
          () => {
            const innerId = this.inventory.extractFrom(item.id);
            if (innerId) {
              const def2 = this.itemDefs[innerId];
              if (def2) {
                this.inventory.add({ id: innerId, ...def2 });
                this.logbook.logItem({ label: def2.label }, 'found');
              }
            }
          }
        );
        return;
      }

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

    // NPCs haben kein w/h auf Object-Ebene → hotspot.w/h als Fallback, sonst 0
    const objW = obj.w ?? obj.hotspot?.w ?? 0;
    const objH = obj.h ?? obj.hotspot?.h ?? 0;
    const tx = obj.walkTo?.x ?? (obj.x + objW / 2);
    const ty = obj.walkTo?.y ?? (obj.y + objH / 2);

    // useWith — Item auf Object anwenden
    if (action === 'useWith' && itemId) {
      this.character.walkTo(tx, ty, () => this._executeUseWith(obj, this.inventory.get(itemId)));
      return;
    }

    // Action-Text mit states auflösen
    const rawAction = obj.actions?.[action];
    const actionData = this.hotspots.resolveAction(rawAction, this.inventory, this.usedHotspots);
    console.log("OBJECT CLICK DEBUG:", {
      obj,
      action,
      rawAction,
      actionData
    });

    // goToScene
    if (actionData?.goToScene) {
      this.character.walkTo(tx, ty, () => {
        this.loadScene(`scenes/${actionData.goToScene}.json`, actionData.arriveAt || null);
      });
      return;
    }

    // NPC-Object direkt angeklickt (type: 'npc')
    if (obj.type === 'npc') {
      const sceneDef = this.sceneRenderer.sceneData;
      // NPC-ID: entweder actionData.npc oder obj.id (ohne "_obj"-Suffix)
      const npcId  = actionData?.npc || obj.id.replace('_obj', '');
      const npcDef = sceneDef?.npcs?.[npcId];
      if (npcDef) {
        this.character.walkTo(tx, ty, () => {
          // Aktives Item vorhanden → giveEntries zuerst probieren
          const activeItem = this.inventory.activeItem;
          if (activeItem) {
            const handled = this.npc.startWithItem(npcDef, activeItem.id, this.inventory, this.itemDefs);
            if (handled) { this.inventory.clearActive(); return; }
          }
          this.npc.start(npcDef, this.inventory, this.itemDefs);
        });
      } else {
        this.dialog.show(this._noActionComment(action, obj.label));
      }
      return;
    }

    // NPC via actions.use: { npc: "id" }
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
  // Prüfen ob Maschine vollständig zusammen gesetzt
  // -------------------------------------------------------------------------
  _checkMachineComplete(machineId, machineDef) {
    const machineItem = this.inventory.get(machineId);

    if (!machineItem || !machineDef.slots) return;

    const isComplete = machineDef.slots.every(slot => {
      return slot.item !== null;
    });

    if (!isComplete) return;

    // 🔥 ALLES RICHTIG → Maschine aktiviert
    this.dialog.show("✨ Maschine vollständig aufgebaut!");

    if (machineDef.onComplete?.startMinigame) {
     this.puzzle.start(
        machineDef.onComplete.startMinigame,
        () => {
          if (machineDef.onComplete?.nextAct) {
            this.dialog.show("🚀 Act abgeschlossen!");
            // Hier könntest du Act wechseln / Szene laden erstmal dazu auffordern, dass das Item an seinen Platz gestellt wird.
          }
        }
      );
    }
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

    // Maschine mit Slots? → erst prüfen ob vollständig bestückt
    if (result.consume || result.removeItem) {
      const itemDef = this.itemDefs[item.id];
      if (itemDef?.slots) {
        const missing = itemDef.slots
          .filter(slot => !slot.item)
          .map(slot => {
            const partDef = this.itemDefs[slot.expectedItem];
            return partDef?.label || slot.expectedItem;
          });
        if (missing.length > 0) {
          this.dialog.show(`Die ${item.label} ist noch nicht fertig.\nEs fehlt noch: ${missing.join(', ')}.`);
          return;
        }
      }
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

    // consume: true → dauerhaft verbraucht (kann nicht mehr eingesammelt werden)
    if (result.consume) {
      this.inventory.remove(item.id);
      this.consumedItems.add(item.id);
      this.logbook.logCustom('🔧', `${item.label} verbaut.`);
    }
    
    if (result.giveItem) {
      const def = this.itemDefs[result.giveItem];
      if (def) {
        this.inventory.add({ id: result.giveItem, ...def });
        this.consumedItems.add(result.giveItem);       
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
        // Item als "eingesammelt" markieren — Hotspot verschwindet dauerhaft
        this.consumedItems.add(actionData);
        this.logbook.logItem({ label: itemDef.label }, 'found');
        this.dialog.show(`${itemDef.emoji || ''} ${itemDef.label} eingesammelt!\n${itemDef.description || ''}`);
      } else {
        this.dialog.show('Das habe ich schon, oder das Inventar ist voll.');
      }
    }
  }

  // -------------------------------------------------------------------------
  // Easter-Egg-Effekte
  // -------------------------------------------------------------------------
  _triggerEasterEgg(config, item) {
    // config = { effect: 'galaxy', src: null } oder legacy string
    const effect = typeof config === 'string' ? config : config.effect;
    const gifSrc = typeof config === 'object' ? config.src : null;

    const dialogs = {
      galaxy:     'Eine kleine Galaxie dehnt sich aus...\nund zieht sich wieder zusammen.\n„Vielleicht gehört das einfach woanders hin."',
      quasar:     'Ein Quasar leuchtet auf — unvorstellbare Energie\nin einem winzigen Punkt.\n„Manche Dinge sind einfach zu groß für mich."',
      homunkulus: 'Ein Schemen erscheint kurz... und löst sich auf.\n„Kein echtes Leben… nur eine Idee davon."',
      sulphorium: 'Alles leuchtet kurz auf.\n„Vielleicht braucht Materie keine Seele von mir.\nSie hat schon eine."'
    };

    const duration = 2500; // 2.5 Sekunden Animation, dann Dialog

    // GIF vorladen wenn vorhanden
    let gifImg = null;
    if (gifSrc) {
      gifImg = new Image();
      gifImg.src = gifSrc;
    }

    this.easterEffect = {
      effect,
      gifImg,
      startTime: performance.now(),
      duration,
      t: 0  // Fortschritt 0→1
    };

    setTimeout(() => {
      // 🔥 HIER: Item endgültig entfernen
      if (item?.id) {
        this.consumedItems.add(item.id);
        this.inventory.remove(item.id);
        this.logbook.logItem({ label: item.label }, 'used');
      }
      this.easterEffect = null;
      this.dialog.show(dialogs[effect] || 'Etwas Merkwürdiges passiert...');
    }, duration);
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
      this.cursor.x, this.cursor.y, this.inventory, this.usedHotspots, this.consumedItems
    );
    const isDragging = this.drag.isDragging;
    const isOverDropTarget = isDragging && this.hotspots.isOverObject(
      this.cursor.x, this.cursor.y, this.inventory, this.usedHotspots, this.consumedItems
    );
    this.cursor.update(deltaTime, overObject, this.actionBar.mode, isDragging, isOverDropTarget);

    if (this.tapEffect) {
      this.tapEffect.alpha -= deltaTime * 0.003;
      if (this.tapEffect.alpha <= 0) this.tapEffect = null;
    }

    // Easter-Egg-Fortschritt
    if (this.easterEffect) {
      const elapsed = performance.now() - this.easterEffect.startTime;
      this.easterEffect.t = Math.min(1, elapsed / this.easterEffect.duration);
    }
  }

  draw(deltaTime = 0) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Szene (Layer + Objects) mit Condition-Prüfung
    this.sceneRenderer.draw(this.inventory, this.usedHotspots, this.consumedItems, deltaTime);

    // Easter-Egg-Effekt
    if (this.easterEffect) this._drawEasterEffect(ctx);

    this.character.draw(ctx);
    this.inventory.draw(ctx, this.drag);
    this.actionBar.draw(ctx);
    this.dialog.draw(ctx);
    this.hotspots.drawLabel(ctx, this.cursor.x, this.cursor.y, this.inventory, this.usedHotspots, this.consumedItems);
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

    const t   = e.t;                          // 0 → 1
    const cx  = CANVAS_WIDTH  / 2;
    const cy  = CANVAS_HEIGHT / 2;
    const fade = Math.sin(t * Math.PI);       // Ein/Ausblenden: 0→1→0

    ctx.save();

    // GIF vorhanden und geladen → anzeigen statt Canvas-Animation
    if (e.gifImg && e.gifImg.complete && e.gifImg.naturalWidth > 0) {
      ctx.globalAlpha = fade;
      ctx.drawImage(e.gifImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
      return;
    }

    // Canvas-Platzhalter-Animationen
    // Schwarzer Hintergrund der einfadet
    ctx.globalAlpha = fade * 0.92;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.globalAlpha = fade;

    if (e.effect === 'galaxy') {
      this._drawGalaxy(ctx, cx, cy, t);
    } else if (e.effect === 'quasar') {
      this._drawQuasar(ctx, cx, cy, t);
    } else if (e.effect === 'homunkulus') {
      this._drawHomunkulus(ctx, cx, cy, t);
    } else if (e.effect === 'sulphorium') {
      this._drawSulphorium(ctx, cx, cy, t);
    }

    ctx.restore();
  }

  _drawGalaxy(ctx, cx, cy, t) {
    const now = performance.now() * 0.001;
    // Spiralgalaxie aus Sternen
    const arms = 3;
    const starCount = 120;
    for (let i = 0; i < starCount; i++) {
      const arm     = i % arms;
      const along   = (i / starCount);
      const angle   = (arm / arms) * Math.PI * 2
                    + along * Math.PI * 4          // Spirale
                    + now * (0.3 + along * 0.2);   // Rotation
      const radius  = along * 220 * t;
      const scatter = (Math.sin(i * 137.5) * 0.5 + 0.5) * 18;
      const x = cx + Math.cos(angle) * radius + Math.cos(i * 2.3) * scatter;
      const y = cy + Math.sin(angle) * radius * 0.45 + Math.sin(i * 1.7) * scatter * 0.5;
      const size    = (1 - along * 0.6) * 2.5;
      const bright  = 0.4 + along * 0.6;

      ctx.globalAlpha = bright * Math.sin(t * Math.PI);
      ctx.fillStyle   = `hsl(${260 + along * 80}, 80%, ${60 + along * 30}%)`;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Galaktisches Zentrum
    ctx.globalAlpha = Math.sin(t * Math.PI);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40 * t);
    core.addColorStop(0,   'rgba(255,240,200,1)');
    core.addColorStop(0.3, 'rgba(200,150,255,0.6)');
    core.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 40 * t, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawQuasar(ctx, cx, cy, t) {
    const now = performance.now() * 0.001;

    // Jet oben und unten
    for (const dir of [-1, 1]) {
      const jetH = 280 * t;
      const grad = ctx.createLinearGradient(cx, cy, cx, cy + dir * jetH);
      grad.addColorStop(0,   'rgba(150,220,255,0.9)');
      grad.addColorStop(0.5, 'rgba(80,150,255,0.4)');
      grad.addColorStop(1,   'rgba(0,50,150,0)');
      ctx.fillStyle = grad;
      ctx.globalAlpha = Math.sin(t * Math.PI) * 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx - 12 * t, cy + dir * jetH);
      ctx.lineTo(cx + 12 * t, cy + dir * jetH);
      ctx.closePath();
      ctx.fill();
    }

    // Akkretionsscheibe
    ctx.globalAlpha = Math.sin(t * Math.PI);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, 0.25);
    const disc = ctx.createRadialGradient(0, 0, 5, 0, 0, 80 * t);
    disc.addColorStop(0,   'rgba(255,200,50,0.9)');
    disc.addColorStop(0.5, 'rgba(255,100,0,0.5)');
    disc.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(0, 0, 80 * t, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Schwarzes Loch Kern
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * t, 0, Math.PI * 2);
    ctx.fill();

    // Lichtring
    ctx.strokeStyle = 'rgba(255,220,100,0.8)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * t, 0, Math.PI * 2);
    ctx.stroke();

    // Partikel
    for (let i = 0; i < 30; i++) {
      const angle  = (i / 30) * Math.PI * 2 + now * 2;
      const r      = 90 * t + Math.sin(i * 7 + now * 3) * 20;
      ctx.globalAlpha = 0.6 * Math.sin(t * Math.PI);
      ctx.fillStyle   = `hsl(${40 + i * 5}, 100%, 70%)`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * 0.25, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawHomunkulus(ctx, cx, cy, t) {
    // Schemen — verschwommene menschliche Silhouette
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.7;
    const grad = ctx.createRadialGradient(cx, cy - 20, 5, cx, cy, 80);
    grad.addColorStop(0,   'rgba(180,220,180,0.8)');
    grad.addColorStop(0.6, 'rgba(100,180,100,0.3)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, 80 * t, 0, Math.PI * 2);
    ctx.fill();

    // Kopf
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.5;
    ctx.fillStyle   = 'rgba(150,220,150,0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy - 50 * t, 20 * t, 0, Math.PI * 2);
    ctx.fill();

    // Körper
    ctx.fillRect(cx - 10 * t, cy - 30 * t, 20 * t, 60 * t);
  }

  _drawSulphorium(ctx, cx, cy, t) {
    const now = performance.now() * 0.001;

    // Aufleuchten aller Objekte — weißes Overlay
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.35;
    ctx.fillStyle   = '#ffffcc';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Kristall-Strahlen
    ctx.globalAlpha = Math.sin(t * Math.PI) * 0.7;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + now;
      const len   = (100 + i * 20) * t;
      const grad  = ctx.createLinearGradient(cx, cy, cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      grad.addColorStop(0,   'rgba(255,255,150,0.8)');
      grad.addColorStop(1,   'rgba(255,255,150,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 3 - i * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
      ctx.stroke();
    }

    // Kern-Glitzer
    ctx.globalAlpha = Math.sin(t * Math.PI);
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 * t);
    core.addColorStop(0,   'rgba(255,255,255,1)');
    core.addColorStop(0.5, 'rgba(200,255,200,0.5)');
    core.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(cx, cy, 30 * t, 0, Math.PI * 2);
    ctx.fill();
  }

  // -------------------------------------------------------------------------
  // Debug
  // -------------------------------------------------------------------------
  _drawDebug(ctx) {
    ctx.save();

    // Walkarea
    this.character.drawWalkarea(ctx);

    // Objects — aktiv (rot) / inaktiv (grau)
    const active   = this.hotspots.activeObjects(this.inventory, this.usedHotspots, this.consumedItems);
    const inactive = this.hotspots.objects.filter(o => !active.includes(o));

    const _debugBox = (obj) => {
      if (obj.type === 'npc') {
        const hs = obj.hotspot || {};
        const hw = hs.w ?? 80;
        const hh = hs.h ?? 160;
        return { x: (obj.x || 0) - hw / 2, y: (obj.y || 0) - hh, w: hw, h: hh };
      }
      return { x: obj.x, y: obj.y, w: obj.w ?? 100, h: obj.h ?? 100 };
    };

    for (const obj of active) {
      const b = _debugBox(obj);
      ctx.strokeStyle = 'rgba(255,80,80,0.9)';
      ctx.fillStyle   = 'rgba(255,80,80,0.12)';
      ctx.lineWidth   = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill(); ctx.stroke();
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(obj.id, b.x + 3, b.y + 12);
    }
    for (const obj of inactive) {
      const b = _debugBox(obj);
      ctx.strokeStyle = 'rgba(180,180,180,0.4)';
      ctx.fillStyle   = 'rgba(180,180,180,0.05)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(180,180,180,0.5)';
      ctx.textAlign = 'left';
      ctx.fillText(`[${obj.id}]`, b.x + 3, b.y + 12);
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

    //cosumed Items
    const consumedList = this.consumedItems && this.consumedItems.size > 0
    ? [...this.consumedItems].join(', ')
    : '—';

    ctx.fillStyle = 'rgba(255,120,80,0.9)';
    ctx.fillText(`consumed: ${consumedList}`, 8, 58);
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
    this.draw(delta);
    requestAnimationFrame(t => this.gameLoop(t));
  }

  async start() {
    console.log("🚀 START WIRD AUFGERUFEN");
    await this.loadItems();

    this.inventory = new Inventory(this.itemDefs);
    this.drag = new DragSystem(this.canvas, this.inventory);

    this.setupInput();
    this.setupDrag();    

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
