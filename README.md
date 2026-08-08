# Asystent Budowy Domu — prototyp

Interaktywny asystent planowania budowy domu jednorodzinnego. Prowadzi krok po kroku:
od pomysłu, przez wybór działki i analizę planu miejscowego (MPZP), po orientacyjny
koszt budowy, ocenę budżetu i porównanie ofert wykonawców.

Aplikacja jest w całości statyczna (HTML + CSS + czysty JavaScript). Odczyt plików PDF
z planem miejscowym odbywa się lokalnie w przeglądarce (biblioteka pdf.js) — żadne dane
nie opuszczają urządzenia użytkownika, aplikacja nie ma backendu ani bazy danych.

Kod aplikacji znajduje się w folderze [`asystent-budowy/`](asystent-budowy/).

## Trzy ścieżki startowe

- **Mam tylko pomysł** — doprecyzowanie wizji, orientacyjny budżet, jak szukać działki i MPZP.
- **Mam działkę** — wizja i budżet + analiza zgodności z MPZP dla konkretnej działki.
- **Mam gotowy projekt** — pełen zakres: analiza MPZP, kosztorys i materiały, porównanie ofert i kolejność prac.

## Jak uruchomić lokalnie

Aplikacja jest statyczna — wystarczy dowolny serwer plików. W repozytorium jest
pomocniczy serwer w Node.js.

### Opcja 1: Node.js (serwer pomocniczy)

W folderze projektu:

```bash
node asystent-budowy/server.cjs
```

Następnie otwórz w przeglądarce adres wypisany w konsoli (domyślnie `http://localhost:4599`).
Port można zmienić zmienną środowiskową `PORT`.

### Opcja 2: Claude Code

Otwórz folder w Claude Code i napisz do agenta: „uruchom tę aplikację".

## Publikacja (hosting)

Aplikacja jest hostowana na Netlify. Konfiguracja w [`netlify.toml`](netlify.toml)
publikuje folder `asystent-budowy` bez kroku budowania (czysty HTML/CSS/JS).
Każdy `git push` do repozytorium GitHub uruchamia automatyczny redeploy.

- Repozytorium: https://github.com/Bernard-67/budowlaniec
- Działająca aplikacja: https://grand-vacherin-0a50ac.netlify.app

## Technologie

JavaScript, HTML, CSS · biblioteka pdf.js (odczyt PDF w przeglądarce) ·
Node.js (lokalny serwer podglądu) · Git i GitHub · hosting Netlify.
Zbudowano przy użyciu Claude Code (model Claude Opus).
