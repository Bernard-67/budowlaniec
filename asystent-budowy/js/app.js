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
    kosztStandard: null,   // wybrany standard + koszt (etap „tylko pomysł”)
    dzialka: null,         // szacunek działki: { area, pricePerM2, cost }
    mpzp: null,            // odczyt MPZP: { source, parsed }
    projekt: null,         // odczyt projektu: { source, parsed, sourceLabel }
    oferty: null,          // porównanie ofert: { source, list, wybrana }
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
    case 'text':           return renderText(step);
    case 'choice':         return renderChoice(step);
    case 'dom_params':     return renderDomParams(step);
    case 'koszt_standard': return renderKosztStandard(step);
    case 'dzialka_params': return renderDzialkaParams(step);
    case 'budzet_input':   return renderBudzetInput(step);
    case 'budzet_ocena':   return renderBudzetOcena(step);
    case 'mpzp_upload':    return renderMpzpUpload(step);
    case 'projekt_upload': return renderProjektUpload(step);
    case 'mpzp':           return renderMpzpWidget(step);
    case 'kosztorys':      return renderKosztorysWidget(step);
    case 'oferty_upload':  return renderOfertyUpload(step);
    case 'oferty':         return renderOffersWidget(step);
    case 'brief':          return renderBrief(step);
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

/* ---------------- Krok: Parametry domu (metraż + garaż) ---------------- */
function renderDomParams(step) {
  assistantSay(md(step.intro), () => {
    const block = addActionBlock();
    block.innerHTML = `
      <div class="widget-label">📐 Powierzchnia domu</div>
      <div class="param-grid">
        <div class="param-field">
          <label for="pu-input">Powierzchnia użytkowa <span class="pf-hint">(wymagane)</span></label>
          <div class="param-input-wrap">
            <input class="param-input" id="pu-input" type="text" inputmode="numeric" placeholder="np. 120">
            <span class="pi-unit">m²</span>
          </div>
        </div>
        <div class="param-field">
          <label for="pg-input">Powierzchnia garażu <span class="pf-hint">(0 = bez garażu)</span></label>
          <div class="param-input-wrap">
            <input class="param-input" id="pg-input" type="text" inputmode="numeric" placeholder="np. 18">
            <span class="pi-unit">m²</span>
          </div>
        </div>
      </div>
      <div class="param-error" id="param-error" style="display:none"></div>
      <div class="widget-actions">
        <button class="btn btn-primary" id="params-next">Policz koszt →</button>
      </div>`;
    scrollChat();

    const puInput = $('#pu-input');
    puInput.focus();

    $('#params-next').addEventListener('click', () => {
      const pu = parseNum(puInput.value);
      const pg = parseNum($('#pg-input').value);
      if (!pu || pu < 20) {
        const err = $('#param-error');
        err.textContent = 'Podaj powierzchnię użytkową (min. 20 m²).';
        err.style.display = 'block';
        puInput.focus();
        return;
      }
      state.answers.powUzytkowa = pu;
      state.answers.powGarazu = pg;
      block.remove();
      const garazTxt = pg > 0 ? `, garaż ${formatNum(pg)} m²` : ', bez garażu';
      addBubble('user', `Powierzchnia użytkowa: ${formatNum(pu)} m²${garazTxt}.`);
      advance(step);
    });
  });
}

/* ---------------- Krok: Kalkulator kosztu wg standardu ---------------- */
function renderKosztStandard(step) {
  assistantSay(md(step.intro), () => {
    const pu = state.answers.powUzytkowa || 0;
    const pg = state.answers.powGarazu || 0;
    const options = computeCostByStandard(pu, pg);

    const block = addActionBlock();
    const cardsHtml = options.map(o => `
      <div class="std-card ${o.featured ? 'featured' : ''}">
        <div class="std-name">${o.label}</div>
        <div class="std-total">${formatPln(o.total)}</div>
        <div class="std-break">Dom: ${formatNum(pu)} m² × ${formatNum(o.rateDom)} zł/m²${pg > 0 ? `<br>Garaż: ${formatNum(pg)} m² × ${formatNum(o.rateGaraz)} zł/m²` : ''}</div>
        <div class="std-desc">${o.opis}</div>
        <button class="btn btn-secondary std-pick" data-key="${o.key}">Wybieram ten →</button>
      </div>`).join('');

    block.innerHTML = `
      <div class="widget-label">💰 Orientacyjny koszt budowy wg standardu</div>
      <div class="std-cards">${cardsHtml}</div>
      <div class="std-note">Stawki uśrednione (koszt budowy „pod klucz”, dane orientacyjne). Szczegóły trafią do karty „Kosztorys i materiały” po prawej.</div>`;
    scrollChat();

    $$('.std-pick', block).forEach(btn => {
      btn.addEventListener('click', () => {
        const pick = options.find(o => o.key === btn.dataset.key);
        state.answers.standard = pick.key;
        state.kosztStandard = { ...pick, powUzytkowa: pu, powGarazu: pg };
        block.remove();
        addBubble('user', `Wybieram standard: ${pick.label.toLowerCase()} — ok. ${formatPln(pick.total)}.`);
        updateInvestmentCard();
        assistantSay(`Zapisane. Orientacyjny koszt budowy w standardzie <strong>${pick.label.toLowerCase()}</strong> to <strong>${formatPln(pick.total)}</strong>. Zestawimy go za chwilę z Twoim budżetem. Pamiętaj — to szacunek na uśrednionych stawkach; uściślimy go, gdy pojawi się projekt i realne oferty.`, () => advance(step));
      });
    });
  });
}

/* Karta boczna „Kosztorys i materiały”: budowa (+ garaż) + opcjonalnie zakup działki */
function updateInvestmentCard() {
  const ks = state.kosztStandard;
  if (!ks) return;
  unlockCard('card-kosztorys');
  const dz = state.dzialka;
  const includePlot = !!(dz && !dz.owned);   // działkę posiadaną liczymy osobno (nie w sumie budowy)
  const rows = [
    `<tr><td class="st-param">Powierzchnia użytkowa<br><span style="color:var(--ink-faint);font-size:11px">${formatNum(ks.powUzytkowa)} m² × ${formatNum(ks.rateDom)} zł/m²</span></td><td class="st-val">${formatNum(ks.kosztDom)} zł</td></tr>`,
  ];
  if (ks.powGarazu > 0) {
    rows.push(`<tr><td class="st-param">Garaż<br><span style="color:var(--ink-faint);font-size:11px">${formatNum(ks.powGarazu)} m² × ${formatNum(ks.rateGaraz)} zł/m²</span></td><td class="st-val">${formatNum(ks.kosztGaraz)} zł</td></tr>`);
  }
  if (includePlot) {
    rows.push(`<tr><td class="st-param">Zakup działki<br><span style="color:var(--ink-faint);font-size:11px">${formatNum(dz.area)} m² × ${formatNum(dz.pricePerM2)} zł/m²</span></td><td class="st-val">${formatNum(dz.cost)} zł</td></tr>`);
  }
  const total = ks.total + (includePlot ? dz.cost : 0);
  const totalLabel = includePlot ? 'Łączna inwestycja' : 'Razem (szacunkowo)';
  const body = $('#card-kosztorys-body');
  body.innerHTML = `
    <p class="mpzp-summary">Standard: <strong>${ks.label}</strong>${includePlot ? ' · z zakupem działki' : ''} · szacunek na uśrednionych stawkach.</p>
    <table class="side-table">${rows.join('')}</table>
    <div class="kosztorys-suma"><span class="ks-label">${totalLabel}</span><span class="ks-val">${formatPln(total)}</span></div>`;
}

