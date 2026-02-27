# GeoDiary – dziennik miejsc (PWA)

Progressive Web App do zapisywania odwiedzanych miejsc z tytułem, opisem, datą, zdjęciem i współrzędnymi GPS. Aplikacja działa offline, można ją zainstalować na urządzeniu i hostować m.in. na GitHub Pages.

---

## Użyte technologie

- **Frontend:** HTML5, CSS3 (mobile-first, zmienne CSS), Vanilla JavaScript (ES5/ES6, bez frameworków)
- **Przechowywanie danych:** IndexedDB (API bez zewnętrznych bibliotek)
- **Mapy:** Leaflet 1.9.4 (OpenStreetMap) – tylko na stronie szczegółów wpisu
- **PWA:** Service Worker (własna implementacja), Web App Manifest
- **API przeglądarki:** Geolocation API, MediaDevices (kamera), Fetch API
- **Środowisko deweloperskie (opcjonalne):** Node.js, pakiet `serve` do lokalnego serwera

---

## Funkcjonalności

- **Lista wpisów** – strona główna z kartami miejsc posortowanymi według daty utworzenia
- **Dodawanie wpisu** – formularz: tytuł, opis, data, opcjonalna lokalizacja GPS i zdjęcie z kamery
- **Szczegóły wpisu** – widok pojedynczego wpisu z mapą Leaflet (gdy są współrzędne), zdjęciem i przyciskiem „Usuń wpis”
- **Praca offline** – Service Worker cache'uje strony i zasoby; nawigacja do `details.html?id=...` działa offline dzięki dopasowaniu URL bez parametrów query
- **Instalacja PWA** – manifest z ikonami 192×192 i 512×512, `start_url` i `scope` ustawione pod hostowanie w podkatalogu (np. GitHub Pages)
- **Dane startowe** – przy pustej bazie aplikacja ładuje wpisy z `data/demo.json` (obrazy z katalogu `images/`)

---

## Zależności

- **Runtime:** nowoczesna przeglądarka z obsługą IndexedDB, Service Worker, Geolocation API, MediaDevices (np. Chrome, Firefox, Edge, Safari)
- **Zewnętrzne zasoby (CDN):** Leaflet (CSS + JS) z unpkg – tylko na stronie szczegółów
- **Opcjonalnie (development):** Node.js i pakiet `serve` do uruchomienia lokalnego serwera (zalecane ze względu na Service Worker i Fetch)

Brak zależności w samym kodzie aplikacji – nie używa się bundlera ani zewnętrznych bibliotek poza Leafletem wczytywanym z CDN.

---

## Uruchomienie projektu

### 1. Otwarcie plików (bez serwera)

Otwórz w przeglądarce plik `index.html`.  
**Uwaga:** Service Worker i część funkcji (np. Fetch do `demo.json`) mogą nie działać poprawnie przy protokole `file://`. Do pełnej funkcjonalności zalecane jest uruchomienie przez serwer.

### 2. Lokalny serwer (zalecane)

W katalogu projektu:

```bash
npm install
npm run dev
```

Domyślnie `serve` uruchomi serwer (np. `http://localhost:3000`). Otwórz w przeglądarce adres wyświetlony w terminalu.

### 3. GitHub Pages

1. Wypchnij repozytorium na GitHub.
2. W ustawieniach repozytorium: **Settings → Pages → Source** wybierz branch (np. `main`) i katalog (np. `/root` lub katalog z projektem).
3. Aplikacja będzie dostępna pod adresem typu `https://<user>.github.io/<repo>/` (np. `https://user.github.io/geo-diary-pwa/`).
4. Service Worker jest rejestrowany względem strony (`./sw.js`), więc działa poprawnie w podkatalogu.

---

## Struktura projektu

