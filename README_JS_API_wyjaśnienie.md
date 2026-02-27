# GeoDiary – opis metod i funkcji w plikach JavaScript

Dokument zawiera **dokładny opis każdej metody/funkcji** w plikach JS projektu, z podaniem **numerów linii** i wyjaśnieniem **funkcji** w kodzie.

---

## 1. `js/app.js`

Główny orkiestrator aplikacji (IIFE). Ładowany na **wszystkich** stronach (index, add, details, offline) – zawsze po `db.js`, a na add po `location.js` i `camera.js`, na index/details po `ui.js`. Skrypt wykonuje się od razu po załadowaniu: na końcu pliku rejestrowany jest `DOMContentLoaded` (lub od razu `initApp`) oraz `load` (rejestracja SW). **Kto wywołuje:** `initApp` – przeglądarka (zdarzenie); pozostałe funkcje – z wnętrza app.js (handlery, flow) lub z ui.js (`deleteEntryAndRedirect`).

| Linie | Nazwa / fragment | Kiedy występuje / kiedy się wykonuje | Funkcja |
|-------|------------------|--------------------------------------|--------|
| **15–16** | `PAGE` | Odczyt przy każdym sprawdzeniu strony w `initApp()` i `loadDetailsPageIfActive()` (porównanie z `data-page`). | Stały obiekt z identyfikatorami stron (`index`, `add`, `details`, `offline`) – jedno źródło prawdy dla routingu (atrybut `data-page` w HTML). |
| **18–34** | `SELECTORS` | Odczyt przy każdym `document.getElementById(...)` w app.js (setupAddPageIfActive, handleSaveEntry, handlery). | Stały obiekt z id elementów DOM (np. `entries-list`, `save-entry`, `title`). Eliminuje „magiczne stringi” w całym pliku. |
| **36–41** | `addPageCurrentLocation`, `addPageCurrentPhoto`, `addPageCameraStream` | Ustawiane/zerowane **tylko na stronie add**: przy „Pobierz lokalizację”, „Zrób zdjęcie”, uruchomieniu/zatrzymaniu kamery i przy zapisie wpisu (handleSaveEntry odczytuje je). | Zmienne stanu strony dodawania wpisu: ostatnia pobrana lokalizacja, zrobione zdjęcie (Blob), aktywny strumień kamery (do późniejszego zatrzymania). |
| **46–71** | `initApp()` | Wywoływane **raz** po załadowaniu strony: z `DOMContentLoaded` albo od razu (gdy dokument już gotowy). Następnie w zależności od `data-page` wywołuje seed/listę, setupAddPageIfActive lub loadDetailsPageIfActive. | **Główny punkt wejścia.** Inicjalizuje bazę (`geoDiaryDB.initDB()`), odczytuje `data-page` z `<body>` i w zależności od strony: na `index` – seed (gdy baza pusta), pobranie wpisów i wywołanie `renderEntriesList`; na `add` – `setupAddPageIfActive`; na `details` – `loadDetailsPageIfActive`. Błędy logowane do konsoli. |
| **78–116** | `seedDemoDataIfEmpty()` | Wywoływane **tylko z initApp()** i **tylko na stronie index** (przed renderEntriesList). Występuje co najwyżej raz na sesję dla danej bazy – po pierwszym wypełnieniu `isDBEmpty()` zwraca false. | Sprawdza, czy baza jest pusta (`isDBEmpty`). Jeśli tak – pobiera `./data/demo.json`, dla każdego wpisu ewentualnie ładuje zdjęcie z `./images/`, usuwa pole `imageFile`, zapisuje wpis przez `addEntry`. Nie wywołuje `initDB()` (zakłada, że baza jest już otwarta). Błędy tylko logowane, nie przerywają działania. |
| **122–159** | `setupAddPageIfActive()` | Wywoływane **raz** z `initApp()`, gdy `data-page === 'add'`. W tym momencie podpisuje wszystkie listenery na przyciskach (zapisz, lokalizacja, kamera) – dalsze kliknięcia wywołują handlery. | Podpisuje listenery na stronie dodawania wpisu: przycisk „Zapisz wpis” → `handleSaveEntry`; „Pobierz lokalizację” → `handleGetLocation(locationInfo)`; „Uruchom kamerę” / „Zrób zdjęcie” → `handleStartCamera` / `handleTakePhoto`. Używa tylko elementów i modułów dostępnych na tej stronie. |
| **164–184** | `handleStartCamera(...)` | Wywoływane **przy każdym kliknięciu** „Uruchom kamerę” na add.html (callback z setupAddPageIfActive). | Czyści błąd kamery, zatrzymuje ewentualny poprzedni strumień, zeruje podgląd zdjęcia i placeholder. Wywołuje `geoDiaryCamera.startCamera(cameraPreviewEl)`, zapisuje strumień w `addPageCameraStream`, pokazuje podgląd w `<video>` i ukrywa placeholder. Przy błędzie wyświetla komunikat w `cameraErrorEl`. |
| **190–207** | `handleTakePhoto(...)` | Wywoływane **przy każdym kliknięciu** „Zrób zdjęcie” na add.html. | Wywołuje `geoDiaryCamera.capturePhoto`, zapisuje Blob w `addPageCurrentPhoto`, zatrzymuje kamerę, ukrywa `<video>`, pokazuje zdjęcie w `photoPreviewImgEl` przez `URL.createObjectURL`. Przy błędzie – komunikat w `cameraErrorEl`. |
| **211–216** | `showCameraError(el, message)` | Wywoływane z `handleStartCamera` i `handleTakePhoto` w bloku `catch`, gdy wystąpi błąd kamery lub zrzutu. | Ustawia `textContent` i `display = 'block'` na elemencie błędu kamery. |
| **218–223** | `hideCameraError(el)` | Wywoływane na początku `handleStartCamera` i `handleTakePhoto`, zanim rozpocznie się nowa operacja. | Czyści treść i ukrywa element (`display = 'none'`). |
| **229–246** | `handleGetLocation(locationInfoEl)` | Wywoływane **przy każdym kliknięciu** „Pobierz lokalizację” na add.html. | Ustawia w kontenerze tekst „Pobieranie lokalizacji…”, zeruje `addPageCurrentLocation`. Wywołuje `geoDiaryLocation.getCurrentLocation()`; przy sukcesie zapisuje wynik w `addPageCurrentLocation` i wyświetla współrzędne i dokładność; przy błędzie – komunikat i klasa `location-info--error`. |
| **252–295** | `handleSaveEntry()` | Wywoływane **przy każdym kliknięciu** „Zapisz wpis” na add.html. | Odczytuje pola formularza (tytuł, opis, data), waliduje tytuł i datę (alert przy pustych). Buduje obiekt wpisu (id z `Date.now()`, lokalizacja ze `addPageCurrentLocation`, zdjęcie z `addPageCurrentPhoto`). Zapisuje przez `geoDiaryDB.addEntry(entry)` i przekierowuje na `index.html`. Przy błędzie zapisu – alert. |
| **303–328** | `getEntryIdFromUrl()` | Wywoływane **tylko z loadDetailsPageIfActive()** – czyli raz po wejściu na details.html (gdy `data-page === 'details'`). | Zwraca id wpisu do wyświetlenia: najpierw z `sessionStorage.getItem('geoDiaryViewEntryId')`, potem z parametru `id` w URL (URLSearchParams lub regex). Dekoduje wartość z `decodeURIComponent`; przy wyjątku zwraca surowy fragment. Zwraca `string` lub `null`. |
| **334–358** | `loadDetailsPageIfActive()` | Wywoływane **raz** z `initApp()`, gdy `data-page === 'details'`. Po odczytaniu id ładuje wpis z bazy i wywołuje ui (renderEntryDetails lub renderDetailsError). | Działa tylko gdy `data-page === 'details'`. Pobiera id przez `getEntryIdFromUrl()`; przy braku id wywołuje `renderDetailsError('Brak identyfikatora wpisu')`. Ładuje wpis przez `geoDiaryDB.getEntryById(id)` – przy sukcesie `renderEntryDetails(entry)`, przy braku/błędzie `renderDetailsError(...)`. |
| **360–366** | Inicjalizacja przy starcie | Wykonuje się **od razu** po załadowaniu skryptu (koniec IIFE). Jeśli `document.readyState === 'loading'` – rejestruje jeden raz `DOMContentLoaded` → `initApp`; inaczej wywołuje `initApp()` synchronicznie. | Jeśli dokument jeszcze się ładuje – rejestruje `DOMContentLoaded` → `initApp`; w przeciwnym razie od razu wywołuje `initApp()`. |
| **368–381** | Rejestracja Service Workera | Wykonuje się **po zdarzeniu `load`** na `window` (strona i zasoby załadowane). Rejestracja `./sw.js` odbywa się raz na załadowanie strony; przeglądarka sama porównuje wersję SW przy kolejnych wizytach. | Po zdarzeniu `load` rejestruje `./sw.js`. Loguje sukces lub błąd rejestracji. |
| **383–389** | Zdarzenia online/offline | Listenery wykonują się **za każdym razem**, gdy przeglądarka zgłasza zmianę stanu sieci (np. odłączenie WiFi, powrót połączenia). | Listenery na `window` dla `online` i `offline` – obecnie tylko log do konsoli (można rozbudować o UI). |
| **394–404** | `deleteEntryAndRedirect(entryId)` | Wywoływane **z ui.js** po kliknięciu „Usuń wpis” na stronie szczegółów (callback w renderEntryDetails). `entryId` to `entry.id` z aktualnie wyświetlanego wpisu. | Sprawdza `entryId` i obecność `geoDiaryDB`. Pokazuje `confirm`; po potwierdzeniu wywołuje `geoDiaryDB.deleteEntry(entryId)` i przekierowuje na `index.html`. Przy błędzie – alert. |
| **406–408** | `window.geoDiaryApp` | Wykonuje się **raz** na końcu IIFE. Od tego momentu `deleteEntryAndRedirect` dostępne globalnie – używane tylko w ui.js. | Ekspozycja API aplikacji: `{ deleteEntryAndRedirect }`. |