/* ---------------- Krok: Działka (posiadana albo szacunek zakupu) ----------------
   step.owned === true  -> działka już posiadana: powierzchnia wymagana (do limitów
   MPZP), cena opcjonalna i informacyjna, NIE doliczana do inwestycji.
   w przeciwnym razie    -> szacunek przyszłego zakupu (dom + działka). */
function renderDzialkaParams(step) {
  const owned = !!step.owned;
  const askPrice = !step.hidePrice;   // step.hidePrice === true -> nie pytamy o cenę za m²
  assistantSay(md(step.intro), () => {
    const block = addActionBlock();
    block.innerHTML = `
      <div class="widget-label">🌳 ${owned ? 'Twoja działka' : 'Działka (szacunek zakupu)'}</div>
      <div class="param-grid">
        <div class="param-field">
          <label for="dz-area">Powierzchnia działki <span class="pf-hint">(wymagane)</span></label>
          <div class="param-input-wrap">
            <input class="param-input" id="dz-area" type="text" inputmode="numeric" placeholder="np. 800">
            <span class="pi-unit">m²</span>
          </div>
        </div>
        ${askPrice ? `<div class="param-field">
          <label for="dz-price">Cena za m² <span class="pf-hint">(${owned ? 'opcjonalnie' : 'wymagane'})</span></label>
          <div class="param-input-wrap">
            <input class="param-input" id="dz-price" type="text" inputmode="numeric" placeholder="np. 250">
            <span class="pi-unit">zł</span>
          </div>
        </div>` : ''}
      </div>
      <div class="param-error" id="dz-error" style="display:none"></div>
      <div class="widget-actions">
        <button class="btn btn-primary" id="dz-next">${owned ? 'Zapisz →' : 'Policz łączną inwestycję →'}</button>
        ${owned ? '' : '<button class="btn btn-ghost" id="dz-skip">Nie mam jeszcze działki — pomiń</button>'}
      </div>`;
    scrollChat();
    $('#dz-area').focus();

    const showErr = msg => { const e = $('#dz-error'); e.textContent = msg; e.style.display = 'block'; };

    if (!owned) {
      $('#dz-skip').addEventListener('click', () => {
        state.dzialka = null;
        block.remove();
        addBubble('user', 'Nie mam jeszcze działki — pomińmy jej wycenę.');
        advance(step);
      });
    }

    $('#dz-next').addEventListener('click', () => {
      const area = parseNum($('#dz-area').value);
      const price = askPrice ? parseNum($('#dz-price').value) : 0;
      if (!area || area < 100) { showErr('Podaj powierzchnię działki (min. 100 m²).'); $('#dz-area').focus(); return; }
      if (!owned && (!price || price < 10)) { showErr('Podaj cenę za m² działki.'); $('#dz-price').focus(); return; }
      const cost = price ? area * price : 0;
      state.dzialka = { area, pricePerM2: price || null, cost, owned };
      block.remove();
      updateInvestmentCard();

      if (owned) {
        addBubble('user', `Moja działka: ${formatNum(area)} m²${price ? ` × ${formatNum(price)} zł/m²` : ''}.`);
        const valTxt = price ? ` (wartość ~${formatPln(cost)})` : '';
        assistantSay(`Zapisane — Twoja działka ma ${formatNum(area)} m²${valTxt}. Wykorzystam jej powierzchnię do przeliczenia limitów z MPZP (ile możesz zabudować, ile zostawić na zieleń).`, () => advance(step));
      } else {
        addBubble('user', `Działka: ${formatNum(area)} m² × ${formatNum(price)} zł/m² = ${formatPln(cost)}.`);
        const total = state.kosztStandard.total + cost;
        assistantSay(`Policzone. Zakup działki to ok. <strong>${formatPln(cost)}</strong>, a razem z budową (${formatPln(state.kosztStandard.total)}) łączna inwestycja wynosi <strong>${formatPln(total)}</strong>. Zaraz zestawimy ją z Twoim budżetem.`, () => advance(step));
      }
    });
  });
}

/* ---------------- Krok: Budżet (kwota wpisywana ręcznie) ---------------- */
function renderBudzetInput(step) {
  assistantSay(md(step.question), () => {
    const block = addActionBlock();
    block.innerHTML = `
      <div class="widget-label">💵 Planowany budżet</div>
      <div class="param-grid">
        <div class="param-field" style="flex-basis:100%">
          <label for="budzet-input">Budżet całkowity ${step.obejmuje ? `<span class="pf-hint">(${step.obejmuje})</span>` : ''}</label>
          <div class="param-input-wrap">
            <input class="param-input" id="budzet-input" type="text" inputmode="numeric" placeholder="np. 800 000">
            <span class="pi-unit">zł</span>
          </div>
        </div>
      </div>
      <div class="param-error" id="budzet-error" style="display:none"></div>
      <div class="widget-actions">
        <button class="btn btn-primary" id="budzet-ok">Zatwierdź budżet →</button>
      </div>`;
    scrollChat();

    const input = $('#budzet-input');
    input.focus();
    // formatowanie na żywo z separatorem tysięcy
    input.addEventListener('input', () => {
      const n = parseNum(input.value);
      input.value = n ? formatNum(n) : '';
    });

    $('#budzet-ok').addEventListener('click', () => {
      const amount = parseNum(input.value);
      if (!amount || amount < 50000) {
        const e = $('#budzet-error');
        e.textContent = 'Podaj realny budżet (min. 50 000 zł).';
        e.style.display = 'block';
        input.focus();
        return;
      }
      state.answers.budzet = amount;
      state.budzetObejmuje = step.obejmuje || null;
      block.remove();
      addBubble('user', `Mój budżet: ${formatPln(amount)}${step.obejmuje ? ` (${step.obejmuje})` : ''}.`);
      assistantSay('Zapisane. Zaraz zestawię tę kwotę z szacowanymi kosztami.', () => advance(step));
    });
  });
}

