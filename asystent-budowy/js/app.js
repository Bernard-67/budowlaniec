/* =============================================================
   Asystent Budowy Domu — silnik prototypu
   Maszyna stanów kroków + renderowanie czatu, widgetów, briefu.
   Bez żadnych wywołań API — cała "inteligencja" siedzi w data.js.
   ============================================================= */

/* ---------------- Stan globalny ---------------- */
let state = null;

function freshState() {
  const checklist = {};
  CHECKLIST_ITEMS.forEach(i => (checklist[i.key] = false));
  return {
    stage: null,
    stepIndex: 0,
    answers: {},
    checklist,
    progress: null,     // klucz aktywnego węzła paska postępu
    progressDone: [],    // klucze ukończonych węzłów
    history: [],
    kosztorys: null,
    kosztorysSuma: 0,
    kosztorysEdited: false,
  };
}

/* ---------------- Skróty DOM ---------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const chatWindow = () => $('#chat-window');

/* =============================================================
   START
   ============================================================= */
function initStart() {
  const wrap = $('#stage-cards');
  wrap.innerHTML = '';
  STAGE_CARDS.forEach(card => {
    const el = document.createElement('div');
    el.className = 'stage-card';
    el.innerHTML = `
      <div class="sc-icon">${card.icon}</div>
      <div class="sc-title">${card.title}</div>
      <div class="sc-sub">${card.subtitle}</div>
      <ul class="sc-scope">${card.scope.map(s => `<li>${s}</li>`).join('')}</ul>
      <div class="sc-note">${card.note}</div>
      <button class="sc-cta">Zacznij tutaj →</button>`;
    el.addEventListener('click', () => enterDashboard(card.id));
    wrap.appendChild(el);
  });
}

/* =============================================================
   WEJŚCIE DO DASHBOARDU
   ============================================================= */
function enterDashboard(stageId) {
  state = freshState();
  state.stage = stageId;

  $('#screen-start').classList.add('hidden');
  $('#screen-dashboard').classList.remove('hidden');
  $('#stage-badge').textContent = STAGES[stageId].label;

  renderChecklist();
  renderProgress();
  resetSideCards();
  chatWindow().innerHTML = '';

  state.stepIndex = 0;
  runStep();
}

/* =============================================================
   MASZYNA STANÓW KROKÓW
   ============================================================= */
function runStep() {
  const steps = STAGES[state.stage].steps;
  if (state.stepIndex >= steps.length) return;
  const step = steps[state.stepIndex];

  switch (step.type) {
    case 'text':      return renderText(step);
    case 'choice':    return renderChoice(step);
    case 'mpzp':      return renderMpzpWidget(step);
    case 'upload':    return renderUploadWidget(step);
    case 'kosztorys': return renderKosztorysWidget(step);
    case 'oferty':    return renderOffersWidget(step);
    case 'brief':     return renderBrief(step);
  }
}

/* Przejście do kolejnego kroku + zastosowanie efektów bieżącego */
function advance(step) {
  applyEffects(step);
  state.stepIndex++;
  runStep();
}

function applyEffects(step) {
  if (!step.effects) return;
  (step.effects.checklist || []).forEach(key => {
    if (key in state.checklist) state.checklist[key] = true;
  });
  if (step.effects.progress) setProgress(step.effects.progress);
  renderChecklist();
  renderProgress();
}

/* =============================================================
   RENDEROWANIE CZATU
   ============================================================= */
function scrollChat() {
  const w = chatWindow();
  requestAnimationFrame(() => (w.scrollTop = w.scrollHeight));
}

function addBubble(role, html) {
  const b = document.createElement('div');
  b.className = `bubble ${role}`;
  const avatar = role === 'assistant' ? '🏠' : 'BL';
  b.innerHTML = `<div class="avatar">${avatar}</div><div class="bubble-body">${html}</div>`;
  chatWindow().appendChild(b);
  scrollChat();
  return b;
}