---

## 2. `js/db.js`

Warstwa dostępu do IndexedDB. Ładowana na **wszystkich** stronach (zawsze przed app.js). Nie ma zdarzeń DOM – wywołania pochodzą **wyłącznie z app.js** (oraz pośrednio z ui.js przez geoDiaryApp). Baza `geoDiaryDB` i object store `entries` są współdzielone między stronami w ramach tej samej domeny. **Kto wywołuje:** app.js – initDB przy starcie, isDBEmpty/getAllEntries na index, addEntry przy zapisie i seedzie, getEntryById/deleteEntry na details.

| Linie | Nazwa | Kiedy występuje / kiedy się wykonuje | Funkcja |
|-------|--------|--------------------------------------|--------|
| **11–14** | `DB_NAME`, `DB_VERSION`, `STORE_NAME` | Odczyt przy każdym `indexedDB.open`, `db.transaction` i w `getStore`. | Stałe konfiguracji bazy (nazwa, wersja, nazwa store’a). |
| **17** | `db` | Ustawiane w `initDB()` po `request.onsuccess`; odczytywane w każdej operacji przez `getStore()`. Null do pierwszego udanego `initDB`. | Referencja do otwartego połączenia IndexedDB (null do pierwszego `initDB`). |
| **24–51** | `initDB()` | Wywoływane **raz na stronę** z `initApp()` w app.js (przy każdym wejściu na index/add/details/offline). Przy już otwartej bazie (`db !== null`) od razu resolve bez ponownego otwierania. Przy pierwszym otwarciu przeglądarka wywołuje `onupgradeneeded` i tworzy store/indeksy. | Otwiera bazę `indexedDB.open(DB_NAME, DB_VERSION)`. Przy pierwszym uruchomieniu (`onupgradeneeded`) tworzy object store `entries` z `keyPath: 'id'` oraz indeksy `createdAt` i `date`. Jeśli `db` już istnieje, od razu resolve. Zwraca `Promise<void>`. |
| **58–64** | `getStore(mode)` | Wywoływane **przy każdej** operacji na bazie: addEntry, getAllEntries, getEntryById, deleteEntry, isDBEmpty – wewnętrznie, nie z zewnątrz. | Zwraca object store `entries` w transakcji o podanym trybie (`'readonly'` lub `'readwrite'`). Rzuca błąd, jeśli `initDB()` nie było wcześniej wywołane. |
| **71–86** | `addEntry(entry)` | Wywoływane z app.js: w **seedDemoDataIfEmpty()** (dla każdego wpisu z demo.json) oraz w **handleSaveEntry()** po wypełnieniu formularza na add.html. | Otwiera transakcję zapisu i wywołuje `store.add(entry)`. Zwraca Promise; przy błędzie loguje i reject. |
| **92–107** | `getAllEntries()` | Wywoływane **tylko na stronie index** z `initApp()` – po seedzie (jeśli był), żeby przekazać tablicę wpisów do `renderEntriesList(entries)`. | Pobiera wszystkie rekordy z store (`getAll()`). Zwraca Promise z tablicą (lub `[]`). |
| **114–129** | `getEntryById(id)` | Wywoływane **tylko na stronie details** z `loadDetailsPageIfActive()` – raz po wejściu na details.html, z id z URL/sessionStorage. | Pobiera jeden wpis po kluczu `id` (`store.get(id)`). Zwraca Promise z obiektem lub `undefined`. |
| **136–151** | `deleteEntry(id)` | Wywoływane z app.js w **deleteEntryAndRedirect(entryId)** – po potwierdzeniu „Usuń wpis” na stronie szczegółów (wywołanie z ui.js). | Usuwa wpis o podanym `id` (`store.delete(id)`). Zwraca Promise<void>. |
| **157–172** | `isDBEmpty()` | Wywoływane **tylko na stronie index** z `seedDemoDataIfEmpty()` – przed pobraniem demo.json; gdy baza nie jest pusta, seed się nie wykonuje. | Wywołuje `store.count()`; resolve z `true`, gdy wynik === 0. |
| **175–182** | `window.geoDiaryDB` | Wykonuje się **raz** na końcu IIFE. Od tego momentu app.js (i ewentualnie inne skrypty) wywołują API przez `window.geoDiaryDB.*`. | Ekspozycja API: `initDB`, `addEntry`, `getAllEntries`, `getEntryById`, `deleteEntry`, `isDBEmpty`. |

