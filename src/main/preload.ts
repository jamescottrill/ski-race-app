// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

contextBridge.exposeInMainWorld('electronAPI', {
  savePDF: async (buffer: any, defaultFileName: string) => {
    const res = await ipcRenderer.invoke('save-pdf', buffer, defaultFileName);
    return res;
  },
});

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

contextBridge.exposeInMainWorld('api', {
  select: (query: string, params: object) =>
    ipcRenderer.invoke('db-select', query, params),
  insert: (query: string, params: object) =>
    ipcRenderer.invoke('db-insert', query, params),
  delete: (query: string, params: Object) =>
    ipcRenderer.invoke('db-delete', query, params),
  transaction: (operations: any[]) =>
    ipcRenderer.invoke('db-transaction', operations),
  operation: (name: string, payload?: object) =>
    ipcRenderer.invoke('db-operation', name, payload),
});

// Sync with the central results service (src/main/sync); the renderer never
// sees the API key itself, only whether one is set and its last characters
contextBridge.exposeInMainWorld('sync', {
  getSettings: (competitionId: string) =>
    ipcRenderer.invoke('sync-settings-get', competitionId),
  setSettings: (competitionId: string, patch: object) =>
    ipcRenderer.invoke('sync-settings-set', competitionId, patch),
  testConnection: (competitionId: string, overrides?: object) =>
    ipcRenderer.invoke('sync-test-connection', competitionId, overrides),
  syncNow: (competitionId: string) =>
    ipcRenderer.invoke('sync-now', competitionId),
  publishAll: (competitionId: string) =>
    ipcRenderer.invoke('sync-publish-all', competitionId),
  getStatus: () => ipcRenderer.invoke('sync-status-get'),
  getLog: (competitionId: string, options?: object) =>
    ipcRenderer.invoke('sync-log', competitionId, options),
  retryEvents: (competitionId: string, ids: number[]) =>
    ipcRenderer.invoke('sync-retry-events', competitionId, ids),
  discardEvents: (competitionId: string, ids: number[]) =>
    ipcRenderer.invoke('sync-discard-events', competitionId, ids),
  onStatus: (callback: (status: unknown) => void) => {
    const subscription = (_event: IpcRendererEvent, status: unknown) =>
      callback(status);
    ipcRenderer.on('sync-status', subscription);
    return () => {
      ipcRenderer.removeListener('sync-status', subscription);
    };
  },
});

document.addEventListener('DOMContentLoaded', () => {
  // Event delegation for blur events on dynamically loaded inputs
  document.addEventListener(
    'blur',
    function (event: FocusEvent): void {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!input.classList.contains('race-time-input')) return;
      const value = input.value.padStart(6, '0');
      if (value.length === 0) return;
      const timeRegex = /^([0-5][0-9])(:|\.)?([0-5][0-9])(:|\.)?\d{0,2}$/;
      if (!timeRegex.test(value)) {
        input.focus();
      }
    },
    true,
  );
});

export type ElectronHandler = typeof electronHandler;
