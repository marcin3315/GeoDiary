/**
 * GeoDiary - warstwa UI (renderowanie listy wpisów)
 * Czysty Vanilla JS, bez frameworków.
 * API eksponowane globalnie jako window.geoDiaryUI.
 */

(function () {
  'use strict';

  const DESCRIPTION_MAX_LENGTH = 100;
  const EMPTY_MESSAGE = 'Brak zapisanych miejsc';
  const NO_ID_MESSAGE = 'Brak identyfikatora wpisu';
  const NOT_FOUND_MESSAGE = 'Wpis nie został znaleziony';
  const NO_PHOTO_MESSAGE = 'Brak zdjęcia';
  const NO_LOCATION_MESSAGE = 'Brak zapisanej lokalizacji';

  /** ID kontenerów DOM używanych w tej warstwie (spójność z app.js / HTML). */
  const CONTAINER_IDS = { entriesList: 'entries-list', entryDetails: 'entry-details' };

  /** Ostatni URL utworzony dla zdjęcia w szczegółach (do revoke przy następnym renderze). */
  let lastDetailsImageUrl = null;
  /** Instancja mapy Leaflet w widoku szczegółów (jedna na stronę, usuwana przy ponownym renderze). */
  let detailsMap = null;
  /** Czy na kontenerze #entries-list jest już podpięta delegacja zdarzeń (jedna zamiast N listenerów na kartach). */
  let entriesListDelegateAttached = false;

  /**
   * Skraca opis do max 100 znaków; dodaje wielokropek, jeśli ucięty.
   * @param {string} text
   * @returns {string}
   */
  function shortenDescription(text) {
    if (!text || typeof text !== 'string') return '';
    const trimmed = text.trim();
    if (trimmed.length <= DESCRIPTION_MAX_LENGTH) return trimmed;
    return trimmed.slice(0, DESCRIPTION_MAX_LENGTH) + '…';
  }

  /**
   * Tworzy element karty wpisu (tytuł, data, skrócony opis, przycisk „Zobacz”).
   * Klik w kartę lub przycisk przekierowuje do details.html?id=ENTRY_ID.
   * @param {Object} entry - wpis z bazy (id, title, description, date, ...)
   * @returns {HTMLElement}
   */
  function renderEntryCard(entry) {
    const card = document.createElement('article');
    card.className = 'card';
    card.setAttribute('data-entry-id', entry.id);

    const title = document.createElement('h3');
    title.className = 'card__title';
    title.textContent = entry.title || '';

    const dateEl = document.createElement('p');
    dateEl.className = 'card__meta';
    dateEl.textContent = entry.date || '';

    const descriptionEl = document.createElement('p');
    descriptionEl.className = 'card__meta card__excerpt';
    descriptionEl.textContent = shortenDescription(entry.description || '');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--secondary';
    btn.textContent = 'Zobacz';

    card.appendChild(title);
    card.appendChild(dateEl);
    card.appendChild(descriptionEl);
    card.appendChild(btn);

    /* Nawigacja do szczegółów obsługiwana przez delegację zdarzeń na #entries-list (jedna listener zamiast N). */
    return card;
  }

  /**
   * Obsługuje klik w kartę lub przycisk „Zobacz” – jedna delegacja na kontenerze zamiast listenera na każdej karcie.
   */
  function handleEntriesListClick(e) {
    const card = e.target.closest('.card');
    if (!card) return;
    if (e.target.type === 'button' && e.target.classList.contains('btn')) {
      e.preventDefault();
    }
    const id = card.getAttribute('data-entry-id');
    if (!id || !id.trim()) return;
    try {
      sessionStorage.setItem('geoDiaryViewEntryId', id.trim());
    } catch (err) {
      /* sessionStorage niedostępny (np. tryb prywatny) – pomijamy zapis, nawigacja i tak zadziała przez URL. */
    }
    const url = new URL('details.html', window.location.href);
    url.searchParams.set('id', id.trim());
    window.location.href = url.href;
  }

  /**
   * Czyści #entries-list, sortuje wpisy malejąco po createdAt i renderuje karty.
   * Gdy lista pusta, wyświetla komunikat „Brak zapisanych miejsc”.
   * @param {Array<Object>} entries - tablica wpisów z bazy
   */
  function renderEntriesList(entries) {
    const container = document.getElementById(CONTAINER_IDS.entriesList);
    if (!container) return;

    if (!entriesListDelegateAttached) {
      container.addEventListener('click', handleEntriesListClick);
      entriesListDelegateAttached = true;
    }

    container.innerHTML = '';

    const sorted = [...(entries || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (sorted.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'entries-list__empty';
      empty.textContent = EMPTY_MESSAGE;
      container.appendChild(empty);
      return;
    }

    sorted.forEach((entry) => {
      container.appendChild(renderEntryCard(entry));
    });
  }

  /**
   * Formatuje znacznik czasu (createdAt) do czytelnej daty/czasu.
   * @param {number} timestamp
   * @returns {string}
   */
  function formatCreatedAt(timestamp) {
    if (timestamp == null || Number.isNaN(Number(timestamp))) return '—';
    const date = new Date(Number(timestamp));
    return date.toLocaleString('pl-PL', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  /**
   * Czyści #entry-details i wyświetla szczegóły wpisu (tytuł, data, opis, współrzędne, zdjęcie, mapa Leaflet).
   * Przycisk „Usuń wpis” wywołuje window.geoDiaryApp.deleteEntryAndRedirect(entry.id).
   * @param {Object} entry - wpis z bazy (id, title, description, date, latitude, longitude, image, createdAt, …)
   */
  function renderEntryDetails(entry) {
    const container = document.getElementById(CONTAINER_IDS.entryDetails);
    if (!container) return;

    container.innerHTML = '';

    const title = document.createElement('h2');
    title.className = 'entry-details__title';
    title.textContent = entry.title || '';

    const dateEl = document.createElement('p');
    dateEl.className = 'entry-details__meta';
    dateEl.textContent = entry.date || '';

    const descriptionEl = document.createElement('p');
    descriptionEl.className = 'entry-details__description';
    descriptionEl.textContent = entry.description || '';
    descriptionEl.style.whiteSpace = 'pre-wrap';

    const coordsEl = document.createElement('p');
    coordsEl.className = 'entry-details__meta';
    const lat = entry.latitude != null ? Number(entry.latitude) : null;
    const lon = entry.longitude != null ? Number(entry.longitude) : null;
    const acc = entry.accuracy != null ? Number(entry.accuracy) : null;
    const coordsParts = [];
    if (lat != null && !Number.isNaN(lat)) coordsParts.push(`latitude: ${lat}`);
    if (lon != null && !Number.isNaN(lon)) coordsParts.push(`longitude: ${lon}`);
    if (acc != null && !Number.isNaN(acc)) coordsParts.push(`accuracy: ${acc}`);
    coordsEl.textContent = coordsParts.length ? coordsParts.join(', ') : '—';

    const createdAtEl = document.createElement('p');
    createdAtEl.className = 'entry-details__meta';
    createdAtEl.textContent = 'Utworzono: ' + formatCreatedAt(entry.createdAt);

    if (lastDetailsImageUrl) {
      URL.revokeObjectURL(lastDetailsImageUrl);
      lastDetailsImageUrl = null;
    }
    const photoWrapper = document.createElement('div');
    photoWrapper.className = 'entry-details__photo';
    let hasImage = false;
    if (entry.image) {
      if (typeof entry.image === 'object' && entry.image instanceof Blob) {
        const img = document.createElement('img');
        img.alt = entry.title || 'Zdjęcie wpisu';
        img.className = 'entry-details__img';
        lastDetailsImageUrl = URL.createObjectURL(entry.image);
        img.src = lastDetailsImageUrl;
        photoWrapper.appendChild(img);
        hasImage = true;
      } else if (typeof entry.image === 'string' && entry.image.trim()) {
        const imgUrl = document.createElement('img');
        imgUrl.alt = entry.title || 'Zdjęcie wpisu';
        imgUrl.className = 'entry-details__img';
        imgUrl.src = entry.image.trim();
        photoWrapper.appendChild(imgUrl);
        hasImage = true;
      }
    }
    if (!hasImage) {
      const noPhoto = document.createElement('p');
      noPhoto.className = 'entry-details__meta';
      noPhoto.textContent = NO_PHOTO_MESSAGE;
      photoWrapper.appendChild(noPhoto);
    }

    container.appendChild(title);
    container.appendChild(dateEl);
    container.appendChild(descriptionEl);
    container.appendChild(coordsEl);
    container.appendChild(createdAtEl);
    container.appendChild(photoWrapper);

    const mapEl = document.getElementById('map');
    const mapNoLocationEl = document.getElementById('map-no-location');
    const mapWrapEl = document.querySelector('.entry-details__map-wrap');
    const mapLat = entry.latitude != null ? Number(entry.latitude) : 0;
    const mapLon = entry.longitude != null ? Number(entry.longitude) : 0;
    const hasCoords = !Number.isNaN(mapLat) && !Number.isNaN(mapLon) && (mapLat !== 0 || mapLon !== 0);

    if (detailsMap) {
      detailsMap.remove();
      detailsMap = null;
    }
    if (mapWrapEl) {
      mapWrapEl.style.display = '';
      if (mapEl) mapEl.style.display = '';
      if (mapNoLocationEl) mapNoLocationEl.style.display = 'none';
      if (hasCoords && mapEl && typeof window.L !== 'undefined') {
        try {
          detailsMap = window.L.map('map').setView([mapLat, mapLon], 13);
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          }).addTo(detailsMap);
          const marker = window.L.marker([mapLat, mapLon]).addTo(detailsMap);
          if (entry.title) marker.bindPopup(entry.title).openPopup();
        } catch (mapErr) {
          console.warn('Leaflet map init:', mapErr.message || mapErr);
          if (mapNoLocationEl) {
            mapNoLocationEl.textContent = NO_LOCATION_MESSAGE;
            mapNoLocationEl.style.display = 'block';
            if (mapEl) mapEl.style.display = 'none';
          }
        }
      } else {
        if (mapNoLocationEl) {
          mapNoLocationEl.textContent = NO_LOCATION_MESSAGE;
          mapNoLocationEl.style.display = 'block';
        }
        if (mapEl) mapEl.style.display = 'none';
      }
    }

    const actionsEl = document.querySelector('.entry-details__actions');
    if (actionsEl) {
      const oldDelete = actionsEl.querySelector('.entry-details__delete');
      if (oldDelete) oldDelete.remove();
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn--danger entry-details__delete';
      deleteBtn.textContent = 'Usuń wpis';
      deleteBtn.addEventListener('click', function () {
        if (window.geoDiaryApp && typeof window.geoDiaryApp.deleteEntryAndRedirect === 'function') {
          window.geoDiaryApp.deleteEntryAndRedirect(entry.id);
        }
      });
      actionsEl.appendChild(deleteBtn);
    }
  }

  /**
   * Czyści #entry-details i wyświetla komunikat błędu (brak id, wpis nie znaleziony).
   * @param {string} message
   */
  function renderDetailsError(message) {
    const container = document.getElementById(CONTAINER_IDS.entryDetails);
    if (!container) return;

    container.innerHTML = '';
    if (detailsMap) {
      detailsMap.remove();
      detailsMap = null;
    }
    const mapWrapEl = document.querySelector('.entry-details__map-wrap');
    if (mapWrapEl) mapWrapEl.style.display = 'none';
    const actionsEl = document.querySelector('.entry-details__actions');
    if (actionsEl) {
      const oldDelete = actionsEl.querySelector('.entry-details__delete');
      if (oldDelete) oldDelete.remove();
    }
    const el = document.createElement('p');
    el.className = 'entry-details__error';
    el.textContent = message || NOT_FOUND_MESSAGE;
    container.appendChild(el);
  }

  window.geoDiaryUI = {
    renderEntryCard,
    renderEntriesList,
    renderEntryDetails,
    renderDetailsError
  };
})();