---

## 3. `js/ui.js`

Warstwa UI: renderowanie listy wpisów, kart, szczegółów i mapy. Ładowana tylko na **index.html** i **details.html** (nie na add ani offline). Wszystkie wywołania z **app.js** – ui nie subskrybuje zdarzeń globalnych, tylko dostaje dane i wypełnia DOM. Jedyny „wsteczny” wywołanie: przycisk „Usuń wpis” w renderEntryDetails wywołuje `window.geoDiaryApp.deleteEntryAndRedirect(entry.id)`. **Kto wywołuje:** app.js – renderEntriesList(entries) na index, renderEntryDetails(entry) / renderDetailsError(message) na details.

| Linie | Nazwa | Kiedy występuje / kiedy się wykonuje | Funkcja |
|-------|--------|--------------------------------------|--------|
| **10–16** | Stałe komunikatów | Używane wewnątrz ui.js: w renderEntriesList (EMPTY_MESSAGE), renderEntryDetails (NO_PHOTO_MESSAGE, NO_LOCATION_MESSAGE), renderDetailsError (NOT_FOUND_MESSAGE). | `DESCRIPTION_MAX_LENGTH`, `EMPTY_MESSAGE`, `NO_ID_MESSAGE`, `NOT_FOUND_MESSAGE`, `NO_PHOTO_MESSAGE`, `NO_LOCATION_MESSAGE` – teksty w widokach. |
| **18–19** | `CONTAINER_IDS` | Odczyt przy każdym `getElementById(CONTAINER_IDS.entriesList)` / `CONTAINER_IDS.entryDetails` w renderEntriesList, renderEntryDetails, renderDetailsError. | Id kontenerów: `entries-list`, `entry-details` – spójność z HTML i app.js. |
| **21–25** | Zmienne modułu | `lastDetailsImageUrl` – ustawiane/zerowane w renderEntryDetails przy Blob; `detailsMap` – ustawiane w renderEntryDetails (Leaflet), czyszczone w renderEntryDetails i renderDetailsError; `entriesListDelegateAttached` – ustawiane na true przy pierwszym renderEntriesList. | `lastDetailsImageUrl` (do revoke przy kolejnym renderze), `detailsMap` (instancja Leaflet), `entriesListDelegateAttached` (flaga delegacji na listę). |
| **29–34** | `shortenDescription(text)` | Wywoływane **z renderEntryCard(entry)** dla każdej karty – przy budowaniu skrótu opisu na liście. | Zwraca obcięty do 100 znaków opis z wielokropkiem na końcu; dla pustego/nie-stringa zwraca `''`. |
| **42–71** | `renderEntryCard(entry)` | Wywoływane **z renderEntriesList(entries)** w pętli – dla każdego wpisu na stronie index. Zwracany element jest dodawany do `#entries-list`. | Tworzy element `<article class="card">` z `data-entry-id`, wewnątrz: tytuł (h3), data, skrócony opis, przycisk „Zobacz”. Nie dodaje listenera – klik obsługuje delegacja na kontenerze. Zwraca element karty. |
| **76–92** | `handleEntriesListClick(e)` | Wywoływane **przy każdym kliknięciu** w obrębie `#entries-list` (delegacja – jeden listener na kontenerze). Występuje po kliknięciu w kartę lub przycisk „Zobacz”; przekierowuje na details.html?id=... | Handler delegacji: szuka karty przez `e.target.closest('.card')`, odczytuje `data-entry-id`. Zapisuje id w `sessionStorage` (tryb prywatny – catch z komentarzem). Przekierowuje na `details.html?id=...`. |
| **99–124** | `renderEntriesList(entries)` | Wywoływane **raz** (lub przy każdym odświeżeniu listy) z `initApp()` na index.html – po seedzie (jeśli był) i `getAllEntries()`. Argument to tablica wpisów z bazy. | Czyści `#entries-list`. Przy pierwszym wywołaniu podpisuje jeden listener `handleEntriesListClick` na kontenerze. Sortuje wpisy malejąco po `createdAt`, przy pustej tablicy pokazuje komunikat „Brak zapisanych miejsc”, w przeciwnym razie dla każdego wpisu dodaje `renderEntryCard(entry)`. |
| **130–137** | `formatCreatedAt(timestamp)` | Wywoływane **z renderEntryDetails(entry)** – raz przy renderze szczegółów, do wyświetlenia „Utworzono: …”. | Formatuje znacznik czasu do czytelnej daty/czasu w locale `pl-PL` (dateStyle: medium, timeStyle: short). Dla null/NaN zwraca „—”. |
| **144–272** | `renderEntryDetails(entry)` | Wywoływane **raz** z `loadDetailsPageIfActive()` na details.html – gdy wpis został znaleziony w bazie (`getEntryById` zwrócił obiekt). Entry to pełny obiekt wpisu (id, title, description, date, latitude, longitude, image, createdAt itd.). | Czyści `#entry-details`. Buduje blok szczegółów: tytuł, data, opis (pre-wrap), współrzędne, „Utworzono: …”, zdjęcie (Blob → ObjectURL z revoke poprzedniego, lub string, lub „Brak zdjęcia”). Czyści poprzednią mapę Leaflet; przy poprawnych współrzędnych inicjuje mapę OSM i marker z popupem; przy braku współrzędnych pokazuje komunikat. Dodaje przycisk „Usuń wpis” wywołujący `window.geoDiaryApp.deleteEntryAndRedirect(entry.id)`. |
| **278–298** | `renderDetailsError(message)` | Wywoływane **z loadDetailsPageIfActive()** na details.html gdy: brak id w URL/sessionStorage, wpis nie znaleziony w bazie lub błąd przy getEntryById. | Czyści `#entry-details`, usuwa mapę Leaflet, ukrywa kontener mapy i przycisk usuwania. Wyświetla jeden akapit z klasą `entry-details__error` i podanym (lub domyślnym) komunikatem błędu. |
| **300–305** | `window.geoDiaryUI` | Wykonuje się **raz** na końcu IIFE. Od tego momentu app.js wywołuje `renderEntriesList`, `renderEntryDetails`, `renderDetailsError` (renderEntryCard tylko wewnętrznie). | Ekspozycja: `renderEntryCard`, `renderEntriesList`, `renderEntryDetails`, `renderDetailsError`. |

