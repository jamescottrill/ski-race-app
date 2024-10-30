// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example';

contextBridge.exposeInMainWorld('electronAPI', {
  savePDF: (buffer: any) => ipcRenderer.invoke('save-pdf', buffer),
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
});

document.addEventListener("DOMContentLoaded", () => {

  // Event delegation for blur events on dynamically loaded inputs
  document.addEventListener("blur", function (event) {
    if(!event.target && !event.target.calssList) return;
    if(!event.target.classList.contains('race-time-input')) return;
    const input = event.target;
    const value = input.value;
    if (value.length === 0) return;
    const timeRegex = /^([0-5][0-9])(:|\.)?([0-5][0-9])\.?\d{0,2}$/;
    if (!timeRegex.test(value)) {
      input.focus();
    } else {
      let parts = value.match(/(\d{1,2}):?(\d{2})\.?(\d{2})?/);
      if (parts) {
        const minutes = parts[1].padStart(2, '0');
        const seconds = parts[2].padStart(2, '0');
        const milliseconds = parts[3] ? parts[3].padEnd(2, '0') : '00';
        input.value = `${minutes}:${seconds}.${milliseconds}`;
        console.log(input.value);
        return;
      }
    }
  }, true);
});






export type ElectronHandler = typeof electronHandler;
