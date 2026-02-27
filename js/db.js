/**
 * GeoDiary - warstwa dostępu do IndexedDB
 * Czysta implementacja bez zewnętrznych bibliotek.
 * Baza: geoDiaryDB, object store: entries (keyPath: id), indeksy: createdAt, date.
 * API eksponowane globalnie jako window.geoDiaryDB (initDB, addEntry, getAllEntries, getEntryById, deleteEntry, isDBEmpty).
 */

(function () {
  'use strict';

  const DB_NAME = 'geoDiaryDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'entries';

  /** Referencja do otwartego połączenia z bazą (używana przez wszystkie operacje). */
  let db = null;

  /**
   * Otwiera bazę danych i tworzy object store oraz indeksy przy pierwszym uruchomieniu.
   * Zarządzanie wersją przez onupgradeneeded.
   * @returns {Promise<void>}
   */
  function initDB() {
    return new Promise((resolve, reject) => {
      if (db) {
        resolve();
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB open error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (database.objectStoreNames.contains(STORE_NAME)) {
          return;
        }
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      };
    });
  }

  /**
   * Zwraca object store w transakcji (readonly lub readwrite).
   * @param {'readonly'|'readwrite'} mode
   * @returns {IDBObjectStore}
   */
  function getStore(mode) {
    if (!db) {
      throw new Error('Baza nie jest otwarta. Wywołaj najpierw initDB().');
    }
    const tx = db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  /**
   * Dodaje wpis do bazy.
   * @param {Object} entry - obiekt wpisu (id, title, description, date, latitude, longitude, accuracy, image, createdAt)
   * @returns {Promise<void>}
   */
  function addEntry(entry) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('readwrite');
        const request = store.add(entry);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('addEntry error:', request.error);
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Pobiera wszystkie wpisy z bazy (w kolejności według klucza).
   * @returns {Promise<Array>}
   */
  function getAllEntries() {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('readonly');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => {
          console.error('getAllEntries error:', request.error);
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Pobiera jeden wpis po id.
   * @param {string} id
   * @returns {Promise<Object|undefined>}
   */
  function getEntryById(id) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('readonly');
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.error('getEntryById error:', request.error);
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Usuwa wpis o podanym id.
   * @param {string} id
   * @returns {Promise<void>}
   */
  function deleteEntry(id) {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('readwrite');
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('deleteEntry error:', request.error);
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Sprawdza, czy baza nie zawiera żadnych wpisów.
   * @returns {Promise<boolean>}
   */
  function isDBEmpty() {
    return new Promise((resolve, reject) => {
      try {
        const store = getStore('readonly');
        const request = store.count();

        request.onsuccess = () => resolve(request.result === 0);
        request.onerror = () => {
          console.error('isDBEmpty error:', request.error);
          reject(request.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  // Ekspozycja API globalnie
  window.geoDiaryDB = {
    initDB,
    addEntry,
    getAllEntries,
    getEntryById,
    deleteEntry,
    isDBEmpty
  };
})();
