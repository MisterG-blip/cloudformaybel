// ============================================================================
// LOGBUCH – A Cloud for Maybel
// Automatisches Tagebuch. Wird befüllt durch:
//   - Items einsammeln / verlieren
//   - NPC-Dialoge
//   - Minigames abschließen
//   - Wichtige Hotspots (flagged mit "log": true in JSON)
// ============================================================================

const LOG_MAX_ENTRIES = 100;

class Logbook {
  constructor() {
    this.entries = [];   // [{ time, icon, text }]
    this.visible = false;
    this.scrollY = 0;    // Scroll-Position
  }

  // -------------------------------------------------------------------------
  // Eintrag hinzufügen
  // -------------------------------------------------------------------------
  add(icon, text) {
    this.entries.unshift({  // neueste oben
      time: this._timestamp(),
      icon,
      text
    });
    if (this.entries.length > LOG_MAX_ENTRIES) {
      this.entries.pop();
    }
  }

  // Shortcuts für häufige Ereignisse
  logItem(item, action = 'found') {
    const icons   = { found: '📥', lost: '📤', used: '🔧', combined: '✨' };
    const texts   = {
      found:    `${item.label} eingesammelt.`,
      lost:     `${item.label} weggegeben.`,
      used:     `${item.label} benutzt.`,
      combined: `${item.label} entstanden.`
    };
    this.add(icons[action] || '•', texts[action] || `${item.label}`);
  }

  logNpc(npcName, text) {
    this.add('💬', `${npcName}: „${text.substring(0, 60)}${text.length > 60 ? '…' : ''}"`);
  }

  logPuzzle(puzzleName, success) {
    this.add(success ? '✅' : '❌', success
      ? `${puzzleName} gelöst.`
      : `${puzzleName} fehlgeschlagen.`
    );
  }

  logScene(sceneName) {
    this.add('📍', `Betritt: ${sceneName}`);
  }

  logCustom(icon, text) {
    this.add(icon, text);
  }

  // -------------------------------------------------------------------------
  // Toggle Sichtbarkeit
  // -------------------------------------------------------------------------
  toggle() { this.visible = !this.visible; this.scrollY = 0; }
  open()   { this.visible = true;  this.scrollY = 0; }
  close()  { this.visible = false; }

  // -------------------------------------------------------------------------
  // Klick verarbeiten (Schließen-Button + Scroll)
  // -------------------------------------------------------------------------
  handleClick(x, y) {
    if (!this.visible) return false;

    // Schließen-Button
    if (x >= CANVAS_WIDTH - 60 && x <= CANVAS_WIDTH - 20 &&
        y >= 20 && y <= 60) {
      this.close();
      return true;
    }

    // Scroll-Buttons
    if (x >= CANVAS_WIDTH - 55 && x <= CANVAS_WIDTH - 25) {
      if (y >= 80 && y <= 110)  { this.scrollY = Math.max(0, this.scrollY - 60); return true; }
      if (y >= 500 && y <= 530) { this.scrollY += 60; return true; }
    }

    return true; // alle Klicks konsumieren wenn offen
  }

  // -------------------------------------------------------------------------
  // Zeichnen
  // -------------------------------------------------------------------------
  draw(ctx) {
    if (!this.visible) return;

    const bx = 50, by = 20, bw = CANVAS_WIDTH - 100, bh = CANVAS_HEIGHT - 40;

    ctx.save();

    // Hintergrund
    ctx.fillStyle   = 'rgba(15,10,25,0.95)';
    ctx.strokeStyle = 'rgba(255,220,80,0.4)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 14);
    ctx.fill();
    ctx.stroke();

    // Titel
    ctx.font      = 'bold 18px sans-serif';
    ctx.fillStyle = '#ffe080';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('📓 Maybels Tagebuch', bx + bw / 2, by + 16);

    // Trennlinie
    ctx.strokeStyle = 'rgba(255,220,80,0.2)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(bx + 20, by + 46);
    ctx.lineTo(bx + bw - 20, by + 46);
    ctx.stroke();

    // Schließen-Button
    ctx.font      = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'right';
    ctx.fillText('✕', bx + bw - 16, by + 16);

    // Einträge
    const entryH  = 52;
    const listY   = by + 56;
    const listH   = bh - 70;
    const maxScroll = Math.max(0, this.entries.length * entryH - listH);
    this.scrollY    = Math.min(this.scrollY, maxScroll);

    ctx.save();
    ctx.beginPath();
    ctx.rect(bx + 10, listY, bw - 20, listH);
    ctx.clip();

    this.entries.forEach((entry, i) => {
      const ey = listY + i * entryH - this.scrollY;
      if (ey + entryH < listY || ey > listY + listH) return;

      // Zebrastreifen
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(bx + 10, ey, bw - 20, entryH - 2);
      }

      // Icon
      ctx.font         = '20px serif';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = '#fff';
      ctx.fillText(entry.icon, bx + 18, ey + entryH / 2);

      // Text
      ctx.font      = '13px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(entry.text, bx + 46, ey + entryH / 2 - 8);

      // Timestamp
      ctx.font      = '10px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(entry.time, bx + 46, ey + entryH / 2 + 10);
    });

    if (this.entries.length === 0) {
      ctx.font      = '14px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.textAlign = 'center';
      ctx.fillText('Noch keine Einträge.', bx + bw / 2, listY + listH / 2);
    }

    ctx.restore();

    // Scroll-Indikatoren
    if (this.scrollY > 0) {
      ctx.font      = '14px sans-serif';
      ctx.fillStyle = 'rgba(255,220,80,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText('▲', bx + bw - 38, listY + 14);
    }
    if (this.scrollY < maxScroll) {
      ctx.fillText('▼', bx + bw - 38, listY + listH - 6);
    }

    ctx.restore();
  }

  // Logbuch-Icon (kleines Buch oben rechts im Canvas)
  drawIcon(ctx) {
    const ix = CANVAS_WIDTH - 44, iy = 8;
    ctx.save();
    ctx.fillStyle   = this.visible ? 'rgba(255,220,80,0.9)' : 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = 'rgba(255,220,80,0.6)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.roundRect(ix, iy, 36, 36, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font         = '20px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = this.visible ? '#000' : '#fff';
    ctx.fillText('📓', ix + 18, iy + 18);
    ctx.restore();
  }

  iconHit(x, y) {
    const ix = CANVAS_WIDTH - 44, iy = 8;
    return x >= ix && x <= ix + 36 && y >= iy && y <= iy + 36;
  }

  // -------------------------------------------------------------------------
  // Serialisierung für Speichersystem
  // -------------------------------------------------------------------------
  toJSON()       { return this.entries; }
  fromJSON(data) { this.entries = data || []; }

  _timestamp() {
    const n = new Date();
    return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
  }
}
