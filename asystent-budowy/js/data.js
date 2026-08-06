/* =============================================================
   Asystent Budowy Domu — dane i treść prototypu
   Wszystko tu jest mockiem: żadnych wywołań API do modeli.
   Silnik (app.js) czyta te struktury i renderuje je na ekranie.
   ============================================================= */

/* --- Checklista kompletności (panel boczny) --- */
const CHECKLIST_ITEMS = [
  { key: 'preferencje', label: 'Preferencje i wizja domu' },
  { key: 'budzet',      label: 'Budżet inwestycji' },
  { key: 'dzialka',     label: 'Działka' },
  { key: 'mpzp',        label: 'Zgodność z MPZP' },
  { key: 'projekt',     label: 'Projekt budowlany' },
  { key: 'kosztorys',   label: 'Kosztorys i materiały' },
  { key: 'oferty',      label: 'Oferty i kolejność prac' },
];

/* --- Pasek postępu na górze dashboardu --- */
const PROGRESS_STEPS = [
  { key: 'pomysl',    label: 'Pomysł' },
  { key: 'dzialka',   label: 'Działka' },
  { key: 'projekt',   label: 'Projekt' },
  { key: 'mpzp',      label: 'MPZP' },
  { key: 'kosztorys', label: 'Kosztorys' },
  { key: 'oferty',    label: 'Oferty' },
];

/* --- Opis trzech etapów na ekranie startowym --- */
const STAGE_CARDS = [
  {
    id: 'brak_dzialki',
    icon: '💡',
    title: 'Mam tylko pomysł',
    subtitle: 'Bez działki i bez projektu',
    scope: ['Doprecyzowanie wizji domu', 'Orientacyjny budżet', 'Jak szukać działki i MPZP'],
    note: 'Najwcześniejszy etap — węższy zakres, prowadzimy Cię od zera.',
  },
  {
    id: 'dzialka_bez_projektu',
    icon: '📍',
    title: 'Mam działkę',
    subtitle: 'Działka jest, projektu jeszcze nie',
    scope: ['Wizja i budżet', 'Analiza zgodności z MPZP', 'Co dalej: droga do projektu'],
    note: 'Odblokowujemy analizę MPZP dla Twojej działki.',
  },
  {
    id: 'gotowy_projekt',
    icon: '📐',
    title: 'Mam gotowy projekt',
    subtitle: 'Projekt budowlany jest gotowy',
    scope: ['Analiza MPZP', 'Kosztorys i materiały', 'Porównanie ofert i kolejność prac'],
    note: 'Pełen zakres — aż po gotowy brief inwestycji.',
  },
];

/* =============================================================
   SCENARIUSZE ROZMOWY
   Każdy krok ma "type", który decyduje co renderuje silnik.
   effects.checklist -> odhacza pozycje checklisty
   effects.progress  -> ustawia węzeł paska postępu
   ============================================================= */