```
geo-diary-pwa/
├── index.html          # Strona główna – lista wpisów
├── add.html            # Formularz dodawania wpisu (lokalizacja, kamera)
├── details.html        # Szczegóły wpisu (mapa Leaflet, zdjęcie, usuń)
├── offline.html        # Strona wyświetlana przy braku sieci (fallback SW)
├── manifest.json       # Web App Manifest (PWA)
├── sw.js               # Service Worker (cache statyczny + dynamiczny, Network First)
├── css/
│   └── style.css       # Style globalne (mobile-first)
├── js/
│   ├── app.js          # Logika aplikacji: init, seed, add/details, rejestracja SW
│   ├── db.js           # Warstwa IndexedDB (initDB, addEntry, getAllEntries, …)
│   ├── ui.js           # Renderowanie listy, kart, szczegółów, mapy Leaflet
│   ├── location.js     # Geolocation API (getCurrentLocation)
│   └── camera.js       # MediaDevices (startCamera, capturePhoto, stopCamera)
├── data/
│   └── demo.json       # Wpisy demo do seedu przy pustej bazie
├── images/             # Obrazy demo (np. demo-1.jpg) i ewentualne zdjęcia
├── icons/
│   ├── icon-192.png    # Ikona PWA 192×192
│   └── icon-512.png    # Ikona PWA 512×512
├── package.json        # Opcjonalnie: skrypt "dev" (serve)
└── README.md           # Niniejsza dokumentacja
```

Kolejność ładowania skryptów w HTML: najpierw `db.js`, potem moduły zależne (`ui.js`, `location.js`, `camera.js` w zależności od strony), na końcu `app.js`, który korzysta z `window.geoDiaryDB`, `window.geoDiaryUI` itd.

---

## Natywne funkcje urządzenia

Aplikacja wykorzystuje **dwie natywne funkcje** urządzenia:

1. **Geolokalizacja (Geolocation API)**  
   - **Gdzie:** `js/location.js`, wywołanie z `js/app.js` (przycisk „Pobierz lokalizację” na stronie dodawania wpisu).  
   - **Jak:** `navigator.geolocation.getCurrentPosition()` z opcjami `enableHighAccuracy: true`, `timeout: 10000`, `maximumAge: 0`. Zwracana jest obietnica z obiektem `{ latitude, longitude, accuracy }`. Wartości są zapisywane w wpisie przy „Zapisz wpis” i wyświetlane w szczegółach oraz na mapie.

2. **Kamera (MediaDevices API)**  
   - **Gdzie:** `js/camera.js`, wywołanie z `js/app.js` (przyciski „Uruchom kamerę” i „Zrób zdjęcie” na stronie dodawania wpisu).  
   - **Jak:** `navigator.mediaDevices.getUserMedia()` z ograniczeniem `facingMode: 'environment'` (kamera tylna na telefonie), z fallbackiem na `{ video: true }`. Podgląd w elemencie `<video>`, zrzut klatki przez `<canvas>` i `toBlob('image/jpeg')`. Zdjęcie zapisywane jako Blob w IndexedDB i wyświetlane w szczegółach wpisu.

---

## Tryb offline i strategia buforowania

- **Service Worker** (`sw.js`) rejestrowany z `./sw.js`; przy instalacji zapisuje listę zasobów statycznych (strony HTML, CSS, JS, manifest, ikony, demo.json) w **STATIC_CACHE** (pojedynczo, `Promise.allSettled`, żeby jeden błąd nie blokował instalacji).
- **Strategia:** **Network First** dla wszystkich żądań: najpierw fetch z sieci, przy sukcesie odpowiedź zapisywana w **DYNAMIC_CACHE** i zwracana; przy błędzie (np. offline) zwracana odpowiedź z cache. Dla nawigacji przy braku sieci dodatkowo szukamy w cache po URL bez parametrów query (żeby `details.html?id=...` działał offline).
- **Informacja o braku połączenia:** gdy żądana strona nie jest w cache, użytkownik widzi `offline.html` z komunikatem „Brak połączenia z internetem” i przyciskiem „Wróć do listy” (umożliwia powrót do wcześniej otwartej listy z cache).
- **Funkcje dostępne offline:** przeglądanie listy wpisów, dodawanie nowych wpisów (zapis w IndexedDB), przeglądanie szczegółów zapisanych wpisów, usuwanie wpisów.

---

## Hosting i wydajność

- **Hosting:** Aplikacja jest hostowana na **GitHub Pages** (instrukcja w sekcji „Uruchomienie projektu”). Strona jest serwowana przez **HTTPS** (np. `https://<user>.github.io/geo-diary-pwa/`).
- **Wydajność:** Aplikacja używa lekkich zasobów (Vanilla JS, jeden zewnętrzny skrypt – Leaflet tylko na stronie szczegółów). Do oceny wydajności można użyć **Lighthouse** (Chrome DevTools → Lighthouse): PWA, Performance, Best Practices.

---

## Licencja

ISC (zgodnie z `package.json`). Ikony i treści demo można udostępniać na tych samych lub wybranych warunkach.
