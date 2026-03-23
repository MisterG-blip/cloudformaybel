// ============================================================================
// SZENE: STRASSE – AKT 1 – A Cloud for Maybel
// ============================================================================
// Gibt Hotspot-Definitionen zurück und zeichnet den Hintergrund.
// ============================================================================

const SCENE_STREET = {

  // ------------------------------------------------------------------
  // HINTERGRUND zeichnen
  // ------------------------------------------------------------------
  drawBackground(ctx) {

    // Himmel (hellblau → weiß)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 380);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#dff0fa');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, 380);

    // Wolken (weiße Blob-Formen)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    this._drawCloud(ctx, 120, 80,  70, 30);
    this._drawCloud(ctx, 430, 55,  90, 35);
    this._drawCloud(ctx, 680, 95,  60, 25);

    // Eine besonders schöne Wolke – Maybels Traumwolke 🌟
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    this._drawCloud(ctx, 310, 35, 110, 45);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.fillText('✨', 310, 28);

    // Boden (Bürgersteig + Straße)
    ctx.fillStyle = '#bbb';                   // Bürgersteig
    ctx.fillRect(0, 380, CANVAS_WIDTH, 40);
    ctx.fillStyle = '#888';                   // Straße
    ctx.fillRect(0, 420, CANVAS_WIDTH, 180);
    // Mittelstreifen
    ctx.fillStyle = '#ffcc00';
    for (let x = 0; x < CANVAS_WIDTH; x += 80) {
      ctx.fillRect(x, 495, 50, 8);
    }

    // Häuser-Silhouetten im Hintergrund
    ctx.fillStyle = '#c8a882';
    ctx.fillRect(0,   240, 130, 140);
    ctx.fillRect(160, 260, 110, 120);
    ctx.fillRect(560, 230, 140, 150);
    ctx.fillRect(700, 250, 100, 130);
    // Dächer
    ctx.fillStyle = '#a0705a';
    this._drawRoof(ctx,   0, 240, 130);
    this._drawRoof(ctx, 160, 260, 110);
    this._drawRoof(ctx, 560, 230, 140);
    this._drawRoof(ctx, 700, 250, 100);

    // Fenster in Häusern
    ctx.fillStyle = 'rgba(200,230,255,0.7)';
    ctx.fillRect(30,  280, 30, 25);
    ctx.fillRect(80,  280, 30, 25);
    ctx.fillRect(185, 295, 25, 20);
    ctx.fillRect(220, 295, 25, 20);
    ctx.fillRect(585, 270, 28, 22);
    ctx.fillRect(630, 270, 28, 22);
    ctx.fillRect(720, 285, 25, 20);

    // Objekte auf dem Bürgersteig als Emojis
    ctx.font = '42px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🪔', 200, 382);   // Laterne
    ctx.fillText('🪑', 370, 378);   // Bank
    ctx.fillText('🗑️', 560, 380);   // Mülleimer
    ctx.fillText('🌳', 680, 368);   // Baum
    ctx.fillText('🚪', 80,  382);   // Haustür (kommt vom Haus links)

    // Maybel (Platzhalter)
    ctx.font = '38px serif';
    ctx.fillText('🧒', 400, 377);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#555';
    ctx.fillText('Maybel', 400, 395);

    // Kleiner Hinweis-Text oben
    ctx.font      = '13px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.textAlign = 'left';
    ctx.fillText('Akt 1 · Die Straße', 14, 20);
  },

  // Hilfsfunktion: eine Wolke aus Ellipsen
  _drawCloud(ctx, cx, cy, w, h) {
    ctx.beginPath();
    ctx.ellipse(cx,        cy,      w * 0.5, h * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - w*0.3, cy + h*0.1, w * 0.35, h * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + w*0.3, cy + h*0.1, w * 0.35, h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Hilfsfunktion: ein Satteldach
  _drawRoof(ctx, x, y, w) {
    ctx.beginPath();
    ctx.moveTo(x - 8,     y);
    ctx.lineTo(x + w/2,   y - 40);
    ctx.lineTo(x + w + 8, y);
    ctx.closePath();
    ctx.fill();
  },

  // ------------------------------------------------------------------
  // HOTSPOTS definieren
  // ------------------------------------------------------------------
  // Jeder Hotspot hat: id, x, y, w, h, visible, onClick (wird von Game befüllt)
  // ------------------------------------------------------------------
  getHotspots(game) {
    return [

      {
        id: 'laterne',
        x: 172, y: 330, w: 60, h: 70,
        visible: true,
        onClick() {
          if (game.inventory.has('windessenz')) {
            game.showDialog('Die Laterne flackert schon – du hast schon alles hier geholt.');
            return;
          }
          const added = game.inventory.add({ id: 'windessenz', emoji: '💨', label: 'Windessenz' });
          if (added) {
            game.showDialog('Du hältst die Hand an die Laterne.\nEin warmer Windhauch streicht hindurch.\n→ Windessenz eingesammelt!');
            game.checkPuzzle();
          }
        }
      },

      {
        id: 'bank',
        x: 335, y: 338, w: 80, h: 55,
        visible: true,
        onClick() {
          if (game.inventory.has('feder')) {
            game.showDialog('Die Bank ist leer. Die Feder hast du schon.');
            return;
          }
          const added = game.inventory.add({ id: 'feder', emoji: '🪶', label: 'Feder' });
          if (added) {
            game.showDialog('Auf der Bank liegt eine einzelne Feder.\nSie ist federleicht und silbrig.\n→ Feder eingesammelt!');
            game.checkPuzzle();
          }
        }
      },

      {
        id: 'muelleimer',
        x: 530, y: 330, w: 60, h: 65,
        visible: true,
        onClick() {
          game.showDialog('Ein alter Mülleimer.\nDu schaust hinein – nur Papier und\nein verbeulter Eimer. Nichts Nützliches.');
        }
      },

      {
        id: 'baum',
        x: 650, y: 310, w: 80, h: 90,
        visible: true,
        onClick() {
          game.showDialog('Ein großer Kastanienbaum.\nDu blickst nach oben –\ndie Äste reichen fast bis zu den Wolken. 🌳');
        }
      },

      {
        id: 'tuer',
        x: 52, y: 330, w: 60, h: 60,
        visible: false,   // erst sichtbar wenn Rätsel gelöst
        onClick() {
          game.showDialog('Die Tür ist jetzt offen!\n„Komm rein", ruft jemand. 🚪\n\n→ [Szene wechseln – kommt im nächsten Schritt]');
        }
      }

    ];
  }
};