const STAGES = {

  /* ---------- Etap 1: sam pomysł (najwęższy zakres) ---------- */
  brak_dzialki: {
    label: 'Mam tylko pomysł',
    steps: [
      {
        type: 'text',
        text: 'Cześć! Jestem Twoim asystentem budowy domu. Skoro jesteś na samym początku — bez działki i bez projektu — spokojnie przejdziemy przez to razem, krok po kroku. Zacznijmy od Twojej wizji.',
      },
      {
        type: 'choice',
        key: 'typ_domu',
        question: 'Jaki dom najbardziej Cię interesuje?',
        allowFree: true,
        options: [
          { label: 'Parterowy', value: 'parterowy', reply: 'Parterowy — wygodny, bez schodów, ale potrzebuje większej działki.' },
          { label: 'Z poddaszem użytkowym', value: 'poddasze', reply: 'Dom z poddaszem — dobry kompromis między powierzchnią a wielkością działki.' },
          { label: 'Piętrowy', value: 'pietrowy', reply: 'Piętrowy — więcej metrów na mniejszej działce.' },
        ],
        effects: { checklist: ['preferencje'], progress: 'pomysl' },
      },
      {
        type: 'dom_params',
        intro: 'Zanim oszacuję koszt, doprecyzujmy metraż. Podaj przybliżoną **powierzchnię użytkową** domu oraz — jeśli planujesz — **powierzchnię garażu**. To wystarczy, żeby policzyć orientacyjny koszt budowy.',
        effects: { progress: 'pomysl' },
      },
      {
        type: 'koszt_standard',
        intro: 'Na podstawie metrażu i uśrednionych stawek za m² policzyłem orientacyjny koszt budowy w trzech standardach wykończenia. Wybierz ten, który Cię interesuje — wyląduje w karcie „Kosztorys i materiały” po prawej.',
        effects: { checklist: ['kosztorys'], progress: 'pomysl' },
      },
      {
        type: 'dzialka_params',
        intro: 'Skoro Twój budżet obejmuje też działkę, oszacujmy jej zakup. Podaj przybliżoną **powierzchnię działki** i **cenę za m²** w interesującej Cię okolicy — policzę łączną inwestycję (budowa + działka). Jeśli jeszcze nie wiesz, możesz pominąć.',
        effects: { progress: 'pomysl' },
      },
      {
        type: 'budzet_input',
        question: 'Jaki masz planowany budżet całkowity na inwestycję (dom + działka)? Wpisz kwotę w złotych.',
        obejmuje: 'dom + działka',
        effects: { checklist: ['budzet'], progress: 'pomysl' },
      },
      {
        type: 'budzet_ocena',
        intro: 'Zestawmy teraz szacowane koszty z Twoim budżetem.',
        effects: { progress: 'pomysl' },
      },
      {
        type: 'text',
        text: 'Skoro nie masz jeszcze działki — to najważniejszy najbliższy krok. Zanim kupisz, sprawdź czy działka ma **Miejscowy Plan Zagospodarowania Przestrzennego (MPZP)**. To dokument gminy, który mówi, co i jak można na niej zbudować. Znajdziesz go w geoportalu gminy albo w urzędzie. Bez tego łatwo kupić działkę, na której nie postawisz wymarzonego domu.',
      },
      {
        type: 'mpzp_upload',
        intro: 'Jeśli masz już upatrzoną działkę i jej **MPZP w PDF** (wypis albo tekst uchwały z geoportalu), wgraj plik — wyciągnę z niego najważniejsze dane do budowy. Przyjmuję wyłącznie PDF z warstwą tekstową. Jeśli dopiero szukasz, możesz pominąć.',
        formats: ['PDF'],
        demoFiles: [
          { name: 'mpzp_wypis_dzialka.pdf', size: '1,3 MB' },
        ],
        effects: { checklist: ['mpzp'], progress: 'pomysl' },
      },
      {
        type: 'choice',
        key: 'lokalizacja',
        question: 'W jakiej okolicy chcesz szukać działki?',
        allowFree: true,
        options: [
          { label: 'Blisko miasta', value: 'podmiejska', reply: 'Okolica podmiejska — drożej za metr, ale bliżej infrastruktury.' },
          { label: 'Na wsi / spokojnie', value: 'wies', reply: 'Spokojna okolica — więcej metrów za mniejsze pieniądze.' },
        ],
        effects: { checklist: [], progress: 'pomysl' },
      },
      {
        type: 'brief',
        effects: { progress: 'pomysl' },
      },
    ],
  },

  /* ---------- Etap 2: działka bez projektu ---------- */
  dzialka_bez_projektu: {
    label: 'Mam działkę',
    steps: [
      {
        type: 'text',
        text: 'Świetnie, że masz już działkę — to konkretny punkt zaczepienia. Najpierw dopytam o Twoją wizję i policzę orientacyjny koszt, a potem sprawdzimy, co plan miejscowy (MPZP) pozwala na niej zbudować.',
      },
      {
        type: 'choice',
        key: 'typ_domu',
        question: 'Jaki dom planujesz na tej działce?',
        allowFree: true,
        options: [
          { label: 'Parterowy', value: 'parterowy', reply: 'Parterowy — sprawdzimy, czy zmieści się na działce w liniach zabudowy.' },
          { label: 'Z poddaszem użytkowym', value: 'poddasze', reply: 'Dom z poddaszem — popularny wybór, zaraz zestawimy go z MPZP.' },
          { label: 'Piętrowy', value: 'pietrowy', reply: 'Piętrowy — kluczowa będzie dozwolona wysokość zabudowy w planie.' },
        ],
        effects: { checklist: ['preferencje'], progress: 'dzialka' },
      },
      {
        type: 'dom_params',
        intro: 'Doprecyzujmy metraż domu, który chcesz postawić na tej działce. Podaj przybliżoną **powierzchnię użytkową** i — jeśli planujesz — **powierzchnię garażu**.',
        effects: { progress: 'dzialka' },
      },
      {
        type: 'koszt_standard',
        intro: 'Na podstawie metrażu i uśrednionych stawek za m² policzyłem orientacyjny koszt budowy w trzech standardach wykończenia. Wybierz ten, który Cię interesuje.',
        effects: { checklist: ['kosztorys'], progress: 'dzialka' },
      },
      {
        type: 'dzialka_params',
        owned: true,
        intro: 'Podaj **powierzchnię swojej działki** — będzie potrzebna, żeby przeliczyć limity z MPZP (ile metrów możesz zabudować, ile zostawić na zieleń). Cenę za m² możesz podać opcjonalnie.',
        effects: { checklist: ['dzialka'], progress: 'dzialka' },
      },
      {
        type: 'budzet_input',
        question: 'Jaki masz budżet na **sam dom** (działkę już masz)? Wpisz kwotę w złotych.',
        obejmuje: 'sam dom',
        effects: { checklist: ['budzet'], progress: 'dzialka' },
      },
      {
        type: 'budzet_ocena',
        intro: 'Zestawmy policzony koszt budowy z Twoim budżetem.',
        effects: { progress: 'dzialka' },
      },
      {
        type: 'text',
        text: 'Teraz najważniejszy krok dla działki: **analiza MPZP**. Wgraj plan miejscowy (PDF) swojej działki — wyciągnę z niego kluczowe zapisy i przeliczę limity zabudowy na metry dla Twojej powierzchni. Nie masz pliku pod ręką? Użyj przykładowego.',
      },
      {
        type: 'mpzp_upload',
        intro: 'Wgraj **MPZP swojej działki w PDF** (wypis albo tekst uchwały z geoportalu). Przyjmuję wyłącznie PDF z warstwą tekstową.',
        formats: ['PDF'],
        demoFiles: [
          { name: 'mpzp_moja_dzialka.pdf', size: '1,3 MB' },
        ],
        effects: { checklist: ['mpzp'], progress: 'mpzp' },
      },
      {
        type: 'text',
        text: 'Masz już obraz tego, co plan dopuszcza, i orientacyjny koszt. Kolejny krok to **projekt budowlany** — gotowy z adaptacją albo indywidualny. Gdy będziesz mieć projekt, wróć tutaj — odblokujemy szczegółowy kosztorys i porównanie ofert. Na razie zbierzmy wszystko w brief.',
      },
      {
        type: 'brief',
        effects: { progress: 'mpzp' },
      },
    ],
  },

  /* ---------- Etap 3: gotowy projekt (pełen zakres) ---------- */
  gotowy_projekt: {
    label: 'Mam gotowy projekt',
    steps: [
      {
        type: 'text',
        text: 'Masz gotowy projekt — to znaczy, że możemy przejść przez pełną ścieżkę: sprawdzenie zgodności z MPZP, kosztorys z listą materiałów, a na końcu porównanie ofert wykonawców i kolejność prac. Zacznijmy od wczytania Twoich dokumentów.',
      },
      {
        type: 'upload',
        text: 'Wgraj pliki projektu i wszystko, co masz na temat inwestycji. Nie parsuję ich naprawdę — w prototypie pokazuję, że asystent przyjmuje wiele plików w różnych formatach.',
        formats: ['PDF', 'DWG', 'XLS', 'DOC', 'PPT', 'TXT', 'PNG', 'JPG'],
        demoFiles: [
          { name: 'projekt_domu_140m2.pdf', size: '4,2 MB' },
          { name: 'kosztorys_wstepny.xls',  size: '86 KB' },
          { name: 'dzialka_zdjecie.jpg',    size: '2,1 MB' },
        ],
        effects: { checklist: ['projekt', 'preferencje', 'budzet', 'dzialka'], progress: 'projekt' },
      },
      {
        type: 'choice',
        key: 'potwierdzenie_metrazu',
        question: 'Z projektu odczytałem: dom parterowy z poddaszem, ok. 140 m² powierzchni użytkowej, dach dwuspadowy. Zgadza się?',
        allowFree: true,
        options: [
          { label: 'Tak, zgadza się', value: 'tak', reply: 'Świetnie, przyjmuję te parametry do dalszych analiz.' },
          { label: 'Prawie — poprawię szczegóły', value: 'popraw', reply: 'Jasne, w prototypie przyjmę wartości bazowe, a Ty i tak doprecyzujesz je w kosztorysie i briefie.' },
        ],
        effects: { checklist: [], progress: 'projekt' },
      },
      {
        type: 'text',
        text: 'Teraz zestawmy projekt z **MPZP** Twojej działki. Wklej treść planu miejscowego albo użyj przykładowego, żeby zobaczyć wynik porównania.',
      },
      {
        type: 'mpzp',
        effects: { checklist: ['mpzp'], progress: 'mpzp' },
      },
      {
        type: 'text',
        text: 'Projekt jest w większości zgodny z planem — świetnie. Przejdźmy do pieniędzy: wygeneruję **szacunkowy kosztorys i listę materiałów** na podstawie parametrów z projektu. Kwoty są uśrednione (dane syntetyczne) — możesz je edytować, gdy zdobędziesz konkretne oferty.',
      },
      {
        type: 'kosztorys',
        effects: { checklist: ['kosztorys'], progress: 'kosztorys' },
      },
      {
        type: 'text',
        text: 'Masz kosztorys — teraz porównajmy **oferty wykonawców**. Wklej oferty, które zebrałeś (tekst lub skan), a ja ułożę je w porównywalną tabelę i podpowiem rozsądną kolejność prac. Nie masz ofert pod ręką? Użyj przykładowych.',
      },
      {
        type: 'oferty',
        effects: { checklist: ['oferty'], progress: 'oferty' },
      },
      {
        type: 'text',
        text: 'To wszystko, czego potrzebowałem. Na podstawie kilku Twoich odpowiedzi i wczytanych danych zbudowałem pełny, ustrukturyzowany **brief inwestycji**. Możesz doprecyzować pojedyncze pola, pobrać go albo zacząć od nowa.',
      },
      {
        type: 'brief',
        effects: { progress: 'oferty' },
      },
    ],
  },
};