/* ---------------- Krok: Ocena budżetu (koszt vs budżet) ---------------- */
function renderBudzetOcena(step) {
  const ks = state.kosztStandard;
  const dz = state.dzialka;
  const plotIncluded = !!(dz && !dz.owned);    // działkę posiadaną pomijamy w budżecie
  // Koszt budowy: z kalkulatora wg standardu albo z sumy szczegółowego kosztorysu
  const buildCost = ks ? ks.total : (state.kosztorysSuma || 0);
  if (!buildCost) { advance(step); return; }
  const plotCost = plotIncluded ? dz.cost : 0;
  const cost = buildCost + plotCost;           // to zestawiamy z budżetem
  const verdict = assessBudget(cost, state.answers.budzet, state.budzetObejmuje);
  const stdLabel = ks ? (ks.label || '').toLowerCase() : 'kosztorys szczegółowy';
  const costPhrase = ks ? `Koszt budowy w standardzie ${stdLabel}` : 'Koszt wg kosztorysu';

  // Podpowiedź tańszego standardu (uwzględnia koszt działki, jeśli podana)
  let suggestionHtml = '';
  if (verdict.status === 'over' && verdict.budgetMax != null && ks) {
    const opts = computeCostByStandard(ks.powUzytkowa, ks.powGarazu);
    const fit = opts.filter(o => (o.total + plotCost) <= verdict.budgetMax);
    if (fit.length) {
      const best = fit[fit.length - 1];
      suggestionHtml = `<div class="verdict-hint">💡 W tym budżecie zmieściłby się standard <strong>${best.label.toLowerCase()}</strong> ${plotIncluded ? `(z działką ${formatPln(best.total + plotCost)})` : `(${formatPln(best.total)})`}.</div>`;
    } else {
      suggestionHtml = `<div class="verdict-hint">💡 Nawet najniższy standard nie mieści się w tym budżecie${plotIncluded ? ' razem z działką' : ''} — rozważ mniejszy metraż${plotIncluded ? ', tańszą działkę' : ''} lub wyższy budżet.</div>`;
    }
  }

  // Treść werdyktu zależnie od statusu
  let statusClass, headline, detail;
  if (verdict.status === 'over') {
    statusClass = 'over';
    headline = `${plotIncluded ? 'Łączna inwestycja' : 'Koszt budowy'} przekracza budżet o ${formatPln(verdict.overBy)}`;
    detail = plotIncluded
      ? `Dom (${formatPln(buildCost)}) i działka (${formatPln(plotCost)}) to razem ${formatPln(cost)} — powyżej Twojego budżetu (${formatPln(verdict.budgetMax)}).`
      : (verdict.obejmuje === 'dom + działka'
          ? `Sama budowa (${formatPln(cost)}) jest droższa niż Twój budżet (${formatPln(verdict.budgetMax)}) — a z budżetu trzeba jeszcze kupić działkę.`
          : `Koszt budowy (${formatPln(cost)}) przekracza budżet (${formatPln(verdict.budgetMax)}).`);
  } else if (verdict.status === 'ok') {
    statusClass = 'ok';
    if (plotIncluded) {
      headline = `Dom i działka mieszczą się w budżecie (rezerwa ok. ${formatPln(verdict.margin)})`;
      detail = `Łączna inwestycja (dom + działka) to ${formatPln(cost)} i mieści się w budżecie. Zostaje ok. ${formatPln(verdict.margin)} rezerwy na nieprzewidziane koszty.`;
    } else if (verdict.obejmuje === 'dom + działka') {
      headline = `Budowa mieści się w budżecie — zostaje ok. ${formatPln(verdict.margin)} na działkę`;
      detail = `Sama budowa mieści się w budżecie. Po odjęciu jej kosztu zostaje ok. ${formatPln(verdict.margin)} — to Twój zapas na działkę i rezerwę.`;
    } else {
      headline = `Koszt mieści się w budżecie (zapas ok. ${formatPln(verdict.margin)})`;
      detail = `Koszt budowy mieści się w budżecie z zapasem ok. ${formatPln(verdict.margin)}.`;
    }
  } else if (verdict.status === 'open') {
    statusClass = 'neutral';
    headline = 'Budżet bez określonego limitu';
    detail = `${plotIncluded ? `Łączna inwestycja (dom + działka) to ${formatPln(cost)}` : `${costPhrase} to ${formatPln(cost)}`}. Budżet podałeś jako „${verdict.budgetLabel}”, bez górnej granicy — nie wyliczę dokładnego zapasu.${plotIncluded ? '' : ' Pamiętaj, że ma on pokryć także działkę.'}`;
  } else { // unknown
    statusClass = 'neutral';
    headline = 'Budżet podany opisowo';
    detail = `${plotIncluded ? `Łączna inwestycja (dom + działka) to ${formatPln(cost)}` : `${costPhrase} to ${formatPln(cost)}`}. Budżet podałeś swobodnie („${state.answers.budzet}”), więc nie zestawiam go liczbowo — dopisz konkretną kwotę, a policzę zapas.`;
  }

  // Wskaźnik (tylko dla budżetów z górną granicą)
  const gaugeHtml = (verdict.budgetMax != null) ? `
    <div class="budget-gauge">
      <div class="bg-track"><div class="bg-fill ${statusClass}" style="width:${Math.min(verdict.pct, 1) * 100}%"></div></div>
      <div class="bg-scale"><span>0</span><span>Budżet: ${formatPln(verdict.budgetMax)}</span></div>
    </div>` : '';

  // Wiersze zestawienia
  const budgetDesc = verdict.exact
    ? `Budżet${verdict.obejmuje ? ' (' + verdict.obejmuje + ')' : ''}`
    : `Budżet (${verdict.budgetLabel}${verdict.obejmuje ? ', ' + verdict.obejmuje : ''})`;
  const budgetVal = verdict.budgetMax != null
    ? (verdict.exact ? formatPln(verdict.budgetMax) : '≤ ' + formatPln(verdict.budgetMax))
    : verdict.budgetLabel;
  const budgetRow = `<div><span>${budgetDesc}</span><strong>${budgetVal}</strong></div>`;
  const rowsHtml = plotIncluded
    ? `<div><span>Budowa domu (${stdLabel})</span><strong>${formatPln(buildCost)}</strong></div>
       <div><span>Zakup działki</span><strong>${formatPln(plotCost)}</strong></div>
       <div class="vr-total"><span>Łączna inwestycja</span><strong>${formatPln(cost)}</strong></div>
       ${budgetRow}`
    : `<div><span>Koszt budowy (${stdLabel})</span><strong>${formatPln(cost)}</strong></div>
       ${budgetRow}`;

  assistantSay(md(step.intro), () => {
    const block = addActionBlock();
    block.innerHTML = `
      <div class="widget-label">🎯 ${plotIncluded ? 'Łączna inwestycja a budżet' : 'Koszt budowy a budżet'}</div>
      <div class="verdict-card verdict-${statusClass}">
        <div class="verdict-head">${headline}</div>
        <div class="verdict-rows">${rowsHtml}</div>
        ${gaugeHtml}
        <div class="verdict-detail">${detail}</div>
        ${suggestionHtml}
      </div>
      <div class="widget-actions">
        <button class="btn btn-primary" id="verdict-next">Dalej →</button>
      </div>`;
    scrollChat();
    $('#verdict-next').addEventListener('click', () => { block.remove(); advance(step); });
  });
}

