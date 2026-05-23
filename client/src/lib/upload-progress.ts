export type UploadPhase = 'uploading' | 'parsing' | 'complete';

export interface UploadProgressState {
  phase: UploadPhase;
  uploadPercent: number;
  parsePercent: number;
  speedBytesPerSecond: number | null;
  elapsedMs: number;
}

export function uploadFileWithProgress<T>(
  url: string,
  fieldName: string,
  file: File,
  onProgress: (state: UploadProgressState) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startedAt = performance.now();
    let lastLoaded = 0;
    let lastTime = startedAt;
    let lastSpeed: number | null = null;
    let parsePercent = 0;
    let parseTimer: number | null = null;

    const emit = (phase: UploadPhase, uploadPercent: number): void => {
      onProgress({
        phase,
        uploadPercent: Math.max(0, Math.min(100, uploadPercent)),
        parsePercent: Math.max(0, Math.min(100, parsePercent)),
        speedBytesPerSecond: lastSpeed,
        elapsedMs: performance.now() - startedAt,
      });
    };

    const startParseProgress = (): void => {
      if (parseTimer !== null) return;
      parsePercent = Math.max(parsePercent, 5);
      emit('parsing', 100);
      parseTimer = window.setInterval(() => {
        parsePercent = Math.min(95, parsePercent + 8);
        emit('parsing', 100);
      }, 250);
    };

    const stopParseProgress = (): void => {
      if (parseTimer === null) return;
      window.clearInterval(parseTimer);
      parseTimer = null;
    };

    xhr.open('POST', url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      const now = performance.now();
      if (event.lengthComputable) {
        const elapsedSeconds = Math.max((now - lastTime) / 1000, 0.001);
        lastSpeed = (event.loaded - lastLoaded) / elapsedSeconds;
        lastLoaded = event.loaded;
        lastTime = now;
        emit('uploading', (event.loaded / event.total) * 100);
      } else {
        emit('uploading', 0);
      }
    };

    xhr.upload.onload = startParseProgress;
    xhr.onerror = () => {
      stopParseProgress();
      reject(new Error('Upload failed'));
    };
    xhr.onload = () => {
      stopParseProgress();
      parsePercent = 100;
      emit('complete', 100);
      try {
        const json = JSON.parse(xhr.responseText || '{}') as { data?: T; error?: { message?: string } };
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(json.error?.message ?? `Upload failed with status ${xhr.status}`));
          return;
        }
        resolve(json.data as T);
      } catch {
        reject(new Error('Upload response was not valid JSON'));
      }
    };

    const formData = new FormData();
    formData.append(fieldName, file);
    emit('uploading', 0);
    xhr.send(formData);
  });
}

export function formatBytesPerSecond(bytesPerSecond: number | null): string {
  if (bytesPerSecond === null || !Number.isFinite(bytesPerSecond)) return 'calculating';
  if (bytesPerSecond >= 1024 * 1024) return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
  if (bytesPerSecond >= 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${Math.max(0, Math.round(bytesPerSecond))} B/s`;
}