/* =============================================================
   DANE POMOCNICZE I FUNKCJE LICZĄCE (mock)
   ============================================================= */

/* Przykładowy MPZP wstrzykiwany do textarea po kliknięciu "Użyj przykładowego" */
const SAMPLE_MPZP = `MIEJSCOWY PLAN ZAGOSPODAROWANIA PRZESTRZENNEGO
Teren oznaczony symbolem MN — zabudowa mieszkaniowa jednorodzinna.

§ Ustalenia szczegółowe:
1. Maksymalna wysokość zabudowy: 9,0 m.
2. Liczba kondygnacji nadziemnych: do 2 (w tym poddasze użytkowe).
3. Geometria dachu: dach dwuspadowy lub wielospadowy, kąt nachylenia 30–45°.
4. Maksymalna powierzchnia zabudowy: 30% powierzchni działki.
5. Minimalny udział powierzchni biologicznie czynnej: 50%.
6. Nieprzekraczalna linia zabudowy: 6 m od drogi.
7. Kolorystyka dachu: odcienie czerwieni, brązu lub grafitu.`;

/* Ocena zgodności z MPZP — zwraca listę pozycji do tabeli w karcie bocznej */
function evaluateMpzp() {
  return {
    summary: 'Projekt jest w większości zgodny z planem. 1 pozycja wymaga uwagi.',
    rows: [
      { param: 'Przeznaczenie terenu',        plan: 'MN — jednorodzinna',      projekt: 'Dom jednorodzinny',        status: 'ok' },
      { param: 'Wysokość zabudowy',           plan: 'maks. 9,0 m',             projekt: '8,4 m',                    status: 'ok' },
      { param: 'Liczba kondygnacji',          plan: 'do 2 (z poddaszem)',      projekt: 'parter + poddasze',        status: 'ok' },
      { param: 'Geometria dachu',             plan: 'dwuspadowy, 30–45°',      projekt: 'dwuspadowy, 40°',          status: 'ok' },
      { param: 'Powierzchnia zabudowy',       plan: 'maks. 30% działki',       projekt: '24% działki',              status: 'ok' },
      { param: 'Pow. biologicznie czynna',    plan: 'min. 50%',                projekt: '48%',                      status: 'uwaga' },
      { param: 'Linia zabudowy od drogi',     plan: 'min. 6 m',                projekt: '6,5 m',                    status: 'ok' },
    ],
  };
}

