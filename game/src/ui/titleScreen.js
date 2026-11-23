// Clean AAA Title Screen floating over the live 3D sunset vista with 3 Save Slot cards (zero AI-slop labels).

export class TitleScreen {
  constructor(callbacks) {
    this.el = document.getElementById('title-overlay');
    this.cb = callbacks;
  }

  hide() {
    this.el.classList.add('hidden');
  }

  show(saveManager, activeSlot = 1) {
    this.el.classList.remove('hidden');
    const slots = saveManager.getAllSlots();
    const slotCards = slots.map(({ slot, data }) => `
      <div class="slot-card ${slot === activeSlot ? 'active' : ''}" data-slot="${slot}">
        <div class="slot-top">
          <span class="slot-num">SLOT 0${slot}${data ? ` · ${data.act.toUpperCase()}` : ''}</span>
          <span class="slot-pct">${data ? `${data.completion.toFixed(1)}%` : 'EMPTY'}</span>
        </div>
        <div class="slot-mission">${data ? data.missionTitle : 'Empty Slot'}</div>
        <div class="slot-meta">
          <span>${data ? `${data.districtName} · ${data.savedDate} ${data.savedAt}` : 'No saved data'}</span>
          ${data ? `<span class="slot-cash">$${data.cash.toLocaleString()}</span>` : ''}
        </div>
      </div>`).join('');

    this.el.innerHTML = `
      <div class="title-left">
        <div class="title-logo">CALA DORADA</div>
        <div class="title-sub">GOLD COAST SYNDICATE</div>
        <div class="title-tagline">
          Drift sun-drenched ocean boulevards, outrun 5-star CDPD pursuits and HALCÓN-1 air units,
          command your 3-specialist crew, and reclaim the Gold Coast from Los Caimanes.
        </div>
        <div class="title-menu">
          <button class="menu-btn primary" id="btn-continue"><span>CONTINUE</span></button>
          <button class="menu-btn" id="btn-newgame"><span>NEW GAME</span></button>
          <button class="menu-btn" id="btn-loadgame"><span>LOAD GAME</span></button>
          <button class="menu-btn" id="btn-settings"><span>SETTINGS & MAP</span></button>
        </div>
      </div>
      <div class="title-right">
        <div class="slots-heading">SAVE FILES</div>
        ${slotCards}
      </div>`;

    this.el.querySelector('#btn-continue').addEventListener('click', () => this.cb.onContinue());
    this.el.querySelector('#btn-newgame').addEventListener('click', () => this.cb.onNewGame());
    this.el.querySelector('#btn-loadgame').addEventListener('click', () => this.cb.onContinue());
    this.el.querySelector('#btn-settings').addEventListener('click', () => this.cb.onOpenCareer());
    this.el.querySelectorAll('.slot-card').forEach((card) => {
      card.addEventListener('click', () => this.cb.onSelectSlot(Number(card.dataset.slot)));
    });
  }
}