---

## 4. `js/location.js`

Obsługa Geolocation API. Ładowana **tylko na add.html** (przed app.js). Nie rejestruje żadnych zdarzeń – wywołania **tylko z app.js**: `handleGetLocation(locationInfo)` wywołuje `getCurrentLocation()` po kliknięciu „Pobierz lokalizację”. Przeglądarka przy pierwszym wywołaniu może pokazać prośbę o zezwolenie na dostęp do lokalizacji. **Kto wywołuje:** app.js – handleGetLocation (callback z przycisku na add).

| Linie | Nazwa | Kiedy występuje / kiedy się wykonuje | Funkcja |
|-------|--------|--------------------------------------|--------|
| **17–57** | `getCurrentLocation()` | Wywoływane **przy każdym kliknięciu** „Pobierz lokalizację” na add.html – z `handleGetLocation()` w app.js. Zwraca Promise; wynik (współrzędne) jest zapisywany w `addPageCurrentLocation` i wyświetlany w `#location-info`; przy zapisie wpisu te wartości trafiają do obiektu entry. | Sprawdza `navigator.geolocation`. Ustawia opcje: `enableHighAccuracy: true`, `timeout: 10000`, `maximumAge: 0`. Wywołuje `getCurrentPosition`; przy sukcesie resolve z obiektem `{ latitude, longitude, accuracy }`; przy błędzie mapuje kod (PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT) na czytelny komunikat i reject z `Error`. Zwraca `Promise<{latitude, longitude, accuracy}>`. |
| **59–61** | `window.geoDiaryLocation` | Wykonuje się **raz** na końcu IIFE. Od tego momentu app.js może wywołać `getCurrentLocation()` – tylko na add.html, gdzie location.js jest załadowany. | Ekspozycja: `{ getCurrentLocation }`. |

