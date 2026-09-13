import path from 'path';
import os from 'os';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  net,
  safeStorage,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { Database, AppPreferences, closeActiveDatabase } from './utils/db';
import { createSettingsStore } from './sync/settings';
import { createClient } from './sync/client';
import { createSyncWorker } from './sync/worker';
import { registerSyncIpc } from './sync/ipc';

const fs = require('fs');

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;
let syncWorker: ReturnType<typeof createSyncWorker> | null = null;

function ensureDatabasePath(): string | undefined {
  const preferences = AppPreferences.loadPreferences();

  let dbPath = preferences.databasePath;
  if (!dbPath || !fs.existsSync(dbPath)) {
    const choice = dialog.showMessageBoxSync({
      type: 'question',
      buttons: ['Create New Database', 'Open Existing Database', 'Cancel'],
      defaultId: 0,
      title: 'Database Selection',
      message:
        'No database file found. Would you like to create a new database or open an existing one?',
    });

    if (choice === 0) {
      const result = dialog.showSaveDialogSync({
        title: 'Create New Database',
        defaultPath: 'ski-race-results.db',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      });
      if (result) {
        dbPath = result;
      }
    } else if (choice === 1) {
      const result = dialog.showOpenDialogSync({
        title: 'Open Existing Database',
        properties: ['openFile'],
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      });
      if (result && result.length > 0) {
        dbPath = result[0];
      }
    }

    if (dbPath) {
      preferences.databasePath = dbPath;
      AppPreferences.savePreferences(preferences);
    } else {
      app.quit();
      return;
    }
  }

  return dbPath;
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

async function createWindow() {
  if (isDebug) {
    const installExtensions = async () => {
      const installer = require('electron-devtools-installer');
      const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
      const extensions = ['REACT_DEVELOPER_TOOLS'];
      return installer
        .default(
          extensions.map((name) => installer[name]),
          forceDownload,
        )
        .catch(console.log);
    };
    await installExtensions();
  }

  const dbPath = ensureDatabasePath();
  if (!dbPath) {
    // If no dbPath, we've quit or handled the scenario
    return;
  }

  // Now that we have a valid DB path, create the database
  let db: any;
  let currentDbPath = dbPath;

  while (!db) {
    try {
      db = new Database(currentDbPath);
    } catch (error: any) {
      const choice = dialog.showMessageBoxSync({
        type: 'error',
        buttons: ['Select Different Database', 'Quit'],
        defaultId: 0,
        title: 'Database Error',
        message: `Failed to open database at:\n${currentDbPath}\n\nError: ${error.message}`,
      });

      if (choice === 0) {
        // Clear the saved preference and let user select again
        const prefs = AppPreferences.loadPreferences();
        prefs.databasePath = undefined;
        AppPreferences.savePreferences(prefs);

        const newPath = ensureDatabasePath();
        if (!newPath) {
          app.quit();
          return;
        }
        currentDbPath = newPath;
      } else {
        app.quit();
        return;
      }
    }
  }

  // Sync with the central results service: the settings live in the
  // preferences file, the worker drains the outbox (src/main/sync), and the
  // renderer reaches both through the sync-* IPC channels
  const runOperation = (name: string, payload?: object) =>
    db.operation(name, payload);
  const settings = createSettingsStore({
    load: () => AppPreferences.loadPreferences(),
    save: (preferences: object) => AppPreferences.savePreferences(preferences),
    safeStorage,
  });
  syncWorker = createSyncWorker({
    db: db.db,
    operation: runOperation,
    settings,
    createClient: (options: object) =>
      createClient({
        fetchImpl: (url: string, init?: object) => net.fetch(url, init),
        ...options,
      }),
    notify: (status: unknown) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('sync-status', status);
      }
    },
    log,
    appVersion: app.getVersion(),
    hostname: os.hostname(),
  });
  db.onOperationCommitted = (name: string, payload: any) =>
    syncWorker?.requestSync({ competitionId: payload?.competitionId });
  db.onClose = () => syncWorker?.stop();
  registerSyncIpc({
    ipcMain,
    worker: syncWorker,
    settings,
    db: db.db,
    operation: runOperation,
  });
  syncWorker.start();

  ipcMain.handle('db-select', async (event, query, params) => {
    try {
      const results = await db.all(query, params);
      return results;
    } catch (error: any) {
      console.error('Error selecting data:', error);
      throw error;
    }
  });

  ipcMain.handle('db-insert', async (event, query, params) => {
    try {
      const result = await db.run(query, params);
      return { success: true, id: result.id };
    } catch (error: any) {
      console.error('Error inserting data:', error);
      throw error;
    }
  });

  ipcMain.handle('db-delete', async (event, query, params) => {
    try {
      const result = await db.delete(query, params);
      return result;
    } catch (error: any) {
      console.error('Error deleting data:', error);
      throw error;
    }
  });

  ipcMain.handle('db-operation', async (event, name, payload) => {
    try {
      // Named operations own their SQL and run atomically in the main
      // process; see src/main/operations
      return db.operation(name, payload);
    } catch (error: any) {
      console.error(`Operation ${name} failed:`, error);
      throw error;
    }
  });

  ipcMain.handle('db-transaction', async (event, operations) => {
    try {
      // Synchronous execution inside better-sqlite3's transaction() —
      // the batch is atomic and no other IPC call can interleave with it
      const results = db.transaction(operations);
      return { success: true, results };
    } catch (error: any) {
      console.error('Transaction failed:', error);
      throw error;
    }
  });

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: true,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html')).catch((error: any) => {
    dialog.showErrorBox(
      'Load Error',
      `Failed to load application: ${error.message}`,
    );
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (event, errorCode, errorDescription) => {
      dialog.showErrorBox(
        'Load Error',
        `Page failed to load: ${errorDescription} (${errorCode})`,
      );
    },
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  new AppUpdater();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Checkpoint the WAL and release the file handle before the process exits,
// so a copy of the .db file taken after quitting is complete. app.exit()
// (used to relaunch after switching databases) skips this event, so the
// menu calls closeActiveDatabase() itself before exiting.
app.on('will-quit', () => {
  syncWorker?.stop();
  closeActiveDatabase();
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch(console.log);

ipcMain.handle('save-pdf', async (event, buffer, defaultFileName) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: 'Save PDF',
      defaultPath: defaultFileName,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (filePath) {
      fs.writeFileSync(filePath, Buffer.from(buffer));
      return { success: true, filePath };
    }
    return { success: false, cancelled: true };
  } catch (error: any) {
    console.error('Failed to save PDF:', error);
    throw error;
  }
});
