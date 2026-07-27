// Mój Koszyk - prosta aplikacja sklepowa.
// Wczytuje produkty, pozwala dodać je do koszyka i pokazuje sumę do zapłaty.

const koszyk = [];

// Pobiera listę produktów z pliku z danymi i pokazuje je jako przyciski.
async function wczytajProdukty() {
  const odpowiedz = await fetch('./products.json');
  const produkty = await odpowiedz.json();

  const listaProduktow = document.getElementById('lista-produktow');
  listaProduktow.innerHTML = '';

  produkty.forEach((produkt) => {
    const przycisk = document.createElement('button');
    przycisk.className = 'produkt';
    przycisk.innerHTML =
      `<span class="produkt-nazwa">${produkt.nazwa}</span>` +
      `<span class="produkt-cena">${produkt.cena} zł</span>`;
    przycisk.addEventListener('click', () => dodajDoKoszyka(produkt));
    listaProduktow.appendChild(przycisk);
  });
}

// Dodaje wybrany produkt do koszyka i odświeża widok koszyka.
function dodajDoKoszyka(produkt) {
  koszyk.push(produkt);
  pokazKoszyk();
}

// Pokazuje produkty z koszyka i liczy sumę do zapłaty.
function pokazKoszyk() {
  const listaKoszyka = document.getElementById('lista-koszyka');
  listaKoszyka.innerHTML = '';

  if (koszyk.length === 0) {
    listaKoszyka.innerHTML =
      '<li class="pusty">Koszyk jest pusty — kliknij produkt, aby dodać.</li>';
  }

  let suma = 0;
  koszyk.forEach((produkt) => {
    const element = document.createElement('li');
    element.innerHTML =
      `<span>${produkt.nazwa}</span><span>${produkt.cena} zł</span>`;
    listaKoszyka.appendChild(element);
    suma = suma + produkt.cena;
  });

  document.getElementById('suma').textContent = suma;
}

// Uruchomienie aplikacji po otwarciu strony.
wczytajProdukty();
pokazKoszyk();