/* Ikona pliku wg rozszerzenia (współdzielona przez widgety uploadu) */
function fileIcon(name) {
  if (/\.pdf$/i.test(name)) return '📕';
  if (/\.(xls|xlsx|csv)$/i.test(name)) return '📊';
  if (/\.(doc|docx)$/i.test(name)) return '📘';
  if (/\.(ppt|pptx)$/i.test(name)) return '📙';
  if (/\.(png|jpg|jpeg)$/i.test(name)) return '🖼️';
  if (/\.dwg$/i.test(name)) return '📐';
  return '📄';
}

/* Formaty -> rozszerzenia i atrybut accept (dla realnego <input type="file">) */
const FORMAT_EXT = {
  PDF: ['pdf'], PNG: ['png'], JPG: ['jpg', 'jpeg'], TXT: ['txt'],
  DOC: ['doc', 'docx'], XLS: ['xls', 'xlsx', 'csv'], PPT: ['ppt', 'pptx'], DWG: ['dwg'],
};
function formatsToExt(formats) {
  return (formats || []).flatMap(f => FORMAT_EXT[String(f).toUpperCase()] || [String(f).toLowerCase()]);
}
function formatsToAccept(formats) {
  return formatsToExt(formats).map(e => '.' + e).join(',');
}
/* Rozmiar pliku w czytelnej formie (B / KB / MB, po polsku) */
function formatFileSize(bytes) {
  if (bytes == null || isNaN(bytes)) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1).replace('.', ',') + ' MB';
}

/* pdf.js — worker (raz, przy starcie) */
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
}

/* Rekonstrukcja tekstu ze strony PDF wg pozycji X (spacja tylko przy realnej
   przerwie) — bez tego pdf.js rozdziela polskie diakrytyki spacjami. */
function reconstructPdfText(items) {
  let text = '', prevEndX = null, prevY = null;
  for (const it of items) {
    if (!it.str) { if (it.hasEOL) { text += '\n'; prevEndX = null; } continue; }
    const fs = Math.abs(it.transform[0]) || it.height || 10;
    const tx = it.transform[4], ty = it.transform[5];
    if (prevEndX !== null) {
      if (prevY !== null && Math.abs(ty - prevY) > fs * 0.5) text += '\n';
      else if (tx - prevEndX > fs * 0.2) text += ' ';
    }
    text += it.str;
    prevEndX = tx + it.width;
    prevY = ty;
  }
  return text;
}

/* Wyciąga tekst z pliku PDF (File) przez pdf.js */
async function extractPdfText(file) {
  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let full = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    full += reconstructPdfText(tc.items) + '\n';
  }
  return full.replace(/[ \t]+/g, ' ');
}

