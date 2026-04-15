// ============================================================================
// SAVE SYSTEM – A Cloud for Maybel
// Speichert und lädt Spielfortschritt via localStorage.
// ============================================================================

const SAVE_KEY = 'maybel_save_v1';

class SaveSystem {
  // Aktuellen Spielstand speichern
  save(game) {
    try {
      const data = {
        scene:         game.sceneRenderer.sceneData?.id || 'street_act1',
        playerX:       game.character.x,
        playerY:       game.character.y,
        inventory:     game.inventory.items.map(i => i.id),
        usedHotspots:  this._serializeMap(game.usedHotspots),
        consumedItems: [...game.consumedItems],
        logbook:       game.logbook.toJSON(),
        timestamp:     Date.now()
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch(e) {
      console.warn('Speichern fehlgeschlagen:', e);
      return false;
    }
  }

  // Spielstand laden — gibt Daten zurück oder null
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      return null;
    }
  }

  // Spielstand löschen
  delete() {
    localStorage.removeItem(SAVE_KEY);
  }

  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  // Map<string, Set<string>> → serialisierbares Objekt
  _serializeMap(map) {
    const obj = {};
    for (const [k, v] of map) obj[k] = [...v];
    return obj;
  }

  // Objekt → Map<string, Set<string>>
  _deserializeMap(obj) {
    const map = new Map();
    for (const [k, v] of Object.entries(obj || {})) map.set(k, new Set(v));
    return map;
  }

  // Spielstand in ein laufendes Game-Objekt einlesen
  async applyTo(game, itemDefs) {
    const data = this.load();
    if (!data) return false;

    // Szene laden
    await game.loadScene(`scenes/${data.scene}.json`, {
      x: data.playerX,
      y: data.playerY
    });

    // Inventar wiederherstellen
    for (const id of data.inventory || []) {
      const def = itemDefs[id];
      if (def) game.inventory.add({ id, ...def });
    }

    // Benutzte Hotspots wiederherstellen
    game.usedHotspots = this._deserializeMap(data.usedHotspots);

    // Verbrauchte Items wiederherstellen
    game.consumedItems = new Set(data.consumedItems || []);

    // Logbuch wiederherstellen
    game.logbook.fromJSON(data.logbook);

    return true;
  }
}