---

## 5. `js/camera.js`

Obsługa MediaDevices API. Ładowana **tylko na add.html** (przed app.js). Wywołania **tylko z app.js**: `handleStartCamera` wywołuje `startCamera` i `stopCamera`, `handleTakePhoto` wywołuje `capturePhoto` i `stopCamera`. Przeglądarka przy pierwszym dostępie do kamery może pokazać prośbę o zezwolenie. **Kto wywołuje:** app.js – handlery podpisane w setupAddPageIfActive („Uruchom kamerę”, „Zrób zdjęcie”).

| Linie | Nazwa | Kiedy występuje / kiedy się wykonuje | Funkcja |
|-------|--------|--------------------------------------|--------|
| **17–34** | `startCamera(videoEl)` | Wywoływane **przy każdym kliknięciu** „Uruchom kamerę” na add.html – z `handleStartCamera()` w app.js. Argument to element `#camera-preview`. Zwrócony strumień jest przechowywany w `addPageCameraStream` i używany później w handleTakePhoto do zatrzymania kamery. | Sprawdza obecność `videoEl` i `navigator.mediaDevices.getUserMedia`. Prosi o strumień z `facingMode: 'environment'` (kamera tylna); przy błędzie fallback na `{ video: true }`. Ustawia `videoEl.srcObject = stream` i zwraca Promise z `MediaStream`. |
| **42–62** | `capturePhoto(videoEl, canvasEl)` | Wywoływane **przy każdym kliknięciu** „Zrób zdjęcie” na add.html – z `handleTakePhoto()` w app.js. Elementy to `#camera-preview` i `#photo-canvas`. Zwrócony Blob jest zapisywany w `addPageCurrentPhoto` i przy zapisie wpisu trafia do entry.image. | Sprawdza elementy i wymiary wideo (`videoWidth`/`videoHeight`). Ustawia rozmiar canvas, rysuje klatkę z `videoEl` przez `drawImage`, wywołuje `toBlob('image/jpeg', 0.9)` i zwraca Promise z Blob (lub reject przy błędzie). |
| **69–74** | `stopCamera(stream)` | Wywoływane z app.js w **handleStartCamera** (przed uruchomieniem nowego strumienia – zatrzymanie poprzedniego) oraz w **handleTakePhoto** (po zrobieniu zdjęcia – wyłączenie kamery). Argument to `addPageCameraStream`. | Dla podanego `MediaStream` wywołuje `getTracks()` i na każdej ścieżce wywołuje `track.stop()` – wyłącza kamerę. |
| **76–80** | `window.geoDiaryCamera` | Wykonuje się **raz** na końcu IIFE. Od tego momentu app.js może wywoływać `startCamera`, `capturePhoto`, `stopCamera` – tylko na add.html, gdzie camera.js jest załadowany. | Ekspozycja: `startCamera`, `capturePhoto`, `stopCamera`. |