/* -------------------------------------------------------------
   Odczyt MPZP: parser tekstu (z pdf.js albo z SAMPLE_MPZP) do
   kluczowych parametrów. Zwraca wiersze z flagą `found` (co znaleziono,
   a czego w dokumencie nie ma) oraz procenty do przeliczeń dla działki.
   ------------------------------------------------------------- */
const MPZP_TYP_NOTE = {
  parterowy: 'Dom parterowy jest dopuszczalny — pilnuj tylko powierzchni zabudowy, bo parterowiec ma duży rzut.',
  poddasze:  'Dom z poddaszem użytkowym mieści się wprost w zapisach planu (do 2 kondygnacji, dach spadzisty).',
  pietrowy:  'Dom piętrowy zmieści się w limicie wysokości i liczby kondygnacji.',
};

function parseMpzpText(raw) {
  // Normalizacja: „ż” bywa w tych fontach mapowane na „Ŝ/ŝ”; ujednolicamy spacje.
  const t = String(raw || '').replace(/[Ŝŝ]/g, 'ż').replace(/\s+/g, ' ');
  const m = re => t.match(re);
  const rows = [];
  const percent = { zabudowa: null, biolCzynna: null };
  const add = (param, wartosc) => rows.push({ param, wartosc: wartosc || 'nie określono w dokumencie', found: !!wartosc });

  // Przeznaczenie
  let przezn = null;
  if (/\bMN\s*\/\s*U\b/i.test(t) || /jednorodzinn\w* z us[łl]ug/i.test(t)) przezn = 'MN/U — jednorodzinna z usługami';
  else if (/\bMN\b/i.test(t) || /mieszkaniow\w* jednorodzinn/i.test(t)) przezn = 'MN — zabudowa jednorodzinna';
  add('Przeznaczenie terenu', przezn);

  // Wysokość w metrach (tylko gdy wprost o budynku/zabudowie)
  let wys = null;
  const mw = m(/wysoko\S*\s+(?:budynku\s+mieszkalnego|zabudowy|budynku)[^.]{0,40}?(\d{1,2}(?:[.,]\d)?)\s*m(?![\w²2])/i);
  if (mw) wys = 'maks. ' + mw[1].replace('.', ',') + ' m';
  add('Wysokość zabudowy', wys);

  // Liczba kondygnacji
  let kond = null;
  const mk = m(/(\d+)\s+kondygnacj/i) || m(/kondygnacj\w*[^.\d]{0,25}(\d+)/i);
  if (mk) kond = 'do ' + mk[1] + (/poddasz/i.test(t) ? ' (w tym poddasze)' : '');
  add('Liczba kondygnacji', kond);

  // Geometria dachu
  const dachShape = /dwu\s*(?:-|lub|i|\/)?\s*wielospadow/i.test(t) ? 'dwu-/wielospadowy'
                  : /dwuspadow/i.test(t) ? 'dwuspadowy'
                  : /wielospadow/i.test(t) ? 'wielospadowy' : null;
  let dachAngle = null;
  const ma = m(/(\d{2})\s*[-–]\s*(\d{2})\s*(?:°|stopni|st\.)/);
  if (ma) dachAngle = ma[1] + '–' + ma[2] + '°';
  else if (/równym?\s+k[ąa]c/i.test(t)) dachAngle = 'równy kąt';
  let dachVal = null;
  if (dachShape) dachVal = dachShape + (dachAngle ? ', ' + dachAngle : '')
    + (/zakaz[^.]{0,30}dach\w*[^.]{0,12}p[łl]askich/i.test(t) ? '; zakaz płaskich' : '');
  add('Geometria dachu', dachVal);

  // Maks. powierzchnia zabudowy [%]
  let zab = null;
  const mz = m(/powierzchni\w*\s+zabudowy[^.]{0,40}?(\d{1,3})\s*%/i);
  if (mz) { zab = 'maks. ' + mz[1] + '%'; percent.zabudowa = parseInt(mz[1], 10); }
  add('Maks. powierzchnia zabudowy', zab);

  // Min. powierzchnia biologicznie czynna [%]
  let biol = null;
  const mb = m(/(?:biologicznie\s+czynn\S*|aktywn\S*\s+przyrodniczo)[^.]{0,60}?(\d{1,3})\s*%/i)
          || m(/(\d{1,3})\s*%[^.]{0,40}?(?:biologicznie\s+czynn|przyrodniczo)/i);
  if (mb) { biol = 'min. ' + mb[1] + '%'; percent.biolCzynna = parseInt(mb[1], 10); }
  add('Min. pow. biologicznie czynna', biol);

  // Linia zabudowy
  let linia = null;
  const ml = m(/nieprzekraczaln\S*\s+lini\S*\s+zabudowy[^.]{0,40}?(\d{1,3}(?:[.,]\d)?)\s*m\b/i);
  if (ml) linia = 'min. ' + ml[1].replace('.', ',') + ' m';
  else if (/nieprzekraczaln\S*\s+lini\S*\s+zabudowy/i.test(t)) linia = 'wg rysunku planu';
  add('Linia zabudowy', linia);

  // Bonusy — tylko gdy realnie znalezione
  const mf = m(/front\w*\s+dzia[łl]ki[^.]{0,40}?(\d{1,3})\s*m\b/i);
  if (mf) rows.push({ param: 'Min. szerokość frontu działki', wartosc: mf[1] + ' m', found: true });
  const mo = m(/ogrodze\w*[^.]{0,60}?(?:maksimum|maks\w*|max\.?|do)\s*(\d(?:[.,]\d)?)\s*m\b/i);
  if (mo) rows.push({ param: 'Maks. wysokość ogrodzeń', wartosc: mo[1].replace('.', ',') + ' m', found: true });
  const mg = m(/(?:gospodarcz|us[łl]ug)\w*[^.]{0,60}?(\d{2,3})\s*m\s*2\b/i) || m(/(\d{2,3})\s*m\s*2\b[^.]{0,40}?(?:gospodarcz|us[łl]ug)/i);
  if (mg) rows.push({ param: 'Maks. pow. bud. gospodarczego', wartosc: mg[1] + ' m²', found: true });

  const foundCount = rows.filter(r => r.found).length;
  return { rows, percent, foundCount };
}