/* ---------------- Krok: Upload MPZP (mock) + wyciągnięcie danych ---------------- */
function renderMpzpUpload(step) {
  assistantSay(md(step.intro), () => {
    const block = addActionBlock();
    block.innerHTML = `
      <div class="widget-label">📋 Wgraj plik MPZP (plan miejscowy)</div>
      <div style="font-size:13px;color:var(--ink-soft);margin-bottom:6px">Akceptowane formaty:</div>
      <div class="format-list">${step.formats.map(f => `<span class="format-chip">${f}</span>`).join('')}</div>
      <input type="file" id="mpzp-file" class="hidden-file" accept="${formatsToAccept(step.formats)}" multiple>
      <div class="widget-actions">
        <button class="btn btn-primary" id="mpzp-pick">📎 Załącz plik z dysku</button>
        <button class="btn btn-secondary" id="mpzp-demo">Użyj przykładowego pliku</button>
        <button class="btn btn-ghost" id="mpzp-skip">Nie mam jeszcze MPZP — pomiń</button>
      </div>
      <div class="mpzp-source-note" id="mpzp-source-note" style="display:none"></div>
      <div class="param-error" id="mpzp-file-error" style="display:none"></div>
      <ul class="file-list" id="mpzp-file-list"></ul>
      <div class="widget-actions" id="mpzp-analyze-row" style="display:none">
        <button class="btn btn-primary" id="mpzp-analyze">Wyciągnij kluczowe dane →</button>
      </div>`;
    scrollChat();

    let source = null;                   // 'real' | 'demo' — źródło wykluczające
    const attached = [];                 // {name, size, file, kind}
    const listEl = $('#mpzp-file-list');
    const acceptedExt = formatsToExt(step.formats);
    const kindOf = name => /\.pdf$/i.test(name) ? 'pdf' : /\.(png|jpe?g)$/i.test(name) ? 'image' : 'other';

    const addChip = (name, size, kind) => {
      const rec = { name, size, kind };
      attached.push(rec);
      const li = document.createElement('li');
      li.className = 'file-chip';
      li.innerHTML = `<span class="fc-ico">${fileIcon(name)}</span>
        <span class="fc-name">${name}</span>
        <span class="fc-size">${size}</span>
        <span class="fc-ok">✓</span>
        <button class="fc-remove" title="Usuń plik" aria-label="Usuń plik">✕</button>`;
      li.querySelector('.fc-remove').addEventListener('click', () => {
        const i = attached.indexOf(rec);
        if (i >= 0) attached.splice(i, 1);
        li.remove();
        if (!attached.length) { $('#mpzp-analyze-row').style.display = 'none'; resetSource(); }
        scrollChat();
      });
      listEl.appendChild(li);
      $('#mpzp-analyze-row').style.display = 'flex';
      scrollChat();
      return rec;
    };

    // Ustala wykluczające źródło i blokuje drugą opcję
    const lockSource = (src, noteHtml) => {
      source = src;
      $('#mpzp-demo').disabled = (src === 'real');
      $('#mpzp-pick').disabled = (src === 'demo');
      $('#mpzp-file').disabled = (src === 'demo');
      const note = $('#mpzp-source-note');
      note.innerHTML = noteHtml;
      note.style.display = 'block';
    };

    // Reset po usunięciu wszystkich plików — znów można wybrać źródło
    const resetSource = () => {
      source = null;
      $('#mpzp-demo').disabled = false;
      $('#mpzp-pick').disabled = false;
      $('#mpzp-file').disabled = false;
      const note = $('#mpzp-source-note');
      note.style.display = 'none';
      note.innerHTML = '';
    };

    // Realny plik z dysku
    $('#mpzp-pick').addEventListener('click', () => $('#mpzp-file').click());
    $('#mpzp-file').addEventListener('change', e => {
      const err = $('#mpzp-file-error');
      err.style.display = 'none';
      const rejected = [];
      [...e.target.files].forEach(file => {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (acceptedExt.length && !acceptedExt.includes(ext)) { rejected.push(file.name); return; }
        addChip(file.name, formatFileSize(file.size), kindOf(file.name)).file = file;
      });
      if (rejected.length) {
        err.textContent = `Pominięto pliki w niewspieranym formacie: ${rejected.join(', ')}.`;
        err.style.display = 'block';
      }
      if (attached.length) lockSource('real', '📎 Źródło: <strong>Twoje pliki</strong> — odczyt realny. Przykładowy plan jest teraz zablokowany.');
      e.target.value = '';
    });

    // Przykładowy plik (mock, treść z SAMPLE_MPZP)
    $('#mpzp-demo').addEventListener('click', () => {
      lockSource('demo', '📄 Źródło: <strong>przykładowy plan</strong>. Załączanie własnych plików jest teraz zablokowane.');
      step.demoFiles.forEach((f, i) => setTimeout(() => addChip(f.name, f.size, 'pdf'), i * 220));
    });

    // Pomiń — NIE odhacza MPZP na checkliście (tylko efekt progress)
    $('#mpzp-skip').addEventListener('click', () => {
      block.remove();
      addBubble('user', 'Nie mam jeszcze MPZP — pomińmy analizę planu.');
      const skipStep = { ...step, effects: { progress: step.effects && step.effects.progress } };
      assistantSay('Jasne. Gdy znajdziesz działkę, wróć tutaj z jej MPZP — wyciągnę z niego, co i jak możesz na niej zbudować.', () => advance(skipStep));
    });

    // Analiza — realny odczyt PDF (pdf.js) albo przykład; źródła się NIE łączą
    $('#mpzp-analyze').addEventListener('click', async () => {
      if (!attached.length) return;
      block.remove();
      addBubble('user', `Wgrałem MPZP (${source === 'demo' ? 'przykład' : 'plik z dysku'}): ${attached.map(f => f.name).join(', ')}.`);

      const typing = showTyping();
      let parsed = null, sourceLabel = '', failMsg = null;
      try {
        if (source === 'demo') {
          parsed = parseMpzpText(SAMPLE_MPZP);
          sourceLabel = 'przykładowego planu';
        } else {
          const pdf = attached.find(f => f.kind === 'pdf');
          if (!pdf) {
            failMsg = 'Załączyłeś obraz (JPG/PNG) — w prototypie odczytuję parametry tylko z <strong>PDF-a z warstwą tekstową</strong> (np. wypis/uchwała MPZP). Wgraj plik PDF albo użyj przykładowego planu.';
          } else {
            const text = await extractPdfText(pdf.file);
            parsed = parseMpzpText(text);
            sourceLabel = `Twojego pliku „${pdf.name}”`;
            if (!parsed.foundCount) {
              failMsg = `Odczytałem tekst z „${pdf.name}”, ale nie rozpoznałem w nim parametrów MPZP (może to inny dokument albo nietypowy układ zapisu).`;
              parsed = null;
            }
          }
        }
      } catch (err) {
        failMsg = 'Nie udało się odczytać pliku (' + err.message + ').';
        parsed = null;
      }
      typing.remove();

      if (!parsed) {
        const skipStep = { ...step, effects: { progress: step.effects && step.effects.progress } };
        assistantSay(failMsg, () => advance(skipStep));
        return;
      }

      state.mpzp = { source, parsed, sourceLabel };
      fillMpzpKeyDataCard(parsed, sourceLabel);

      const dz = state.dzialka;
      let msg = `Odczytałem <strong>${sourceLabel}</strong> i wyciągnąłem ${parsed.foundCount} kluczowych parametrów planu — szczegóły w karcie „Zgodność z MPZP” po prawej.`;
      if (dz && dz.area && parsed.percent.biolCzynna != null) {
        msg += ` Na działce ${formatNum(dz.area)} m² musisz zostawić min. <strong>${formatNum(Math.round(dz.area * parsed.percent.biolCzynna / 100))} m²</strong> zieleni`;
        if (parsed.percent.zabudowa != null) msg += `, a zabudować maks. <strong>${formatNum(Math.round(dz.area * parsed.percent.zabudowa / 100))} m²</strong>`;
        msg += '.';
      }
      msg += ' ' + (MPZP_TYP_NOTE[state.answers.typ_domu] || 'Twój dom jednorodzinny mieści się w ramach planu.');
      assistantSay(msg, () => advance(step));
    });
  });
}

