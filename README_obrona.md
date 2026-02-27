# GeoDiary – uzasadnienie struktury i wzorców (do obrony)

Dokument zawiera **wyłącznie** uzasadnienie: dlaczego poszczególne pliki mają taką strukturę i dlaczego zastosowane w nich rozwiązania są **dobrymi wzorcami** do obrony przed recenzentem.

---

## Wprowadzenie

Projekt celowo nie używa frameworka ani bundlera (Vanilla JS). Wybory strukturalne wynikają z zasady **jednej odpowiedzialności**, **jednego źródła prawdy** oraz **niskiego sprzężenia** – tak aby każdą decyzję dało się obronić merytorycznie.

---

## Plik po pliku: struktura i dlaczego to dobry wzorzec

### Konfiguracja i repozytorium

| Plik | Struktura | Dlaczego to dobry wzorzec |
|------|-----------|---------------------------|
| **`.gitignore`** | Grupowanie wpisów w bloki (OS, IDE, logi, env, node_modules). | Ułatwia utrzymanie i rozszerzanie; recenzent widzi, że repozytorium jest uporządkowane i że nie commitujemy śmieci. |
| **`package.json`** | Minimalna zawartość: jeden skrypt `dev`, jedna devDependency (`serve`). | **Dobry wzorzec:** brak zbędnych zależności – aplikacja nie wymaga bundlera ani transpilacji. Świadoma decyzja: mniej punktów awarii i prostsza obrona „co i po co jest w projekcie”. |
| **`package-lock.json`** | Drzewo zależności npm (wygenerowane). | Lockfile gwarantuje **reprodukowalność** instalacji – ten sam `npm install` daje te same wersje na każdej maszynie. To standard dobrej praktyki w projektach Node. |
| **`manifest.json`** | Sekcje: name, start_url, scope, display, theme_color, icons. Ścieżki względne (`./`, `./icons/`). | **Dobry wzorzec:** zgodność ze specyfikacją Web App Manifest; względne ścieżki umożliwiają hostowanie w podkatalogu (np. GitHub Pages) bez zmiany pliku. Jedna konfiguracja PWA w jednym miejscu. |

---

### Service Worker

| Plik | Struktura | Dlaczego to dobry wzorzec |
|------|-----------|---------------------------|
| **`sw.js`** | Obsługa zdarzeń `install` → `activate` → `fetch`. Stałe: `STATIC_CACHE`, `DYNAMIC_CACHE`, `STATIC_ASSETS`. Funkcje pomocnicze: `networkFirst`, `cacheFirst`. Dla nawigacji – fallback po URL bez query oraz `offline.html`. | **Dobry wzorzec:** struktura odzwierciedla **cykl życia** Service Workera (install/activate/fetch). Wydzielenie strategii cache do osobnych funkcji ułatwia czytanie i obronę wyboru „Network First”. Lista `STATIC_ASSETS` w jednym miejscu – łatwa aktualizacja bez grzebania w logice. `Promise.allSettled` przy instalacji – jeden błąd (np. 404) nie blokuje rejestracji SW. |

---

### Widoki HTML

| Plik | Struktura | Dlaczego to dobry wzorzec |
|------|-----------|---------------------------|
| **`index.html`** | `<body data-page="index">`, header, main, sekcja z jednym kontenerem `#entries-list` i FAB. Skrypty: db.js → ui.js → app.js. | **Dobry wzorzec:** atrybut **`data-page`** to **jedno źródło prawdy** dla routingu – wykrywanie strony nie zależy od obecności elementów w DOM (kruche). Kolejność skryptów: najpierw warstwa danych, potem UI, na końcu orkiestrator – czytelna zależność bez „magii”. |
| **`add.html`** | `<body data-page="add">`. Formularz: pola (tytuł, opis, data) → blok przycisków urządzeniowych (lokalizacja, kamera) → podgląd lokalizacji/zdjęcia → przycisk „Zapisz”. Skrypty: db, location, camera, app. | **Dobry wzorzec:** rozdzielenie **danych wejściowych** (pola formularza) od **akcji urządzenia** (GPS, kamera). Ładowane są tylko skrypty potrzebne na tej stronie – mniej kodu w pamięci. Struktura formularza odpowiada przepływowi użytkownika. |
| **`details.html`** | `<body data-page="details">`. Kontenery: `#entry-details`, `#map`, `.entry-details__actions`. Leaflet z CDN przed skryptami aplikacji. | **Dobry wzorzec:** oddzielne kontenery na treść wpisu, mapę i akcje – **UI może być wypełniane niezależnie** (np. brak współrzędnych → ukryta mapa, komunikat). Leaflet tylko na tej stronie, nie na całej aplikacji – oszczędność i jasna odpowiedzialność strony. |
| **`offline.html`** | `<body data-page="offline">`. Minimalna treść: komunikat + przycisk „Wróć do listy”. Skrypty: db, app (bez ui/location/camera). | **Dobry wzorzec:** strona fallback jest **lekka i samowystarczalna** – działa nawet przy ograniczonym cache. Brak zależności od listy/szczegółów – zmniejsza ryzyko błędów przy braku sieci. |

