/**
 * GeoDiary - główna aplikacja PWA
 *
 * Odpowiada za: inicjalizację bazy (initDB), seed danych demo przy pustej bazie,
 * render listy wpisów i strony szczegółów, formularz dodawania wpisu (lokalizacja, kamera),
 * zapis/usuwanie wpisów, rejestrację Service Workera oraz zdarzenia online/offline.
 * Wymaga załadowania w kolejności: db.js, (ui.js, location.js, camera.js wg strony), app.js.
 * API eksponowane globalnie: window.geoDiaryApp (deleteEntryAndRedirect).
 */

(function () {
  'use strict';

  /** Identyfikatory stron (zgodne z atrybutem data-page na <body>). Jedne źródło prawdy dla routingu. */
  const PAGE = { INDEX: 'index', ADD: 'add', DETAILS: 'details', OFFLINE: 'offline' };

  /** Stałe ID elementów DOM – unikanie „magicznych stringów” w całym kodzie. */
  const SELECTORS = {
    entriesList: 'entries-list',
    entryDetails: 'entry-details',
    saveEntry: 'save-entry',
    title: 'title',
    description: 'description',
    date: 'date',
    getLocation: 'get-location',
    locationInfo: 'location-info',
    startCamera: 'start-camera',
    takePhoto: 'take-photo',
    cameraPreview: 'camera-preview',
    photoCanvas: 'photo-canvas',
    photoPreview: 'photo-preview',
    photoPlaceholder: 'photo-placeholder',
    cameraError: 'camera-error'
  };

  /** Tymczasowa lokalizacja na stronie add (ustawiana po „Pobierz lokalizację”). */
  let addPageCurrentLocation = null;
  /** Tymczasowe zdjęcie na stronie add (Blob po „Zrób zdjęcie”). */
  let addPageCurrentPhoto = null;
  /** Aktualny strumień kamery (do zatrzymania po zrobieniu zdjęcia). */
  let addPageCameraStream = null;

  /**
   * Inicjalizacja: baza, następnie routing wg data-page na <body> (jedna źródło prawdy).
   */
  async function initApp() {
    if (typeof window.geoDiaryDB === 'undefined') {
      console.warn('geoDiaryDB nie jest dostępne (brak db.js?)');
      return;
    }

    try {
      await window.geoDiaryDB.initDB();

      const page = (document.body && document.body.getAttribute('data-page')) || '';

      if (page === PAGE.INDEX) {
        await seedDemoDataIfEmpty();
        const entries = await window.geoDiaryDB.getAllEntries();
        if (typeof window.geoDiaryUI !== 'undefined') {
          window.geoDiaryUI.renderEntriesList(entries);
        }
      } else if (page === PAGE.ADD) {
        setupAddPageIfActive();
      } else if (page === PAGE.DETAILS) {
        await loadDetailsPageIfActive();
      }
    } catch (err) {
      console.error('Błąd inicjalizacji aplikacji:', err);
    }
  }

  /**
   * Przy pierwszym uruchomieniu (pusta baza) pobiera demo.json i zapisuje wpisy do IndexedDB.
   * Wywoływane tylko na index.html, przed renderEntriesList().
   * W razie błędu (brak pliku, brak sieci, błędny JSON) loguje do konsoli i nie przerywa działania.
   */
  async function seedDemoDataIfEmpty() {
    if (typeof window.geoDiaryDB === 'undefined') return;

    try {
      /* initDB() już wywołane w initApp() – nie powielamy. */
      const empty = await window.geoDiaryDB.isDBEmpty();
      if (!empty) return;

      const response = await fetch('./data/demo.json');
      if (!response.ok) {
        console.warn('seedDemoDataIfEmpty: nie udało się pobrać demo.json (status ' + response.status + ')');
        return;
      }

      const data = await response.json();
      const entries = Array.isArray(data) ? data : [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (!entry || entry.id == null) continue;
        entry.image = null;
        const imageFileName = entry.imageFile || entry.id + '.jpg';
        try {
          const imgResponse = await fetch('./images/' + imageFileName);
          if (imgResponse.ok) {
            entry.image = await imgResponse.blob();
          }
        } catch (imgErr) {
          console.warn('seedDemoDataIfEmpty: brak zdjęcia dla ' + entry.id, imgErr.message || imgErr);
        }
        delete entry.imageFile;
        await window.geoDiaryDB.addEntry(entry);
      }
      if (entries.length > 0) {
        console.log('Załadowano dane demo');
      }
    } catch (err) {
      console.warn('seedDemoDataIfEmpty:', err.message || err);
    }
  }

  /**
   * Jeśli aktualna strona to add.html, dodaje obsługę przycisku „Zapisz wpis”:
   * walidacja, utworzenie wpisu, zapis do IndexedDB, przekierowanie na index.html.
   */
  function setupAddPageIfActive() {
    const saveBtn = document.getElementById(SELECTORS.saveEntry);
    const titleInput = document.getElementById(SELECTORS.title);
    const dateInput = document.getElementById(SELECTORS.date);
    const getLocationBtn = document.getElementById(SELECTORS.getLocation);
    const locationInfo = document.getElementById(SELECTORS.locationInfo);

    if (!saveBtn || !titleInput || !dateInput) return;
    if (typeof window.geoDiaryDB === 'undefined') return;

    saveBtn.addEventListener('click', function () {
      handleSaveEntry();
    });

    if (getLocationBtn && locationInfo && typeof window.geoDiaryLocation !== 'undefined') {
      getLocationBtn.addEventListener('click', function () {
        handleGetLocation(locationInfo);
      });
    }

    const startCameraBtn = document.getElementById(SELECTORS.startCamera);
    const takePhotoBtn = document.getElementById(SELECTORS.takePhoto);
    const cameraPreview = document.getElementById(SELECTORS.cameraPreview);
    const photoCanvas = document.getElementById(SELECTORS.photoCanvas);
    const photoPreviewImg = document.getElementById(SELECTORS.photoPreview);
    const photoPlaceholder = document.getElementById(SELECTORS.photoPlaceholder);
    const cameraError = document.getElementById(SELECTORS.cameraError);
    if (startCameraBtn && takePhotoBtn && cameraPreview && photoCanvas && photoPreviewImg && typeof window.geoDiaryCamera !== 'undefined') {
      startCameraBtn.addEventListener('click', function () {
        handleStartCamera(cameraPreview, photoPreviewImg, photoPlaceholder, cameraError);
      });
      takePhotoBtn.addEventListener('click', function () {
        handleTakePhoto(cameraPreview, photoCanvas, photoPreviewImg, photoPlaceholder, cameraError);
      });
    }
  }

  /**
   * Uruchamia kamerę i pokazuje podgląd w video. Błędy (brak zgody, brak kamery) w #camera-error.
   */
  async function handleStartCamera(cameraPreviewEl, photoPreviewImgEl, placeholderEl, cameraErrorEl) {
    if (!cameraPreviewEl || typeof window.geoDiaryCamera === 'undefined') return;
    hideCameraError(cameraErrorEl);
    if (addPageCameraStream) {
      window.geoDiaryCamera.stopCamera(addPageCameraStream);
      addPageCameraStream = null;
    }
    photoPreviewImgEl.style.display = 'none';
    photoPreviewImgEl.src = '';
    addPageCurrentPhoto = null;
    if (placeholderEl) placeholderEl.style.display = '';

    try {
      const stream = await window.geoDiaryCamera.startCamera(cameraPreviewEl);
      addPageCameraStream = stream;
      cameraPreviewEl.style.display = 'block';
      if (placeholderEl) placeholderEl.style.display = 'none';
    } catch (err) {
      showCameraError(cameraErrorEl, err.message || 'Brak dostępu do kamery lub kamera niedostępna.');
    }
  }

  /**
   * Robi zdjęcie z video, zapisuje Blob w addPageCurrentPhoto, pokazuje w img, zatrzymuje kamerę.
   */
  async function handleTakePhoto(cameraPreviewEl, photoCanvasEl, photoPreviewImgEl, placeholderEl, cameraErrorEl) {
    if (!cameraPreviewEl || !photoCanvasEl || !photoPreviewImgEl || typeof window.geoDiaryCamera === 'undefined') return;
    hideCameraError(cameraErrorEl);

    try {
      const blob = await window.geoDiaryCamera.capturePhoto(cameraPreviewEl, photoCanvasEl);
      addPageCurrentPhoto = blob;
      if (addPageCameraStream) {
        window.geoDiaryCamera.stopCamera(addPageCameraStream);
        addPageCameraStream = null;
      }
      cameraPreviewEl.style.display = 'none';
      if (placeholderEl) placeholderEl.style.display = 'none';
      photoPreviewImgEl.src = URL.createObjectURL(blob);
      photoPreviewImgEl.style.display = 'block';
    } catch (err) {
      showCameraError(cameraErrorEl, err.message || 'Nie udało się zrobić zdjęcia.');
    }
  }

  function showCameraError(el, message) {
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
  }

  function hideCameraError(el) {
    if (el) {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  /**
   * Obsługa przycisku „Pobierz lokalizację”: wywołuje getCurrentLocation(),
   * wyświetla status w #location-info i zapisuje wynik w addPageCurrentLocation.
   * @param {HTMLElement} locationInfoEl - kontener #location-info
   */
  async function handleGetLocation(locationInfoEl) {
    if (!locationInfoEl || typeof window.geoDiaryLocation === 'undefined') return;

    locationInfoEl.textContent = 'Pobieranie lokalizacji…';
    locationInfoEl.classList.remove('location-info--error');
    addPageCurrentLocation = null;

    try {
      const result = await window.geoDiaryLocation.getCurrentLocation();
      addPageCurrentLocation = result;
      locationInfoEl.textContent = 'Lokalizacja pobrana. Szerokość: ' +
        result.latitude.toFixed(6) + ', Długość: ' + result.longitude.toFixed(6) +
        ', Dokładność: ' + Math.round(result.accuracy) + ' m';
    } catch (err) {
      locationInfoEl.textContent = err.message || 'Nie udało się pobrać lokalizacji.';
      locationInfoEl.classList.add('location-info--error');
    }
  }

  /**
   * Odczytuje wartości formularza, waliduje, zapisuje wpis do bazy i przekierowuje na index.
   */
  async function handleSaveEntry() {
    const titleEl = document.getElementById(SELECTORS.title);
    const descriptionEl = document.getElementById(SELECTORS.description);
    const dateEl = document.getElementById(SELECTORS.date);

    if (!titleEl || !dateEl || typeof window.geoDiaryDB === 'undefined') return;

    const title = (titleEl.value || '').trim();
    const description = (descriptionEl ? (descriptionEl.value || '').trim() : '');
    const date = (dateEl.value || '').trim();

    if (!title) {
      alert('Tytuł nie może być pusty.');
      return;
    }
    if (!date) {
      alert('Data nie może być pusta.');
      return;
    }

    const lat = addPageCurrentLocation ? addPageCurrentLocation.latitude : 0;
    const lon = addPageCurrentLocation ? addPageCurrentLocation.longitude : 0;
    const acc = addPageCurrentLocation ? addPageCurrentLocation.accuracy : 0;
    const image = addPageCurrentPhoto || null;

    const entry = {
      id: 'entry-' + Date.now(),
      title: title,
      description: description,
      date: date,
      latitude: lat,
      longitude: lon,
      accuracy: acc,
      image: image,
      createdAt: Date.now()
    };

    try {
      await window.geoDiaryDB.addEntry(entry);
      window.location.href = new URL('index.html', window.location.href).href;
    } catch (err) {
      console.error('Błąd zapisu wpisu:', err);
      alert('Nie udało się zapisać wpisu. Spróbuj ponownie.');
    }
  }

  /**
   * Zwraca id wpisu do wyświetlenia: z sessionStorage (ustawione przy kliknięciu w kartę)
   * lub z parametru id w URL.
   * @returns {string|null}
   */
  function getEntryIdFromUrl() {
    try {
      const fromStorage = sessionStorage.getItem('geoDiaryViewEntryId');
      if (fromStorage && fromStorage.trim()) return fromStorage.trim();
    } catch (e) {
      /* sessionStorage niedostępny (np. tryb prywatny) – pomijamy odczyt, id z URL. */
    }
    const href = window.location.href || '';
    const search = window.location.search || '';
    if (search) {
      const id = new URLSearchParams(search).get('id');
      if (id) return id.trim();
    }
    const qMark = href.indexOf('?');
    if (qMark >= 0) {
      const idFromHref = new URLSearchParams(href.slice(qMark)).get('id');
      if (idFromHref) return idFromHref.trim();
    }
    const match = href.match(/[?&]id=([^&]*)/);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim();
      } catch (e) {
        /* decodeURIComponent może rzucić przy nieprawidłowych znakach – zwracamy surowy fragment. */
        return match[1].trim();
      }
    }
    return null;
  }

  /**
   * Na stronie details (data-page="details") odczytuje id z URL/sessionStorage,
   * ładuje wpis z IndexedDB i wyświetla go lub komunikat błędu.
   */
  async function loadDetailsPageIfActive() {
    const page = (document.body && document.body.getAttribute('data-page')) || '';
    if (page !== PAGE.DETAILS) return;

    if (typeof window.geoDiaryUI === 'undefined') return;

    const id = getEntryIdFromUrl();

    if (!id) {
      window.geoDiaryUI.renderDetailsError('Brak identyfikatora wpisu');
      return;
    }

    try {
      const entry = await window.geoDiaryDB.getEntryById(id);
      if (entry) {
        window.geoDiaryUI.renderEntryDetails(entry);
      } else {
        window.geoDiaryUI.renderDetailsError('Wpis nie został znaleziony');
      }
    } catch (err) {
      console.error('Błąd ładowania wpisu:', err);
      window.geoDiaryUI.renderDetailsError('Wpis nie został znaleziony');
    }
  }

  // Inicjalizacja przy starcie (DOM gotowy + skrypty załadowane)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  // Rejestracja Service Workera (ścieżka względna – wymagana dla GitHub Pages w podkatalogu)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      const swPath = './sw.js';
      navigator.serviceWorker
        .register(swPath)
        .then(function (registration) {
          console.log('Service Worker zarejestrowany:', registration.scope);
        })
        .catch(function (error) {
          console.log('Rejestracja Service Workera nie powiodła się:', error);
        });
    });
  }

  // Obsługa zdarzeń online/offline
  window.addEventListener('online', function () {
    console.log('Aplikacja jest online');
  });

  window.addEventListener('offline', function () {
    console.log('Aplikacja jest offline');
  });

  /**
   * Usuwa wpis z bazy po id i przekierowuje na index.html.
   * Wywoływane z ui.js (przycisk „Usuń wpis” w szczegółach).
   * @param {string} entryId
   */
  async function deleteEntryAndRedirect(entryId) {
    if (!entryId || typeof window.geoDiaryDB === 'undefined') return;
    if (!confirm('Czy na pewno chcesz usunąć ten wpis?')) return;
    try {
      await window.geoDiaryDB.deleteEntry(entryId);
      window.location.href = new URL('index.html', window.location.href).href;
    } catch (err) {
      console.error('Błąd usuwania wpisu:', err);
      alert('Nie udało się usunąć wpisu. Spróbuj ponownie.');
    }
  }

  window.geoDiaryApp = {
    deleteEntryAndRedirect: deleteEntryAndRedirect
  };
})();