function showTyping() {
  const typing = document.createElement('div');
  typing.className = 'bubble assistant typing';
  typing.innerHTML = `<div class="avatar">🏠</div><div class="bubble-body"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
  chatWindow().appendChild(typing);
  scrollChat();
  return typing;
}

function fillMpzpKeyDataCard(parsed, sourceLabel) {
  unlockCard('card-mpzp');
  const body = $('#card-mpzp-body');
  const dz = state.dzialka;
  let derivedHtml = '';
  if (dz && dz.area) {
    const bits = [];
    if (parsed.percent.zabudowa != null) bits.push(`maks. zabudowa <strong>${formatNum(Math.round(dz.area * parsed.percent.zabudowa / 100))} m²</strong>`);
    if (parsed.percent.biolCzynna != null) bits.push(`min. zieleń <strong>${formatNum(Math.round(dz.area * parsed.percent.biolCzynna / 100))} m²</strong>`);
    if (bits.length) derivedHtml = `<div class="mpzp-derived">Dla działki ${formatNum(dz.area)} m²: ${bits.join(', ')}.</div>`;
  }
  body.innerHTML = `
    <p class="mpzp-summary">Odczytano z: <strong>${sourceLabel}</strong>.</p>
    <table class="side-table">
      ${parsed.rows.map(r => `<tr class="${r.found ? '' : 'mpzp-missing'}"><td class="st-param">${r.param}</td><td class="st-val">${r.wartosc}</td></tr>`).join('')}
    </table>
    ${derivedHtml}`;
}

/* ---------------- Krok: Upload projektu (PDF) + odczyt parametrów ---------------- */
function renderProjektUpload(step) {
  assistantSay(md(step.intro), () => {
    const block = addActionBlock();
    block.innerHTML = `
      <div class="widget-label">📐 Wgraj projekt budowlany (PDF)</div>
      <div style="font-size:13px;color:var(--ink-soft);margin-bottom:6px">Akceptowany format:</div>
      <div class="format-list">${step.formats.map(f => `<span class="format-chip">${f}</span>`).join('')}</div>
      <input type="file" id="prj-file" class="hidden-file" accept="${formatsToAccept(step.formats)}" multiple>
      <div class="widget-actions">
        <button class="btn btn-primary" id="prj-pick">📎 Załącz plik z dysku</button>
        <button class="btn btn-secondary" id="prj-demo">Użyj przykładowego projektu</button>
      </div>
      <div class="mpzp-source-note" id="prj-source-note" style="display:none"></div>
      <div class="param-error" id="prj-file-error" style="display:none"></div>
      <ul class="file-list" id="prj-file-list"></ul>
      <div class="widget-actions" id="prj-analyze-row" style="display:none">
        <button class="btn btn-primary" id="prj-analyze">Odczytaj projekt →</button>
      </div>`;
    scrollChat();

    let source = null;
    const attached = [];
    const listEl = $('#prj-file-list');
    const acceptedExt = formatsToExt(step.formats);

    const addChip = (name, size) => {
      const rec = { name, size };
      attached.push(rec);
      const li = document.createElement('li');
      li.className = 'file-chip';
      li.innerHTML = `<span class="fc-ico">${fileIcon(name)}</span>
        <span class="fc-name">${name}</span>
        <span class="fc-size">${size}</span>
        <span class="fc-ok">✓</span>
        <button class="fc-remove" title="Usuń plik" aria-label="Usuń plik">✕</button>`;
      li.querySelector('.fc-remove').addEventListener('click', () => {
        const i = attached.indexOf(rec);
        if (i >= 0) attached.splice(i, 1);
        li.remove();
        if (!attached.length) { $('#prj-analyze-row').style.display = 'none'; resetSource(); }
        scrollChat();
      });
      listEl.appendChild(li);
      $('#prj-analyze-row').style.display = 'flex';
      scrollChat();
      return rec;
    };

    const lockSource = (src, noteHtml) => {
      source = src;
      $('#prj-demo').disabled = (src === 'real');
      $('#prj-pick').disabled = (src === 'demo');
      $('#prj-file').disabled = (src === 'demo');
      const note = $('#prj-source-note');
      note.innerHTML = noteHtml;
      note.style.display = 'block';
    };

    // Reset po usunięciu wszystkich plików — znów można wybrać źródło
    const resetSource = () => {
      source = null;
      $('#prj-demo').disabled = false;
      $('#prj-pick').disabled = false;
      $('#prj-file').disabled = false;
      const note = $('#prj-source-note');
      note.style.display = 'none';
      note.innerHTML = '';
    };

    $('#prj-pick').addEventListener('click', () => $('#prj-file').click());
    $('#prj-file').addEventListener('change', e => {
      const err = $('#prj-file-error');
      err.style.display = 'none';
      const rejected = [];
      [...e.target.files].forEach(file => {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (acceptedExt.length && !acceptedExt.includes(ext)) { rejected.push(file.name); return; }
        addChip(file.name, formatFileSize(file.size)).file = file;
      });
      if (rejected.length) {
        err.textContent = `Pominięto pliki w niewspieranym formacie (tylko PDF): ${rejected.join(', ')}.`;
        err.style.display = 'block';
      }
      if (attached.length) lockSource('real', '📎 Źródło: <strong>Twój plik</strong> — odczyt realny. Przykładowy projekt jest teraz zablokowany.');
      e.target.value = '';
    });

    $('#prj-demo').addEventListener('click', () => {
      lockSource('demo', '📄 Źródło: <strong>przykładowy projekt</strong>. Załączanie własnych plików jest teraz zablokowane.');
      step.demoFiles.forEach((f, i) => setTimeout(() => addChip(f.name, f.size), i * 220));
    });

    $('#prj-analyze').addEventListener('click', async () => {
      if (!attached.length) return;
      block.remove();
      addBubble('user', `Wgrałem projekt (${source === 'demo' ? 'przykład' : 'plik z dysku'}): ${attached.map(f => f.name).join(', ')}.`);

      const typing = showTyping();
      let parsed = null, sourceLabel = '', errMsg = null;
      try {
        if (source === 'demo') {
          parsed = parseProjektText(SAMPLE_PROJEKT);
          sourceLabel = 'przykładowego projektu';
        } else {
          const pdf = attached[0];
          const text = await extractPdfText(pdf.file);
          parsed = parseProjektText(text);
          sourceLabel = `Twojego pliku „${pdf.name}”`;
        }
      } catch (err) {
        errMsg = 'Nie udało się odczytać pliku (' + err.message + ').';
      }
      typing.remove();

      // Nie rozpoznano parametrów -> formularz do ręcznego wpisania (do porównania z MPZP)
      if (!parsed || !parsed.foundCount) {
        const note = parsed
          ? `Wczytałem <strong>${sourceLabel}</strong>, ale nie rozpoznałem w nim typowych parametrów. Wpisz najważniejsze z nich ręcznie — wykorzystam je później do porównania z MPZP. Pola możesz zostawić puste.`
          : `${errMsg} Wpisz najważniejsze parametry projektu ręcznie — przydadzą się do porównania z MPZP. Pola możesz zostawić puste.`;
        showProjektManualForm(step, note);
        return;
      }

      // Rozpoznano parametry
      state.projekt = { source, parsed, sourceLabel };
      if (parsed.powUzytkowa) state.answers.powUzytkowa = parsed.powUzytkowa;
      const found = parsed.rows.filter(r => r.found).map(r => `${r.param.toLowerCase()}: <strong>${r.wartosc}</strong>`).join(', ');
      assistantSay(`Odczytałem <strong>${sourceLabel}</strong> i wyciągnąłem ${parsed.foundCount} parametrów — ${found}. Przechodzimy dalej: MPZP i kosztorys.`, () => advance(step));
    });
  });
}

/* Formularz ręcznego wpisania parametrów projektu (gdy PDF ich nie zawiera).
   Dane trafiają do state.projekt w tej samej strukturze co odczyt z pliku. */
function showProjektManualForm(step, introHtml) {
  assistantSay(introHtml, () => {
    const block = addActionBlock();
    block.innerHTML = `
      <div class="widget-label">✏️ Wpisz parametry projektu ręcznie</div>
      <div class="param-grid">
        <div class="param-field">
          <label for="pm-pu">Powierzchnia użytkowa</label>
          <div class="param-input-wrap"><input class="param-input" id="pm-pu" type="text" inputmode="numeric" placeholder="np. 140"><span class="pi-unit">m²</span></div>
        </div>
        <div class="param-field">
          <label for="pm-pz">Powierzchnia zabudowy</label>
          <div class="param-input-wrap"><input class="param-input" id="pm-pz" type="text" inputmode="numeric" placeholder="np. 98"><span class="pi-unit">m²</span></div>
        </div>
        <div class="param-field">
          <label for="pm-kond">Liczba kondygnacji</label>
          <div class="param-input-wrap"><input class="param-input" id="pm-kond" type="text" inputmode="numeric" placeholder="np. 2"></div>
        </div>
        <div class="param-field">
          <label for="pm-wys">Wysokość budynku</label>
          <div class="param-input-wrap"><input class="param-input" id="pm-wys" type="text" inputmode="numeric" placeholder="np. 8,4"><span class="pi-unit">m</span></div>
        </div>
        <div class="param-field">
          <label for="pm-kat">Kąt nachylenia dachu</label>
          <div class="param-input-wrap"><input class="param-input" id="pm-kat" type="text" inputmode="numeric" placeholder="np. 40"><span class="pi-unit">°</span></div>
        </div>
      </div>
      <div class="widget-actions">
        <button class="btn btn-primary" id="pm-save">Zapisz parametry →</button>
      </div>`;
    scrollChat();
    $('#pm-pu').focus();

    const dec = v => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
    const fmtDec = n => Number.isInteger(n) ? String(n) : String(n).replace('.', ',');

    $('#pm-save').addEventListener('click', () => {
      const pu = dec($('#pm-pu').value), pz = dec($('#pm-pz').value);
      const kond = Math.round(dec($('#pm-kond').value)), wys = dec($('#pm-wys').value), kat = Math.round(dec($('#pm-kat').value));
      const rows = [];
      if (pu)   rows.push({ param: 'Powierzchnia użytkowa', wartosc: fmtDec(pu) + ' m²', found: true });
      if (pz)   rows.push({ param: 'Powierzchnia zabudowy', wartosc: fmtDec(pz) + ' m²', found: true });
      if (kond) rows.push({ param: 'Liczba kondygnacji', wartosc: 'do ' + kond, found: true });
      if (wys)  rows.push({ param: 'Wysokość budynku', wartosc: fmtDec(wys) + ' m', found: true });
      if (kat)  rows.push({ param: 'Geometria dachu', wartosc: 'kąt ' + kat + '°', found: true });

      const parsed = {
        rows, manual: true, foundCount: rows.length,
        powUzytkowa: pu ? Math.round(pu) : null,
        powZabudowy: pz ? Math.round(pz) : null,
        kondygnacje: kond || null,
        wysokosc: wys || null,
        katDachu: kat || null,
      };
      state.projekt = { source: 'manual', parsed, sourceLabel: 'ręcznie wpisanych danych' };
      if (parsed.powUzytkowa) state.answers.powUzytkowa = parsed.powUzytkowa;

      block.remove();
      addBubble('user', rows.length ? `Wpisałem parametry projektu: ${rows.map(r => r.wartosc).join(', ')}.` : 'Pominąłem ręczne wpisywanie parametrów.');
      assistantSay(rows.length
        ? `Zapisałem ${rows.length} parametrów projektu — wykorzystam je do porównania z MPZP na kolejnym etapie.`
        : 'Ok, pomijamy parametry — doprecyzujesz je później w kosztorysie i briefie.', () => advance(step));
    });
  });
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

/* Escape wartości do atrybutu HTML (value="...") */
function escAttr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

/* ---------------- Krok: Kosztorys ---------------- */
function renderKosztorysWidget(step) {
  const items = computeKosztorys();
  state.kosztorys = items;

  const block = addActionBlock();
  block.innerHTML = `
    <div class="widget-label">💰 Szacunkowy kosztorys (nazwy i kwoty edytowalne)</div>
    <table class="chat-table kosztorys-table">
      <thead><tr><th>Pozycja</th><th style="text-align:right">Kwota</th><th></th></tr></thead>
      <tbody id="kosztorys-tbody"></tbody>
      <tfoot><tr><td>Razem (szacunkowo)</td><td class="num" id="kosztorys-total"></td><td></td></tr></tfoot>
    </table>
    <div class="widget-actions">
      <button class="btn btn-ghost" id="kosztorys-add">+ Dodaj pozycję</button>
      <button class="btn btn-secondary" id="kosztorys-export">⬇ Eksport do Excela (.csv)</button>
    </div>
    <div class="widget-actions">
      <button class="btn btn-primary" id="kosztorys-accept">Zaakceptuj kosztorys →</button>
    </div>`;
  scrollChat();

  const recompute = () => {
    const sum = items.reduce((s, it) => s + (it.kwota || 0), 0);
    $('#kosztorys-total').textContent = formatNum(sum) + ' zł';
    state.kosztorysSuma = sum;
    updateKosztorysCard(items, sum);
  };

  const markEdited = () => {
    if (!state.kosztorysEdited) {
      state.kosztorysEdited = true;
      pushHistory('Ręczna korekta pozycji', state.kosztorysSuma);
    }
  };

  const renderRows = () => {
    const tbody = $('#kosztorys-tbody', block);
    tbody.innerHTML = items.map((it, idx) => `
      <tr>
        <td><input class="pozycja-input" data-idx="${idx}" type="text" value="${escAttr(it.pozycja)}"></td>
        <td class="num"><input class="kwota-input" data-idx="${idx}" type="text" value="${formatNum(it.kwota)}"> zł</td>
        <td class="kt-actions"><button class="kt-del" data-idx="${idx}" title="Usuń pozycję" aria-label="Usuń pozycję">✕</button></td>
      </tr>`).join('');

    $$('.pozycja-input', tbody).forEach(inp => {
      inp.addEventListener('input', () => {
        items[+inp.dataset.idx].pozycja = inp.value;
        updateKosztorysCard(items, state.kosztorysSuma);
      });
      inp.addEventListener('change', markEdited);
    });
    $$('.kwota-input', tbody).forEach(inp => {
      inp.addEventListener('input', () => {
        const n = parseNum(inp.value);
        inp.value = n ? formatNum(n) : '';   // formatowanie na żywo (spacja co tysiąc)
        items[+inp.dataset.idx].kwota = n;
        recompute();
      });
      inp.addEventListener('change', markEdited);
    });
    $$('.kt-del', tbody).forEach(btn => {
      btn.addEventListener('click', () => {
        items.splice(+btn.dataset.idx, 1);
        renderRows();
        recompute();
        markEdited();
      });
    });
  };

  // pierwsza wersja -> historia
  const initialSum = items.reduce((s, i) => s + i.kwota, 0);
  state.kosztorysSuma = initialSum;
  pushHistory('Wygenerowany kosztorys', initialSum);

  unlockCard('card-kosztorys');
  renderRows();
  recompute();

  $('#kosztorys-add').addEventListener('click', () => {
    items.push({ key: 'nowa_' + Date.now(), pozycja: '', kwota: 0 });
    renderRows();
    recompute();
    markEdited();
    const names = $$('.pozycja-input', block);
    if (names.length) names[names.length - 1].focus();
  });

  $('#kosztorys-export').addEventListener('click', () => exportKosztorysCsv(items));

  $('#kosztorys-accept').addEventListener('click', () => {
    block.remove();
    addBubble('user', `Zatwierdzam kosztorys na ${formatNum(state.kosztorysSuma)} zł.`);
    assistantSay('Zapisane. Każda zmiana trafia do historii wersji (przycisk „Historia” u góry) — wracaj i koryguj je w miarę zbierania ofert.', () => advance(step));
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

/* CSV kosztorysu pod polski Excel: separator ';', BOM UTF-8, kwoty jako liczby */
function buildKosztorysCsv(items) {
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const sep = ';';
  const lines = [[esc('Pozycja'), esc('Kwota (zł)')].join(sep)];
  let sum = 0;
  items.forEach(it => { sum += (it.kwota || 0); lines.push([esc(it.pozycja), it.kwota || 0].join(sep)); });
  lines.push([esc('Razem'), sum].join(sep));
  return '﻿' + lines.join('\r\n');
}

function exportKosztorysCsv(items) {
  const blob = new Blob([buildKosztorysCsv(items)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kosztorys.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------------- Krok: Oferty — upload 2–5 PDF (ETAP 1) ---------------- */
function renderOfertyUpload(step) {
  const MAX = 5;
  assistantSay(md(step.intro), () => {
    const block = addActionBlock();
    block.innerHTML = `
      <div class="widget-label">📊 Wgraj oferty wykonawców (PDF, od 2 do 5)</div>
      <div style="font-size:13px;color:var(--ink-soft);margin-bottom:6px">Akceptowany format:</div>
      <div class="format-list">${step.formats.map(f => `<span class="format-chip">${f}</span>`).join('')}</div>
      <input type="file" id="of-file" class="hidden-file" accept="${formatsToAccept(step.formats)}" multiple>
      <div class="widget-actions">
        <button class="btn btn-primary" id="of-pick">📎 Załącz oferty z dysku</button>
        <button class="btn btn-secondary" id="of-demo">Użyj przykładowych ofert</button>
      </div>
      <div class="mpzp-source-note" id="of-source-note" style="display:none"></div>
      <div class="param-error" id="of-file-error" style="display:none"></div>
      <ul class="file-list" id="of-file-list"></ul>
      <div class="widget-actions" id="of-compare-row" style="display:none">
        <button class="btn btn-primary" id="of-compare">Porównaj oferty →</button>
      </div>`;
    scrollChat();

    let source = null;
    const attached = [];               // {name, size, file?, sample?}
    const listEl = $('#of-file-list');
    const acceptedExt = formatsToExt(step.formats);

    const updateControls = () => {
      $('#of-compare-row').style.display = attached.length ? 'flex' : 'none';
      const full = attached.length >= MAX;
      $('#of-pick').disabled = (source === 'demo') || full;
      $('#of-file').disabled = (source === 'demo') || full;
      $('#of-demo').disabled = (source === 'real');
    };

    const addChip = (name, size, extra) => {
      const rec = Object.assign({ name, size }, extra || {});
      attached.push(rec);
      const li = document.createElement('li');
      li.className = 'file-chip';
      li.innerHTML = `<span class="fc-ico">${fileIcon(name)}</span>
        <span class="fc-name">${name}</span>
        <span class="fc-size">${size}</span>
        <span class="fc-ok">✓</span>
        <button class="fc-remove" title="Usuń plik" aria-label="Usuń plik">✕</button>`;
      li.querySelector('.fc-remove').addEventListener('click', () => {
        const i = attached.indexOf(rec);
        if (i >= 0) attached.splice(i, 1);
        li.remove();
        if (!attached.length) { source = null; $('#of-source-note').style.display = 'none'; }
        updateControls();
        scrollChat();
      });
      listEl.appendChild(li);
      updateControls();
      scrollChat();
      return rec;
    };

    const lockSource = (src, noteHtml) => {
      source = src;
      const note = $('#of-source-note');
      note.innerHTML = noteHtml;
      note.style.display = 'block';
      updateControls();
    };

    $('#of-pick').addEventListener('click', () => $('#of-file').click());
    $('#of-file').addEventListener('change', e => {
      const err = $('#of-file-error'); err.style.display = 'none';
      const rejected = [];
      [...e.target.files].forEach(file => {
        if (attached.length >= MAX) { rejected.push(file.name + ' (limit 5)'); return; }
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        if (acceptedExt.length && !acceptedExt.includes(ext)) { rejected.push(file.name); return; }
        addChip(file.name, formatFileSize(file.size), { file });
      });
      if (rejected.length) { err.textContent = `Pominięto: ${rejected.join(', ')}.`; err.style.display = 'block'; }
      if (attached.length) lockSource('real', '📎 Źródło: <strong>Twoje pliki</strong> — odczyt realny. Przykładowe oferty zablokowane.');
      e.target.value = '';
    });

    $('#of-demo').addEventListener('click', () => {
      lockSource('demo', '📄 Źródło: <strong>przykładowe oferty</strong>. Załączanie własnych plików zablokowane.');
      step.demoFiles.forEach((f, i) => setTimeout(() => addChip(f.name, f.size, { sample: true }), i * 180));
    });

    $('#of-compare').addEventListener('click', () => {
      if (attached.length < 2) {
        const err = $('#of-file-error');
        err.textContent = 'Dodaj co najmniej 2 oferty do porównania.';
        err.style.display = 'block';
        return;
      }
      state.oferty = { source, list: attached.map(f => ({ name: f.name, sample: !!f.sample })), wybrana: null };
      block.remove();
      addBubble('user', `Wgrałem ${attached.length} oferty: ${attached.map(f => f.name).join(', ')}.`);
      assistantSay(`Zebrałem ${attached.length} ofert. W kolejnym kroku uzupełnimy dane i przygotuję szczegółowe porównanie (zakres, materiały, robocizna).`, () => advance(step));
    });
  });
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