---

## 6. `sw.js` (Service Worker)

Service Worker działa w **osobnym wątku** (kontekst worker), nie ma dostępu do DOM. Przeglądarka uruchamia go przy rejestracji z `app.js` (`navigator.serviceWorker.register('./sw.js')`) i przy każdej nawigacji/odświeżeniu w scope (np. `https://.../geo-diary-pwa/`) może przechwytywać żądania sieciowe. Strategia cache: **Network First** – najpierw sieć, przy błędzie (np. offline) odpowiedź z cache.

### Kiedy występują zdarzenia

- **`install`** – występuje **raz przy pierwszej rejestracji** SW albo **gdy przeglądarka wykryje nową wersję** skryptu (np. inna treść pliku `sw.js` po wdrożeniu). W tym momencie worker jest w stanie „installing”; dopóki `event.waitUntil(...)` nie zakończy się (np. zapis do cache), instalacja nie jest uznana za zakończoną.
- **`activate`** – występuje **gdy worker przechodzi w stan aktywny**. Przy pierwszej rejestracji zwykle zaraz po `install`. Przy aktualizacji SW – dopiero gdy **stary** worker zwolni wszystkie karty (albo gdy wywołano `skipWaiting()` w `install` – wtedy przeglądarka aktywuje nowy worker szybciej). W `activate` sprzątamy stare cache i wywołujemy `clients.claim()`, żeby ten worker od razu kontrolował otwarte strony.
- **`fetch`** – występuje **przy każdym żądaniu sieciowym** (nawigacja, skrypty, CSS, XHR/fetch, obrazy itd.) w scope SW, o ile żądanie jest obsługiwane przez przeglądarkę (np. nie pomijane przez nią). Worker może wtedy zwrócić odpowiedź z sieci lub z cache i w ten sposób decydować, co dostanie strona.

