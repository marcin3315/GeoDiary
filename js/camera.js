/**
 * GeoDiary - obsługa kamery (MediaDevices API).
 * Czysty Vanilla JS, bez frameworków.
 * API: startCamera(videoEl), capturePhoto(videoEl, canvasEl) → Blob, stopCamera(stream).
 * Na urządzeniach mobilnych preferowana kamera tylna (facingMode: 'environment') z fallbackiem.
 * Eksponowane globalnie jako window.geoDiaryCamera.
 */

(function () {
  'use strict';

  /**
   * Uruchamia kamerę i pokazuje podgląd w elemencie video.
   * @param {HTMLVideoElement} videoEl - element <video>
   * @returns {Promise<MediaStream>}
   */
  function startCamera(videoEl) {
    if (!videoEl || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('Kamera nie jest obsługiwana w tej przeglądarce.'));
    }
    // Na Androidzie domyślnie używamy kamery tylnej (environment); na desktopie nie zmienia to zachowania.
    // getUserMedia({ video: true })
    const constraints = { video: { facingMode: 'environment' } };
    return navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
      videoEl.srcObject = stream;
      return stream;
    }).catch(function (err) {
      // Fallback na dowolną kamerę, gdy urządzenie nie obsługuje facingMode: 'environment'
      return navigator.mediaDevices.getUserMedia({ video: true }).then(function (stream) {
        videoEl.srcObject = stream;
        return stream;
      });
    });
  }

  /**
   * Pobiera klatkę z video, rysuje na canvas i zwraca Blob (obraz JPEG).
   * @param {HTMLVideoElement} videoEl - element <video>
   * @param {HTMLCanvasElement} canvasEl - element <canvas>
   * @returns {Promise<Blob>}
   */
  function capturePhoto(videoEl, canvasEl) {
    return new Promise(function (resolve, reject) {
      if (!videoEl || !canvasEl) {
        reject(new Error('Brak elementu video lub canvas.'));
        return;
      }
      const w = videoEl.videoWidth;
      const h = videoEl.videoHeight;
      if (!w || !h) {
        reject(new Error('Wideo nie jest gotowe do zrzutu.'));
        return;
      }
      canvasEl.width = w;
      canvasEl.height = h;
      const ctx = canvasEl.getContext('2d');
      ctx.drawImage(videoEl, 0, 0, w, h);
      canvasEl.toBlob(function (blob) {
        if (blob) resolve(blob);
        else reject(new Error('Nie udało się utworzyć zdjęcia.'));
      }, 'image/jpeg', 0.9);
    });
  }

  /**
   * Zatrzymuje wszystkie ścieżki strumienia (wyłącza kamerę).
   * @param {MediaStream} stream
   */
  function stopCamera(stream) {
    if (!stream || typeof stream.getTracks !== 'function') return;
    stream.getTracks().forEach(function (track) {
      track.stop();
    });
  }

  window.geoDiaryCamera = {
    startCamera: startCamera,
    capturePhoto: capturePhoto,
    stopCamera: stopCamera
  };
})();