/* Kosztorys — pozycje z uśrednionymi kwotami; edytowalne w UI */
function computeKosztorys() {
  return [
    { key: 'zerowy',      pozycja: 'Stan zerowy (fundamenty, izolacje)',        kwota: 85000 },
    { key: 'surowy_o',    pozycja: 'Stan surowy otwarty (ściany, strop, dach)', kwota: 210000 },
    { key: 'surowy_z',    pozycja: 'Stan surowy zamknięty (okna, drzwi zewn.)', kwota: 95000 },
    { key: 'instalacje',  pozycja: 'Instalacje (elektr., wod-kan, ogrzewanie)', kwota: 120000 },
    { key: 'wykonczenie', pozycja: 'Wykończenie wnętrz',                        kwota: 160000 },
    { key: 'teren',       pozycja: 'Zagospodarowanie terenu',                   kwota: 45000 },
  ];
}

/* -------------------------------------------------------------
   Kalkulator kosztu wg standardu wykończenia (mock).
   Stawki uśrednione zł/m² — koszt budowy „pod klucz”, dane orientacyjne.
   ------------------------------------------------------------- */
const BUILD_STANDARDS = [
  {
    key: 'niski',
    label: 'Niski (ekonomiczny)',
    rateDom: 4200,
    rateGaraz: 2600,
    opis: 'Materiały podstawowe, proste rozwiązania, wykończenie budżetowe.',
  },
  {
    key: 'sredni',
    label: 'Średni (optymalny)',
    rateDom: 5600,
    rateGaraz: 3200,
    opis: 'Dobre materiały i popularne technologie — zbalansowana jakość do ceny.',
    featured: true,
  },
  {
    key: 'wysoki',
    label: 'Wysoki (premium)',
    rateDom: 7800,
    rateGaraz: 4300,
    opis: 'Materiały wysokiej jakości, rozwiązania energooszczędne, bogate wykończenie.',
  },
];

