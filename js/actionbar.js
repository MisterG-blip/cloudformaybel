// ============================================================================
// ACTION BAR – A Cloud for Maybel
// Drei Modi: look / take / use. Horizontal links vom Inventar.
// ============================================================================

const ACTIONS = [
  { id: 'look', icon: '👁',  label: 'Ansehen' },
  { id: 'take', icon: '✋',  label: 'Nehmen'  },
  { id: 'use',  icon: '⚙️',  label: 'Benutzen'}
];

const BAR_BTN_SIZE = 54;
const BAR_GAP      = 6;
const BAR_Y        = SLOT_Y;
const BAR_X        = SLOT_START_X - (3 * BAR_BTN_SIZE + 2 * BAR_GAP) - 16;

class ActionBar {
  constructor() {
    this.mode = 'look';
  }

  handleClick(x, y) {
    for (let i = 0; i < ACTIONS.length; i++) {
      const bx = BAR_X + i * (BAR_BTN_SIZE + BAR_GAP);
      if (x >= bx && x <= bx + BAR_BTN_SIZE &&
          y >= BAR_Y && y <= BAR_Y + BAR_BTN_SIZE) {
        this.mode = ACTIONS[i].id;
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    ctx.save();

    const totalW = 3 * BAR_BTN_SIZE + 2 * BAR_GAP;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.roundRect(BAR_X - 10, BAR_Y - 8, totalW + 20, BAR_BTN_SIZE + 16, 10);
    ctx.fill();

    for (let i = 0; i < ACTIONS.length; i++) {
      const a      = ACTIONS[i];
      const bx     = BAR_X + i * (BAR_BTN_SIZE + BAR_GAP);
      const active = a.id === this.mode;

      ctx.fillStyle   = active ? 'rgba(255,220,80,0.85)' : 'rgba(255,255,255,0.05)';
      ctx.strokeStyle = active ? '#fff' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth   = active ? 2 : 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, BAR_Y, BAR_BTN_SIZE, BAR_BTN_SIZE, 6);
      ctx.fill();
      ctx.stroke();

      ctx.font         = '24px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = active ? '#000' : '#fff';
      ctx.fillText(a.icon, bx + BAR_BTN_SIZE / 2, BAR_Y + BAR_BTN_SIZE / 2 - 4);

      ctx.font         = '10px sans-serif';
      ctx.fillStyle    = active ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(a.label, bx + BAR_BTN_SIZE / 2, BAR_Y + BAR_BTN_SIZE - 5);
    }

    ctx.restore();
  }
}