---

| Linie | Nazwa / fragment | Kiedy występuje / kiedy się wykonuje | Funkcja |
|-------|------------------|--------------------------------------|--------|
| **12–14** | `STATIC_CACHE`, `DYNAMIC_CACHE` | Odczyt przy każdym użyciu w listenerach (install, activate, fetch). | Nazwy cache’y: pierwszy na zasoby zapisane przy **install**, drugi na odpowiedzi dopisywane przy **fetch** (Network First). Wersja w nazwie (`v2`) pozwala przy aktualacji SW wyczyścić stary cache w `activate`. |
| **17–33** | `STATIC_ASSETS` | Odczyt **tylko w zdarzeniu install** (linia 39). | Tablica URL-i do zapisania przy pierwszej instalacji lub po wykryciu nowej wersji SW: strony HTML (`./`, index, add, details, offline), CSS, skrypty JS, manifest, demo.json, ikony. Ścieżki względne do scope SW (np. GitHub Pages w podkatalogu). |
| **35–52** | `install` (listener) | **Raz** przy pierwszej rejestracji lub **gdy zmieni się plik sw.js** (przeglądarka porównuje skrypt bajt po bajcie). | Otwiera `STATIC_CACHE`, dla każdego URL z `STATIC_ASSETS` wywołuje `cache.add(url)` wewnątrz `Promise.allSettled` – pojedynczy błąd (np. 404 dla brakującej ikony) nie blokuje instalacji. Po zakończeniu wywołuje `self.skipWaiting()`, żeby nowy SW mógł przejąć kontrolę bez czekania na zamknięcie wszystkich kart. Błędy są tylko logowane; i tak wywoływane jest `skipWaiting()`. |
| **54–68** | `activate` (listener) | **Po install**, gdy worker ma się stać aktywny (od razu przy pierwszej rejestracji; przy aktualizacji – po `skipWaiting()` lub gdy stary worker zwolni klientów). | Pobiera listę nazw cache’y; usuwa wszystkie o nazwie innej niż `STATIC_CACHE` i `DYNAMIC_CACHE` – usuwa stare wersje cache (np. `geoDiary-static-v1`). Następnie `self.clients.claim()` – ten worker przejmuje kontrolę nad wszystkimi otwartymi stronami w scope, bez czekania na kolejną nawigację. |
| **75–90** | `cacheFirst(request)` | Wywoływana **tylko gdy** w listenerze `fetch` zostanie użyta (w obecnym kodzie nie jest używana; pozostawiona jako pomocnicza). | Szuka odpowiedzi w cache; jeśli jest – zwraca ją. Jeśli nie – wykonuje `fetch(request)`; przy statusie 200 i typie `basic` lub `cors` klonuje response, zapisuje w `DYNAMIC_CACHE` i zwraca response. |
| **98–112** | `networkFirst(request)` | Wywoływana **przy każdym obsługiwanym żądaniu** – z listenera `fetch` dla nawigacji, skryptów, CSS, kafelków OSM, demo.json itd. | Najpierw `fetch(request)`; przy sukcesie (status 200, type `basic` lub `cors`) klonuje response, zapisuje w `DYNAMIC_CACHE` i zwraca response. Przy błędzie (brak sieci, timeout, CORS itd.) zwraca `caches.match(request)`. Dzięki temu strona dostaje świeżą wersję, gdy jest sieć, a offline – ostatnio zapisaną w cache. |
| **114–173** | `fetch` (listener) | **Przy każdym żądaniu sieciowym** w scope SW: ładowanie strony, skryptów, CSS, obrazów, fetch/XHR (np. do demo.json), kafelków map OSM. Nie obsługuje żądań nie-GET ani `blob:`. | Sprawdza metodę (tylko GET) i URL. Dla `tile.openstreetmap.org` – `networkFirst` (kafelki map). Dla same-origin `./data/demo.json` – `networkFirst`. Dla **nawigacji** (`request.mode === 'navigate'`): `networkFirst(request)`; gdy brak odpowiedzi (offline), szuka w cache po pełnym URL, potem po URL **bez query** (`url.origin + url.pathname`), żeby np. `details.html?id=xxx` znalazł zapisane `details.html`. Ostateczny fallback: `offline.html`. Dla zasobów same-origin (css, js, manifest, ikony) i pozostałych – `networkFirst`. |

---

## Kolejność ładowania skryptów (HTML)

- **index.html:** `db.js` → `ui.js` → `app.js`
- **add.html:** `db.js` → `location.js` → `camera.js` → `app.js`
- **details.html:** Leaflet (CDN) → `db.js` → `ui.js` → `app.js`
- **offline.html:** `db.js` → `app.js`

`app.js` zakłada, że `window.geoDiaryDB` (i w zależności od strony: `geoDiaryUI`, `geoDiaryLocation`, `geoDiaryCamera`) są już dostępne.
