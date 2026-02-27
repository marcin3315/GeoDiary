/**
 * GeoDiary - obsługa geolokalizacji (Geolocation API).
 * Czysty Vanilla JS, bez frameworków.
 * API: getCurrentLocation() → Promise<{latitude, longitude, accuracy}>.
 * Eksponowane globalnie jako window.geoDiaryLocation.
 */

(function () {
  'use strict';

  /**
   * Pobiera aktualną pozycję użytkownika.
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
   * @throws {Error} Przy PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT lub braku API.
   */
  function getCurrentLocation() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) {
        reject(new Error('Geolokalizacja nie jest obsługiwana w tej przeglądarce.'));
        return;
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        function (position) {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        function (error) {
          let message;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Brak dostępu do lokalizacji (odmowa użytkownika).';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Nie można ustalić pozycji.';
              break;
            case error.TIMEOUT:
              message = 'Przekroczono czas oczekiwania na lokalizację.';
              break;
            default:
              message = 'Nieznany błąd geolokalizacji.';
          }
          reject(new Error(message));
        },
        options
      );
    });
  }

  window.geoDiaryLocation = {
    getCurrentLocation: getCurrentLocation
  };
})();