---

### JavaScript – logika aplikacji

| Plik | Struktura | Dlaczego to dobry wzorzec |
|------|-----------|---------------------------|
| **`js/app.js`** | IIFE, `'use strict'`. Na górze stałe: **PAGE**, **SELECTORS**. Zmienne stanu strony add (lokalizacja, zdjęcie, strumień kamery). Funkcje: `initApp()` (routing po `data-page`), `seedDemoDataIfEmpty()`, `setupAddPageIfActive()`, handlery (save, location, camera), `getEntryIdFromUrl()`, `loadDetailsPageIfActive()`, `deleteEntryAndRedirect()`. Na końcu ekspozycja `window.geoDiaryApp`. | **Dobry wzorzec:** **PAGE i SELECTORS** – brak „magicznych stringów”; zmiana id/nazwy strony w jednym miejscu. **Routing po `data-page`** – jedna czytelna gałąź (index/add/details), łatwa do opisania i testowania. **Jeden punkt wejścia** – `initApp()` inicjuje bazę i wywołuje właściwy flow; brak rozproszenia logiki. **Brak powielania `initDB()`** – baza otwierana tylko w `initApp()`, seed tylko sprawdza pustość i dociąga dane. Komentarze przy `catch` (sessionStorage, decodeURIComponent) – brak „połykania” błędów; recenzent widzi świadome obsługiwanie wyjątków. Użycie **const/let** – spójność z nowoczesnym JS i zakresem blokowym. |
| **`js/db.js`** | IIFE. Stałe: DB_NAME, DB_VERSION, STORE_NAME. Jedna referencja `db`. Funkcje: `initDB()`, `getStore()`, `addEntry()`, `getAllEntries()`, `getEntryById()`, `deleteEntry()`, `isDBEmpty()`. API wystawione jako `window.geoDiaryDB`. | **Dobry wzorzec:** **jedna odpowiedzialność** – tylko dostęp do IndexedDB. Reszta aplikacji nie zna transakcji ani struktury store’ów. **initDB() idempotentne** – wielokrotne wywołanie nie tworzy drugiego połączenia. Czyste API (Promise), brak logiki UI – łatwe do testowania i zmiany implementacji. |
| **`js/ui.js`** | IIFE. Stałe komunikatów + **CONTAINER_IDS** (entries-list, entry-details). Funkcje: `shortenDescription`, `renderEntryCard`, `handleEntriesListClick`, `renderEntriesList`, `formatCreatedAt`, `renderEntryDetails`, `renderDetailsError`. Jeden listener na kontenerze listy (delegacja). | **Dobry wzorzec:** **CONTAINER_IDS** – brak literałów id w wielu miejscach; spójność z app.js. **Delegacja zdarzeń** na `#entries-list` – jeden listener zamiast N na kartach; mniej pamięci, lepsza praktyka przy dynamicznej liście. Rozdzielenie od **db.js** – zmiana wyglądu nie wymaga ruszania warstwy danych. **Revoke ObjectURL** przy zdjęciu w szczegółach – unikanie wycieków pamięci. |
| **`js/location.js`** | IIFE. Jedna funkcja `getCurrentLocation()` zwracająca Promise. Opcje geolokalizacji i mapowanie kodów błędów na czytelne komunikaty. API: `window.geoDiaryLocation`. | **Dobry wzorzec:** **jedna odpowiedzialność** – tylko Geolocation API. Promise + spójne błędy – łatwa integracja w app.js (`await`, try/catch). Izolacja od UI – testowanie „czy GPS działa” bez formularza. |
| **`js/camera.js`** | IIFE. Trzy funkcje: `startCamera(videoEl)`, `capturePhoto(videoEl, canvasEl)`, `stopCamera(stream)`. Preferencja `facingMode: 'environment'` z fallbackiem. API: `window.geoDiaryCamera`. | **Dobry wzorzec:** **podział zgodny z cyklem życia** kamery (start → capture → stop). Izolacja MediaDevices – app.js tylko wywołuje API i przekazuje elementy DOM. Fallback przy braku `environment` – działa na różnych urządzeniach bez łamania kodu. |