/* Liczy koszt dla każdego standardu na podstawie powierzchni (m²) */
function computeCostByStandard(powUzytkowa, powGarazu) {
  const pu = Number(powUzytkowa) || 0;
  const pg = Number(powGarazu) || 0;
  return BUILD_STANDARDS.map(s => {
    const kosztDom = s.rateDom * pu;
    const kosztGaraz = s.rateGaraz * pg;
    return {
      key: s.key,
      label: s.label,
      opis: s.opis,
      featured: !!s.featured,
      rateDom: s.rateDom,
      rateGaraz: s.rateGaraz,
      kosztDom,
      kosztGaraz,
      total: kosztDom + kosztGaraz,
    };
  });
}

/* -------------------------------------------------------------
   Ocena budżetu — zestawienie kosztu budowy z zadeklarowanym budżetem.
   Progi w zł. `obejmuje` mówi, co budżet ma pokryć (wpływa na komentarz).
   ------------------------------------------------------------- */
const BUDGET_BOUNDS = {
  '600':  { min: 0,      max: 600000,  label: 'do 600 tys. zł',      obejmuje: 'dom + działka' },
  '900':  { min: 600000, max: 900000,  label: '600–900 tys. zł',     obejmuje: 'dom + działka' },
  '900+': { min: 900000, max: null,    label: 'powyżej 900 tys. zł', obejmuje: 'dom + działka' },
  '500':  { min: 0,      max: 500000,  label: 'do 500 tys. zł',      obejmuje: 'sam dom' },
  '800':  { min: 500000, max: 800000,  label: '500–800 tys. zł',     obejmuje: 'sam dom' },
  '800+': { min: 800000, max: null,    label: 'powyżej 800 tys. zł', obejmuje: 'sam dom' },
};

/* Best-effort parsowanie budżetu z tekstu swobodnego, np. „700 tys”, „1,2 mln”, „650000” */
function parseBudgetFreeText(txt) {
  if (typeof txt !== 'string') return null;
  const t = txt.toLowerCase();
  const m = t.replace(/\s/g, '').match(/\d+[.,]?\d*/);
  if (!m) return null;
  let n = parseFloat(m[0].replace(',', '.'));
  if (!n) return null;
  if (/mln|milion/.test(t)) n *= 1000000;
  else if (/tys|tyś/.test(t)) n *= 1000;
  else if (n < 10000) n *= 1000; // „700” → zakładamy 700 tys.
  return Math.round(n) || null;
}

/* Zwraca werdykt: status ok | over | open | unknown + liczby do komentarza i wskaźnika.
   budgetValue: dokładna kwota (liczba), klucz z BUDGET_BOUNDS albo tekst swobodny.
   obejmujeOverride: co budżet ma pokryć (np. „dom + działka”) — nadpisuje wartość z progu. */
function assessBudget(cost, budgetValue, obejmujeOverride) {
  let b = BUDGET_BOUNDS[budgetValue];
  if (!b) {
    // dokładna kwota (liczba) albo tekst swobodny („700 tys”, „1,2 mln”)
    const parsed = (typeof budgetValue === 'number' && isFinite(budgetValue))
      ? budgetValue
      : parseBudgetFreeText(budgetValue);
    if (parsed == null) return { status: 'unknown', cost };
    b = { min: 0, max: parsed, label: formatPln(parsed), obejmuje: null, exact: true };
  }
  const out = {
    status: '', cost,
    budgetLabel: b.label, budgetMin: b.min, budgetMax: b.max,
    obejmuje: obejmujeOverride || b.obejmuje, exact: !!b.exact,
  };
  if (b.max == null) {
    out.status = 'open';
    out.pct = 0;
  } else if (cost > b.max) {
    out.status = 'over';
    out.overBy = cost - b.max;
    out.pct = 1;
  } else {
    out.status = 'ok';
    out.margin = b.max - cost;
    out.pct = cost / b.max;
  }
  return out;
}

/* Przykładowe oferty wstrzykiwane do textarea */
const SAMPLE_OFERTY = `Oferta A — "BudDom Sp. z o.o."
Zakres: stan surowy zamknięty. Cena: 385 000 zł. Termin: 7 miesięcy. Gwarancja 5 lat. Materiały po stronie wykonawcy.

Oferta B — "Ekipa Kowalski"
Zakres: stan surowy otwarty. Cena: 250 000 zł. Termin: 5 miesięcy. Bez okien i drzwi. Materiały po stronie inwestora.

Oferta C — "SolidBud"
Zakres: stan surowy zamknięty + instalacje. Cena: 520 000 zł. Termin: 9 miesięcy. Gwarancja 3 lata.`;

/* Porównanie ofert -> tabela + rekomendowana kolejność prac */
function buildOffersComparison() {
  return {
    rows: [
      { wykonawca: 'BudDom Sp. z o.o.', zakres: 'Stan surowy zamknięty',            cena: 385000, termin: '7 mies.', kompletnosc: 'Pełna',    material: 'Wykonawca' },
      { wykonawca: 'Ekipa Kowalski',    zakres: 'Stan surowy otwarty',              cena: 250000, termin: '5 mies.', kompletnosc: 'Częściowa', material: 'Inwestor' },
      { wykonawca: 'SolidBud',          zakres: 'Surowy zamknięty + instalacje',    cena: 520000, termin: '9 mies.', kompletnosc: 'Rozszerzona', material: 'Wykonawca' },
    ],
    uwaga: 'Oferty mają różny zakres — bezpośrednie porównanie ceny jest mylące. Najbliższa Twojemu zapotrzebowaniu jest oferta BudDom (pełny zakres surowy zamknięty).',
    kolejnosc: [
      'Prace ziemne i fundamenty (stan zerowy)',
      'Ściany, stropy i konstrukcja dachu (stan surowy otwarty)',
      'Pokrycie dachu, okna i drzwi zewnętrzne (stan surowy zamknięty)',
      'Instalacje: elektryczna, wod-kan, ogrzewanie',
      'Tynki, wylewki i wykończenie wnętrz',
      'Zagospodarowanie terenu i elewacja',
    ],
  };
}

