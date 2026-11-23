// Pure clean GTA Title Screen: bold CALA DORADA logo + 4 crisp buttons (CONTINUE, NEW GAME, LOAD, SETTINGS)
// floating cleanly over the live sunset city panorama — ZERO marketing blurb, ZERO badges/tags, ZERO clutter.

export class TitleScreen {
  constructor(callbacks) {
    this.el = document.getElementById('title-overlay');
    this.cb = callbacks;
    this.showLoadDrawer = false;
  }

  hide() {
    this.el.classList.add('hidden');
    this.showLoadDrawer = false;
  }

  show(saveManager, activeSlot = 1) {
    this.el.classList.remove('hidden');
    this._render(saveManager, activeSlot);
  }

  _render(saveManager, activeSlot) {
    const slots = saveManager.getAllSlots();
    const drawerHtml = this.showLoadDrawer
      ? `<div class="title-load-drawer">
          ${slots.map(({ slot, data }) => `
            <div class="slot-card ${slot === activeSlot ? 'active' : ''}" data-slot="${slot}">
              <div class="slot-top">
                <span class="slot-num">SLOT 0${slot}</span>
                <span class="slot-pct">${data ? `${data.completion.toFixed(1)}%` : 'EMPTY'}</span>
              </div>
              <div class="slot-mission">${data ? data.missionTitle : 'Empty Slot'}</div>
              <div class="slot-meta">
                <span>${data ? `${data.districtName}` : 'Start new save'}</span>
                ${data ? `<span class="slot-cash">$${data.cash.toLocaleString()}</span>` : ''}
              </div>
            </div>`).join('')}
        </div>`
      : '';

    this.el.innerHTML = `
      <div class="title-left">
        <div class="title-logo">CALA<br>DORADA</div>
        <div class="title-menu">
          <button class="menu-btn primary" id="btn-continue"><span>CONTINUE</span></button>
          <button class="menu-btn" id="btn-newgame"><span>NEW GAME</span></button>
          <button class="menu-btn" id="btn-loadgame"><span>LOAD</span></button>
          <button class="menu-btn" id="btn-settings"><span>SETTINGS</span></button>
        </div>
      </div>
      ${drawerHtml}`;

    this.el.querySelector('#btn-continue').addEventListener('click', () => this.cb.onContinue());
    this.el.querySelector('#btn-newgame').addEventListener('click', () => this.cb.onNewGame());
    this.el.querySelector('#btn-loadgame').addEventListener('click', () => {
      this.showLoadDrawer = !this.showLoadDrawer;
      this._render(saveManager, activeSlot);
    });
    this.el.querySelector('#btn-settings').addEventListener('click', () => {
      if (this.cb.onOpenSettings) this.cb.onOpenSettings();
    });
    this.el.querySelectorAll('.slot-card').forEach((card) => {
      card.addEventListener('click', () => this.cb.onSelectSlot(Number(card.dataset.slot)));
    });
  }
}