---

### Style i dane

| Plik | Struktura | Dlaczego to dobry wzorzec |
|------|-----------|---------------------------|
| **`css/style.css`** | `:root` z zmiennymi (kolory, cienie, radius, header-height). Sekcje: reset, header, main, section, entries-list, card, btn, form, photo-preview, entry-details, offline-message. Na końcu media query (min-width: 600px). | **Dobry wzorzec:** **zmienne CSS** – jedna paleta i spójne wymiary; zmiana motywu w jednym miejscu. **Mobile-first** – styl bazowy pod małe ekrany, rozszerzenie w media query. Sekcje odpowiadają komponentom z HTML – łatwe odnalezienie stylu dla danego widoku. |
| **`data/demo.json`** | Tablica obiektów; każdy ma pola zgodne z modelem wpisu (id, title, description, date, latitude, longitude, accuracy, imageFile, createdAt). | **Dobry wzorzec:** **schemat zgodny z IndexedDB** – seed w app.js może bez mapowania wstawiać wpisy (tylko image ładowane z pliku). Łatwa edycja danych startowych bez zmiany kodu. |
| **`images/README.txt`** | Krótki opis: które pliki (demo-1.jpg itd.) odpowiadają którym id z demo.json. | **Dobry wzorzec:** **dokumentacja mapowania** – brak „magii” przy dodawaniu lub podmianie zdjęć demo; recenzent widzi świadome zarządzanie zasobami. |

---

### Dokumentacja

| Plik | Struktura | Dlaczego to dobry wzorzec |
|------|-----------|---------------------------|
| **`docs/WZORCE_I_REFACTOR.md`** | Dla każdego zagadnienia: stan → dlaczego recenzent może kwestionować → kontekst/rekomendacja. Na końcu: podsumowanie i lista zastosowanych poprawek. | **Dobry wzorzec:** pokazuje **świadome podejście do jakości** – zamiast ignorować uwagi, projekt je udokumentował i wdrożył. Format ułatwia rozmowę z recenzentem („w punkcie X zrobiliśmy Y, bo…”). |

---

## Podsumowanie wzorców do obrony

1. **Jedno źródło prawdy** – `data-page` dla routingu, PAGE/SELECTORS/CONTAINER_IDS dla identyfikatorów, lista STATIC_ASSETS w SW.
2. **Jedna odpowiedzialność** – db.js tylko baza, ui.js tylko render, location/camera tylko API urządzenia, app.js tylko orkiestracja.
3. **Niskie sprzężenie** – moduły komunikują się przez jasne API na `window` (uzasadnione brakiem bundlera); zmiana jednego modułu nie wymaga rozrzucania zmian po całym projekcie.
4. **Dobre praktyki JS** – const/let, brak pustych catch bez komentarza, delegacja zdarzeń na listę, brak zbędnego console.log w flow.
5. **PWA i offline** – manifest + Service Worker z czytelną strategią cache i fallbackiem; struktura plików (np. offline.html, sw.js) ułatwia obronę decyzji „jak działa bez sieci”.

Ten dokument można wykorzystać w całości lub fragmentami podczas obrony, aby uzasadnić **dlaczego pliki mają taką strukturę** i **dlaczego są to dobre wzorce**.
