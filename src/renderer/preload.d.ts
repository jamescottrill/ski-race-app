import { ElectronHandler } from '../main/preload';

interface DatabaseAPI {
  select: (query: string, params?: any[]) => Promise<any[]>;
  insert: (query: string, params?: any[]) => Promise<{ success: true; id: number }>;
  delete: (query: string, params?: any[]) => Promise<{ changes: number }>;
}

interface ElectronAPI {
  savePDF: (buffer: ArrayBuffer, defaultFileName: string) => Promise<{ success: true; filePath: string } | { success: false; cancelled: true }>;
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
    api: DatabaseAPI;
    electronAPI: ElectronAPI;
  }
}

export {};