/* Asystent "pisze", potem pokazuje treść i odpala callback */
function assistantSay(html, done) {
  const typing = document.createElement('div');
  typing.className = 'bubble assistant typing';
  typing.innerHTML = `<div class="avatar">🏠</div>
    <div class="bubble-body"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chatWindow().appendChild(typing);
  scrollChat();
  setTimeout(() => {
    typing.remove();
    addBubble('assistant', html);
    if (done) done();
  }, 650);
}

/* prosty markdown: **bold** */
function md(t) { return t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }

function addActionBlock() {
  const el = document.createElement('div');
  el.className = 'action-block';
  chatWindow().appendChild(el);
  scrollChat();
  return el;
}

/* ---------------- Krok: text ---------------- */
function renderText(step) {
  assistantSay(md(step.text), () => {
    const block = addActionBlock();
    const btn = document.createElement('button');
    btn.className = 'next-btn';
    btn.textContent = 'Dalej →';
    btn.addEventListener('click', () => { block.remove(); advance(step); });
    block.appendChild(btn);
  });
}

/* ---------------- Krok: choice (przyciski + pole tekstowe) ---------------- */
function renderChoice(step) {
  assistantSay(md(step.question), () => {
    const block = addActionBlock();
    block.innerHTML = `<div class="ab-q">Wybierz opcję lub wpisz własną odpowiedź poniżej:</div>`;
    const btns = document.createElement('div');
    btns.className = 'choice-btns';

    const finish = (displayText, value, reply) => {
      disableChatInput();
      block.remove();
      addBubble('user', displayText);
      state.answers[step.key] = value;
      if (reply) assistantSay(md(reply), () => advance(step));
      else advance(step);
    };

    step.options.forEach(opt => {
      const b = document.createElement('button');
      b.className = 'choice-btn';
      b.textContent = opt.label;
      b.addEventListener('click', () => finish(opt.label, opt.value, opt.reply));
      btns.appendChild(b);
    });
    block.appendChild(btns);

    if (step.allowFree) {
      const hint = document.createElement('div');
      hint.className = 'choice-hint';
      hint.textContent = '…albo napisz własnymi słowami w polu na dole — potraktuję to jak pełnoprawną odpowiedź.';
      block.appendChild(hint);
      enableChatInput(text => finish(text, text, 'Zapisuję to Twoimi słowami — trafi wprost do briefu.'));
    }
  });
}

/* ---------------- Pole tekstowe (hybryda) ---------------- */
function enableChatInput(onSubmit) {
  const row = $('#chat-input-row');
  const input = $('#chat-input');
  const send = $('#chat-send');
  row.classList.add('active');
  input.disabled = false;
  send.disabled = false;
  input.focus();

  const handler = e => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    row._submitHandler && row.removeEventListener('submit', row._submitHandler);
    onSubmit(val);
  };
  row._submitHandler && row.removeEventListener('submit', row._submitHandler);
  row._submitHandler = handler;
  row.addEventListener('submit', handler);
}

function disableChatInput() {
  const row = $('#chat-input-row');
  const input = $('#chat-input');
  const send = $('#chat-send');
  row.classList.remove('active');
  input.disabled = true;
  send.disabled = true;
  input.value = '';
  if (row._submitHandler) { row.removeEventListener('submit', row._submitHandler); row._submitHandler = null; }
}

/* ---------------- Krok: MPZP ---------------- */
function renderMpzpWidget(step) {
  const block = addActionBlock();
  block.innerHTML = `
    <div class="widget-label">📋 Analiza zgodności z MPZP</div>
    <textarea class="mini-textarea" id="mpzp-input" placeholder="Wklej tutaj treść planu miejscowego dla swojej działki…"></textarea>
    <div class="widget-actions">
      <button class="btn btn-secondary" id="mpzp-sample">Użyj przykładowego planu</button>
      <button class="btn btn-primary" id="mpzp-check">Sprawdź zgodność</button>
    </div>`;
  scrollChat();

  $('#mpzp-sample').addEventListener('click', () => { $('#mpzp-input').value = SAMPLE_MPZP; });
  $('#mpzp-check').addEventListener('click', () => {
    const val = $('#mpzp-input').value.trim();
    if (!val) { $('#mpzp-input').value = SAMPLE_MPZP; }
    block.remove();
    addBubble('user', 'Wkleiłem treść planu miejscowego (MPZP).');
    const result = evaluateMpzp();
    fillMpzpCard(result);
    assistantSay(`Porównałem wizję z planem. <strong>${result.summary}</strong> Szczegóły znajdziesz w karcie „Zgodność z MPZP” po prawej.`, () => advance(step));
  });
}

function fillMpzpCard(result) {
  unlockCard('card-mpzp');
  const body = $('#card-mpzp-body');
  const statusLabel = { ok: 'OK', uwaga: 'Uwaga', niezgodne: 'Niezgodne' };
  body.innerHTML = `
    <p class="mpzp-summary">${result.summary}</p>
    <table class="side-table">
      ${result.rows.map(r => `
        <tr>
          <td class="st-param">${r.param}<br><span style="color:var(--ink-faint);font-size:11px">plan: ${r.plan} · projekt: ${r.projekt}</span></td>
          <td class="st-val"><span class="status-pill status-${r.status}">${statusLabel[r.status]}</span></td>
        </tr>`).join('')}
    </table>`;
}

/* ---------------- Krok: Upload (wiele plików + formaty) ---------------- */
function renderUploadWidget(step) {
  const block = addActionBlock();
  block.innerHTML = `
    <div class="widget-label">📎 Wgraj pliki projektu i inwestycji</div>
    <div style="font-size:13px;color:var(--ink-soft);margin-bottom:6px">Akceptowane formaty:</div>
    <div class="format-list">${step.formats.map(f => `<span class="format-chip">${f}</span>`).join('')}</div>
    <div class="widget-actions">
      <button class="btn btn-secondary" id="up-demo">Wgraj przykładowy zestaw plików</button>
    </div>
    <ul class="file-list" id="file-list"></ul>
    <div class="widget-actions" id="up-confirm-row" style="display:none">
      <button class="btn btn-primary" id="up-confirm">Gotowe, analizuj →</button>
    </div>`;
  scrollChat();

  const icoFor = name => {
    if (/\.pdf$/i.test(name)) return '📕';
    if (/\.(xls|xlsx|csv)$/i.test(name)) return '📊';
    if (/\.(doc|docx)$/i.test(name)) return '📘';
    if (/\.(ppt|pptx)$/i.test(name)) return '📙';
    if (/\.(png|jpg|jpeg)$/i.test(name)) return '🖼️';
    if (/\.dwg$/i.test(name)) return '📐';
    return '📄';
  };

  $('#up-demo').addEventListener('click', () => {
    const list = $('#file-list');
    list.innerHTML = '';
    step.demoFiles.forEach((f, i) => {
      setTimeout(() => {
        const li = document.createElement('li');
        li.className = 'file-chip';
        li.innerHTML = `<span class="fc-ico">${icoFor(f.name)}</span>
          <span class="fc-name">${f.name}</span>
          <span class="fc-size">${f.size}</span>
          <span class="fc-ok">✓</span>`;
        list.appendChild(li);
        scrollChat();
      }, i * 260);
    });
    $('#up-demo').disabled = true;
    setTimeout(() => { $('#up-confirm-row').style.display = 'flex'; scrollChat(); }, step.demoFiles.length * 260 + 120);
  });

  $('#up-confirm').addEventListener('click', () => {
    block.remove();
    addBubble('user', `Wgrałem ${step.demoFiles.length} pliki: ${step.demoFiles.map(f => f.name).join(', ')}.`);
    assistantSay('Dziękuję — przyjąłem pliki. W prototypie nie odczytuję ich zawartości naprawdę, ale w docelowej aplikacji wyciągnę z nich parametry projektu.', () => advance(step));
  });
}

/* ---------------- Krok: Kosztorys ---------------- */
function renderKosztorysWidget(step) {
  const items = computeKosztorys();
  state.kosztorys = items;

  const block = addActionBlock();
  const rowsHtml = items.map(it => `
    <tr>
      <td>${it.pozycja}</td>
      <td class="num"><input class="kwota-input" data-key="${it.key}" type="text" value="${formatNum(it.kwota)}"> zł</td>
    </tr>`).join('');

  block.innerHTML = `
    <div class="widget-label">💰 Szacunkowy kosztorys (kwoty edytowalne)</div>
    <table class="chat-table">
      <thead><tr><th>Pozycja</th><th style="text-align:right">Kwota</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot><tr><td>Razem (szacunkowo)</td><td class="num" id="kosztorys-total"></td></tr></tfoot>
    </table>
    <div class="widget-actions">
      <button class="btn btn-primary" id="kosztorys-accept">Zaakceptuj kosztorys →</button>
    </div>`;
  scrollChat();

  const recompute = () => {
    let sum = 0;
    $$('.kwota-input', block).forEach(inp => { sum += parseNum(inp.value); });
    $('#kosztorys-total').textContent = formatNum(sum) + ' zł';
    state.kosztorysSuma = sum;
    updateKosztorysCard(items, sum);
  };

  // pierwsza wersja -> historia
  const initialSum = items.reduce((s, i) => s + i.kwota, 0);
  state.kosztorysSuma = initialSum;
  pushHistory('Wygenerowany kosztorys', initialSum);

  unlockCard('card-kosztorys');
  updateKosztorysCard(items, initialSum);
  recompute();

  $$('.kwota-input', block).forEach(inp => {
    inp.addEventListener('input', recompute);
    inp.addEventListener('change', () => {
      if (!state.kosztorysEdited) {
        state.kosztorysEdited = true;
        pushHistory('Ręczna korekta pozycji', state.kosztorysSuma);
      }
    });
  });

  $('#kosztorys-accept').addEventListener('click', () => {
    block.remove();
    addBubble('user', `Zatwierdzam kosztorys na ${formatNum(state.kosztorysSuma)} zł.`);
    assistantSay('Zapisane. Każda zmiana kwot trafia do historii wersji (przycisk „Historia” u góry) — wracaj i koryguj je w miarę zbierania ofert.', () => advance(step));
  });
}

function updateKosztorysCard(items, sum) {
  const body = $('#card-kosztorys-body');
  body.innerHTML = `
    <table class="side-table">
      ${items.map(it => `<tr><td class="st-param">${it.pozycja}</td><td class="st-val">${formatNum(it.kwota)} zł</td></tr>`).join('')}
    </table>
    <div class="kosztorys-suma"><span class="ks-label">Razem</span><span class="ks-val" id="side-total">${formatNum(sum)} zł</span></div>`;
}

/* ---------------- Krok: Oferty ---------------- */
function renderOffersWidget(step) {
  const block = addActionBlock();
  block.innerHTML = `
    <div class="widget-label">📊 Porównanie ofert wykonawców</div>
    <textarea class="mini-textarea" id="offers-input" placeholder="Wklej oferty wykonawców (tekst lub przepisany skan)…"></textarea>
    <div class="widget-actions">
      <button class="btn btn-secondary" id="offers-sample">Użyj przykładowych ofert</button>
      <button class="btn btn-primary" id="offers-build">Porównaj oferty</button>
    </div>`;
  scrollChat();

  $('#offers-sample').addEventListener('click', () => { $('#offers-input').value = SAMPLE_OFERTY; });
  $('#offers-build').addEventListener('click', () => {
    if (!$('#offers-input').value.trim()) $('#offers-input').value = SAMPLE_OFERTY;
    block.remove();
    addBubble('user', 'Wkleiłem 3 oferty wykonawców.');
    const data = buildOffersComparison();
    fillOffersCard(data);
    assistantSay(`Ułożyłem oferty w porównywalną tabelę i przygotowałem kolejność prac — zobacz kartę „Oferty i kolejność prac”. <strong>${data.uwaga}</strong>`, () => advance(step));
  });
}

function fillOffersCard(data) {
  unlockCard('card-oferty');
  const body = $('#card-oferty-body');
  body.innerHTML = `
    <table class="side-table">
      <tr><td class="st-param" style="font-weight:600">Wykonawca / zakres</td><td class="st-val">Cena</td></tr>
      ${data.rows.map(r => `
        <tr>
          <td class="st-param">${r.wykonawca}<br><span style="color:var(--ink-faint);font-size:11px">${r.zakres} · ${r.termin} · mat.: ${r.material}</span></td>
          <td class="st-val">${formatNum(r.cena)} zł</td>
        </tr>`).join('')}
    </table>
    <div style="margin-top:12px;font-weight:700;color:var(--green-900);font-size:13px">Rekomendowana kolejność prac</div>
    <ol class="order-list">${data.kolejnosc.map(k => `<li>${k}</li>`).join('')}</ol>`;
}

/* ---------------- Krok: Brief ---------------- */
function renderBrief(step) {
  applyEffects(step);
  const sekcje = generateBrief(state);

  const brief = document.createElement('div');
  brief.className = 'brief';
  brief.innerHTML = `
    <div class="brief-head">
      <h2>📄 Brief inwestycji</h2>
      <p>Zbudowany z Twoich odpowiedzi i wczytanych danych — z kilku zdań powstał pełny, ustrukturyzowany opis.</p>
    </div>
    <div class="brief-hint">✏️ Możesz doprecyzować pojedyncze fragmenty briefu — to nie jest przepisywanie całości od nowa.</div>
    <div class="brief-sections" id="brief-sections"></div>
    <div class="brief-foot">
      <button class="btn btn-primary" id="brief-download">⬇ Pobierz brief (.txt)</button>
      <button class="btn btn-ghost" id="brief-restart">↻ Zacznij od nowa</button>
    </div>`;
  chatWindow().appendChild(brief);

  const secWrap = $('#brief-sections', brief);
  sekcje.forEach(sec => secWrap.appendChild(buildBriefSection(sec)));

  $('#brief-download', brief).addEventListener('click', () => downloadBrief(sekcje));
  $('#brief-restart', brief).addEventListener('click', openRestartModal);
  scrollChat();
}

/* Pojedyncza sekcja briefu z edycją "na miejscu" */
function buildBriefSection(sec) {
  const wrap = document.createElement('div');
  wrap.className = 'brief-section';
  wrap.dataset.id = sec.id;

  const render = () => {
    wrap.innerHTML = `
      <div class="bs-head">
        <span class="bs-title">${sec.title}</span>
        <button class="bs-edit">✏️ Popraw</button>
      </div>
      <div class="bs-text">${sec.text}</div>`;
    $('.bs-edit', wrap).addEventListener('click', edit);
  };

  const edit = () => {
    wrap.innerHTML = `
      <div class="bs-head"><span class="bs-title">${sec.title}</span></div>
      <div class="bs-editor">
        <textarea>${sec.text}</textarea>
        <div class="bs-editor-actions">
          <button class="btn btn-primary bs-save">Zapisz</button>
          <button class="btn btn-ghost bs-cancel">Anuluj</button>
        </div>
      </div>`;
    const ta = $('textarea', wrap);
    ta.focus();
    $('.bs-save', wrap).addEventListener('click', () => {
      sec.text = ta.value.trim() || sec.text;
      render();
      const flash = document.createElement('span');
      flash.className = 'bs-saved-flash';
      flash.textContent = '✓ zapisano';
      $('.bs-head', wrap).appendChild(flash);
      setTimeout(() => flash.remove(), 1800);
    });
    $('.bs-cancel', wrap).addEventListener('click', render);
  };

  render();
  return wrap;
}

function downloadBrief(sekcje) {
  const txt = 'BRIEF INWESTYCJI — Asystent Budowy Domu\n' +
    '='.repeat(48) + '\n\n' +
    sekcje.map(s => `${s.title}\n${'-'.repeat(s.title.length)}\n${s.text}\n`).join('\n');
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'brief_inwestycji.txt';
  a.click();
  URL.revokeObjectURL(url);
}

/* =============================================================
   PANELE BOCZNE: checklista, postęp, karty
   ============================================================= */
function renderChecklist() {
  const ul = $('#checklist');
  ul.innerHTML = CHECKLIST_ITEMS.map(item => {
    const done = state.checklist[item.key];
    return `<li class="${done ? 'done' : ''}">
      <span class="cl-box">${done ? '✓' : ''}</span>${item.label}</li>`;
  }).join('');
}

function setProgress(key) {
  if (state.progress && state.progress !== key && !state.progressDone.includes(state.progress)) {
    state.progressDone.push(state.progress);
  }
  // wszystkie węzły do bieżącego włącznie traktujemy jako "przeszłe/aktywne"
  const idx = progressIndex(key);
  PROGRESS_STEPS.forEach((s, i) => {
    if (i < idx && !state.progressDone.includes(s.key)) state.progressDone.push(s.key);
  });
  state.progress = key;
}

function renderProgress() {
  const nav = $('#progress-bar');
  nav.innerHTML = PROGRESS_STEPS.map((s, i) => {
    const isActive = state.progress === s.key;
    const isDone = state.progressDone.includes(s.key);
    const cls = isActive ? 'active' : (isDone ? 'done' : '');
    const line = i < PROGRESS_STEPS.length - 1 ? `<span class="pn-line"></span>` : '';
    const mark = isDone ? '✓' : (i + 1);
    return `<div class="progress-node ${cls}">
      <span class="pn-dot">${mark}</span>
      <span class="pn-label">${s.label}</span>
      ${line}
    </div>`;
  }).join('');
}

function resetSideCards() {
  ['card-mpzp', 'card-kosztorys', 'card-oferty'].forEach(id => {
    const card = $('#' + id);
    card.classList.add('card-locked');
  });
  $('#card-mpzp-body').innerHTML = '<p class="card-placeholder">Odblokuje się po analizie planu miejscowego.</p>';
  $('#card-kosztorys-body').innerHTML = '<p class="card-placeholder">Odblokuje się po wygenerowaniu kosztorysu.</p>';
  $('#card-oferty-body').innerHTML = '<p class="card-placeholder">Odblokuje się po porównaniu ofert.</p>';
}

function unlockCard(id) {
  const card = $('#' + id);
  card.classList.remove('card-locked');
  card.classList.add('unlocking');
  setTimeout(() => card.classList.remove('unlocking'), 400);
}

/* =============================================================
   HISTORIA WERSJI (kosztorys)
   ============================================================= */
function pushHistory(title, sum) {
  const now = new Date();
  const time = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  state.history.push({ title, sum, time });
  renderHistory();
}

function renderHistory() {
  const list = $('#history-list');
  if (!state.history.length) {
    list.innerHTML = '<p class="card-placeholder">Historia pojawi się po wygenerowaniu i edycji kosztorysu.</p>';
    return;
  }
  list.innerHTML = state.history.map((h, i) => `
    <div class="history-item">
      <div class="hi-head"><span>Wersja ${i + 1} · ${h.time}</span></div>
      <div class="hi-title">${h.title}</div>
      <div style="margin-top:4px">Suma kosztorysu: <span class="hi-sum">${formatNum(h.sum)} zł</span></div>
    </div>`).reverse().join('');
}

/* =============================================================
   MODALE + RESTART
   ============================================================= */
function openModal(id) { $('#' + id).classList.remove('hidden'); }
function closeModal(id) { $('#' + id).classList.add('hidden'); }

function openRestartModal() { openModal('modal-restart'); }

function doRestart() {
  closeModal('modal-restart');
  disableChatInput();
  $('#screen-dashboard').classList.add('hidden');
  $('#screen-start').classList.remove('hidden');
  state = freshState();
}

/* =============================================================
   UTILSY LICZBOWE
   ============================================================= */
function formatNum(n) { return new Intl.NumberFormat('pl-PL').format(Math.round(n)); }
function parseNum(str) { return parseInt(String(str).replace(/[^\d]/g, ''), 10) || 0; }

/* =============================================================
   BOOTSTRAP
   ============================================================= */
document.addEventListener('DOMContentLoaded', () => {
  state = freshState();
  initStart();

  $('#btn-history').addEventListener('click', () => openModal('modal-history'));
  $('#btn-restart').addEventListener('click', openRestartModal);
  $('#btn-restart-confirm').addEventListener('click', doRestart);

  // zamykanie modali (X, Anuluj, klik w tło)
  $$('[data-close]').forEach(el => el.addEventListener('click', () => closeModal(el.dataset.close)));
  $$('.modal-overlay').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) ov.classList.add('hidden'); }));
});