/* -------------------------------------------------------------
   Brief końcowy — funkcja buduje sekcje na podstawie stanu.
   Zakres sekcji zależy od etapu (adaptacyjność aplikacji).
   ------------------------------------------------------------- */
function generateBrief(state) {
  const a = state.answers || {};

  // Pomocniczo: czytelne etykiety z odpowiedzi
  const typDomuMap = {
    parterowy: 'dom parterowy',
    poddasze:  'dom z poddaszem użytkowym',
    pietrowy:  'dom piętrowy',
  };
  const budzetMap = {
    '600':  'do 600 tys. zł (dom + działka)',
    '900':  '600–900 tys. zł (dom + działka)',
    '900+': 'powyżej 900 tys. zł (dom + działka)',
    '500':  'do 500 tys. zł (sam dom)',
    '800':  '500–800 tys. zł (sam dom)',
    '800+': 'powyżej 800 tys. zł (sam dom)',
  };

  const typDomu = typDomuMap[a.typ_domu] || (a.typ_domu ? `„${a.typ_domu}”` : 'dom jednorodzinny');
  let budzet;
  if (typeof a.budzet === 'number') {
    budzet = `${formatPln(a.budzet)}${state.budzetObejmuje ? ` (${state.budzetObejmuje})` : ''}`;
  } else {
    budzet = budzetMap[a.budzet] || (a.budzet ? `„${a.budzet}”` : 'do ustalenia');
  }

  // Zbierzmy dosłowne wypowiedzi użytkownika (kontrast: 2 zdania -> pełny brief).
  // Pomijamy wartości strukturalne/liczbowe (metraż, standard, budżet) — nie są cytatami.
  const QUOTE_SKIP = ['powUzytkowa', 'powGarazu', 'standard', 'budzet'];
  const cytaty = Object.entries(a).filter(([k, v]) => v && !QUOTE_SKIP.includes(k)).map(([, v]) => v);
  const cytatBlok = cytaty.length
    ? cytaty.map(c => `„${c}”`).join(' · ')
    : 'brak dodatkowych wypowiedzi';

  const sekcje = [];

  sekcje.push({
    id: 'kontekst',
    title: '1. Opis problemu / kontekst',
    text: `Inwestor indywidualny planuje budowę domu jednorodzinnego na własne potrzeby. Punktem wyjścia były krótkie odpowiedzi (${cytatBlok}), które asystent rozwinął w ustrukturyzowany opis inwestycji. Celem jest przejście przez planowanie budowy bez wcześniejszej wiedzy technicznej i formalnej — od wizji domu po gotowy plan działania.`,
  });

  sekcje.push({
    id: 'profil',
    title: '2. Profil inwestora',
    text: `Osoba prywatna budująca dla siebie (nie deweloper). Preferowany typ zabudowy: ${typDomu}. Zakładany budżet: ${budzet}. Etap wejścia do procesu: „${STAGES[state.stage].label}”, co określa dostępny zakres analiz.`,
  });

  sekcje.push({
    id: 'zakres',
    title: '3. Zakres i parametry inwestycji',
    text: state.stage === 'gotowy_projekt'
      ? 'Dom parterowy z poddaszem użytkowym, ok. 140 m² powierzchni użytkowej, dach dwuspadowy (nachylenie 40°), wysokość 8,4 m. Parametry odczytane z wgranego projektu budowlanego.'
      : (a.powUzytkowa
          ? `Preferowany typ: ${typDomu}. Zakładana powierzchnia użytkowa: ${formatNum(a.powUzytkowa)} m²${a.powGarazu > 0 ? `, garaż ${formatNum(a.powGarazu)} m²` : ' (bez garażu)'}.${state.dzialka ? ` Działka: ${formatNum(state.dzialka.area)} m²${state.dzialka.owned ? ' (posiadana)' : ''}.` : ''} Pozostałe parametry (liczba kondygnacji, dach) do ustalenia na etapie projektu budowlanego.`
          : `Preferowany typ: ${typDomu}. Szczegółowe parametry (metraż, liczba kondygnacji, dach) zostaną ustalone na etapie projektu budowlanego.`),
  });

  if (state.progress && progressIndex(state.progress) >= progressIndex('mpzp') || state.checklist.mpzp) {
    let mpzpText;
    if (state.mpzp && state.mpzp.parsed) {
      const p = state.mpzp.parsed;
      const found = p.rows.filter(r => r.found).map(r => `${r.param.toLowerCase()}: ${r.wartosc}`);
      mpzpText = `Odczytano z ${state.mpzp.sourceLabel}. Kluczowe ustalenia: ${found.join('; ')}.`;
      const dz = state.dzialka;
      if (dz && dz.area && (p.percent.biolCzynna != null || p.percent.zabudowa != null)) {
        const bits = [];
        if (p.percent.zabudowa != null) bits.push(`maks. ${formatNum(Math.round(dz.area * p.percent.zabudowa / 100))} m² zabudowy`);
        if (p.percent.biolCzynna != null) bits.push(`min. ${formatNum(Math.round(dz.area * p.percent.biolCzynna / 100))} m² zieleni`);
        mpzpText += ` Dla działki ${formatNum(dz.area)} m²: ${bits.join(', ')}.`;
      }
    } else if (state.stage === 'gotowy_projekt') {
      mpzpText = 'Zabudowa mieszkaniowa jednorodzinna (MN). Kluczowe ustalenia planu spełnione: wysokość ≤ 9 m, dach dwuspadowy 30–45°, powierzchnia zabudowy w limicie. Uwaga: powierzchnia biologicznie czynna (48%) jest tuż poniżej wymaganych 50% — do skorygowania na etapie projektu zagospodarowania działki.';
    } else {
      mpzpText = 'Działka w terenie MN (zabudowa jednorodzinna). Plan dopuszcza: wysokość do 9 m, do 2 kondygnacji (z poddaszem), dach dwuspadowy 30–45°, powierzchnię zabudowy do 30% działki, min. 50% powierzchni biologicznie czynnej i linię zabudowy min. 6 m od drogi.';
      const dz = state.dzialka;
      if (dz && dz.area) {
        mpzpText += ` Dla działki ${formatNum(dz.area)} m² oznacza to maks. ${formatNum(Math.round(0.30 * dz.area))} m² zabudowy i min. ${formatNum(Math.round(0.50 * dz.area))} m² zieleni.`;
      }
    }
    sekcje.push({ id: 'mpzp', title: '4. Zgodność z MPZP', text: mpzpText });
  }

  if (state.checklist.kosztorys) {
    const ks = state.kosztStandard;
    let kosztText;
    if (ks) {
      const dz = state.dzialka;
      kosztText = `Orientacyjny koszt budowy (standard ${ks.label.toLowerCase()}): ${formatPln(ks.total)}. Wyliczony z powierzchni użytkowej ${formatNum(ks.powUzytkowa)} m²${ks.powGarazu > 0 ? ` i garażu ${formatNum(ks.powGarazu)} m²` : ''} na uśrednionych stawkach za m² (dane syntetyczne).`;
      if (dz && !dz.owned) kosztText += ` Szacowany zakup działki (${formatNum(dz.area)} m² × ${formatNum(dz.pricePerM2)} zł/m²): ${formatPln(dz.cost)}. Łączna inwestycja (dom + działka): ${formatPln(ks.total + dz.cost)}.`;
      kosztText += ' Do uściślenia po powstaniu projektu i zebraniu ofert.';
    } else {
      kosztText = `Szacunkowy koszt realizacji: ${formatPln(state.kosztorysSuma || 715000)}. Największe pozycje: stan surowy otwarty i wykończenie wnętrz. Kwoty uśrednione (dane syntetyczne), do korekty w miarę zbierania ofert.`;
    }
    sekcje.push({ id: 'kosztorys', title: '5. Kosztorys i materiały', text: kosztText });
  }

  if (state.checklist.oferty) {
    sekcje.push({
      id: 'oferty',
      title: '6. Oferty i kolejność prac',
      text: 'Zebrano 3 oferty o różnym zakresie — bezpośrednie porównanie ceny jest mylące. Najbliższa zapotrzebowaniu: BudDom (pełny stan surowy zamknięty). Rekomendowana kolejność prac: stan zerowy → surowy otwarty → surowy zamknięty → instalacje → wykończenie → zagospodarowanie terenu.',
    });
  }

  // Zawsze na końcu: następne kroki (adaptacyjnie)
  const nastepne = {
    brak_dzialki: 'Znajdź i zweryfikuj działkę (sprawdź MPZP przed zakupem), a potem wróć — odblokujemy analizę planu i kolejne etapy.',
    dzialka_bez_projektu: 'Zdobądź projekt budowlany (gotowy + adaptacja lub indywidualny). Po jego wgraniu odblokujemy kosztorys i porównanie ofert.',
    gotowy_projekt: 'Wybierz wykonawcę na podstawie porównania ofert, skoryguj kosztorys wg realnych cen i pilnuj kolejności prac. Wracaj, by aktualizować dane w trakcie budowy.',
  };
  sekcje.push({
    id: 'nastepne',
    title: `${sekcje.length + 1}. Rekomendowane następne kroki`,
    text: nastepne[state.stage],
  });

  return sekcje;
}

/* --- drobne utilsy używane też w app.js --- */
function progressIndex(key) {
  return PROGRESS_STEPS.findIndex(s => s.key === key);
}
function formatPln(n) {
  return new Intl.NumberFormat('pl-PL').format(Math.round(n)) + ' zł';
}
