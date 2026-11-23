// Sweeping Sunset Title Screen floating over the live 3D city vista with Save Slot cards.

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
          <span class="slot-num">SAVE SLOT 0${slot} ${data ? `· ${data.act.toUpperCase()}` : ''}</span>
          <span class="slot-pct">${data ? `${data.completion.toFixed(1)}% COMPLETE` : 'NEW RUN'}</span>
        </div>
        <div class="slot-mission">${data ? data.missionTitle : 'Empty Syndicate Slot'}</div>
        <div class="slot-meta">
          <span>${data ? `${data.districtName} · Saved ${data.savedDate} ${data.savedAt}` : 'Start Dante Varo\'s Gold Coast takeover'}</span>
          <span class="slot-cash" style="${data ? '' : 'color:#34e0c8'}">${data ? `$${data.cash.toLocaleString()}` : 'START FRESH'}</span>
        </div>
      </div>`).join('');

    this.el.innerHTML = `
      <div class="title-left">
        <div class="title-eyebrow">OPEN-WORLD 3D CRIME SANDBOX · 7 DISTRICTS</div>
        <div class="title-logo">CALA DORADA</div>
        <div class="title-sub">GOLD COAST SYNDICATE</div>
        <div class="title-tagline">
          Drift sun-drenched ocean boulevards, outrun 5-star CDPD pursuits and HALCÓN-1 air units,
          command your 3-specialist crew, and reclaim the Gold Coast from Los Caimanes.
        </div>
        <div class="title-menu">
          <button class="menu-btn primary" id="btn-continue"><span>CONTINUE</span><span>SLOT 01 →</span></button>
          <button class="menu-btn" id="btn-newgame"><span>NEW GAME</span><span>ACT I</span></button>
          <button class="menu-btn" id="btn-loadgame"><span>LOAD GAME</span><span>3 SLOTS</span></button>
          <button class="menu-btn" id="btn-settings"><span>SETTINGS & MAP</span><span>DOSSIER</span></button>
        </div>
      </div>
      <div class="title-right">
        <div class="slots-heading"><span>SYNDICATE SAVE FILES</span><span>CLICK TO LOAD</span></div>
        ${slotCards}
      </div>
      <div class="title-footer-bar">
        <span>[WASD] DRIVE / MOVE · [SPACE] DRIFT · [SHIFT] NITRO · [F] CAR · [1-6] WEAPONS · [Z/X/C] CREW · [R] RADIO · [M/ESC] MAP</span>
        <span>LOCAL OFFLINE BUILD · THREE.JS</span>
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
