import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { Database, AppPreferences } from './utils/db';

const fs = require('fs');

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

function ensureDatabasePath(): string | undefined {
  const preferences = AppPreferences.loadPreferences();

  let dbPath = preferences.databasePath;
  if (!dbPath || !fs.existsSync(dbPath)) {
    // Ask user whether to create new or open existing
    const choice = dialog.showMessageBoxSync({
      type: 'question',
      buttons: ['Create New Database', 'Open Existing Database', 'Cancel'],
      defaultId: 0,
      title: 'Database Selection',
      message: 'No database file found. Would you like to create a new database or open an existing one?',
    });

    if (choice === 0) {
      // Create new database - use save dialog
      const result = dialog.showSaveDialogSync({
        title: 'Create New Database',
        defaultPath: 'ski-race-results.db',
        filters: [{ name: 'SQLite Database', extensions: ['db'] }],
      });
      if (result) {
        dbPath = result;
      }
    } else if (choice === 1) {
      // Open existing database - use open dialog
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
      // User cancelled
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

  ipcMain.handle('db-transaction', async (event, operations) => {
    try {
      const result = await db.transaction(async () => {
        const results = [];
        for (const op of operations) {
          let opResult;
          switch (op.type) {
            case 'select':
              opResult = await db.all(op.query, op.params);
              break;
            case 'insert':
              opResult = await db.run(op.query, op.params);
              break;
            case 'delete':
              opResult = await db.delete(op.query, op.params);
              break;
            default:
              throw new Error(`Unknown operation type: ${op.type}`);
          }
          results.push(opResult);
        }
        return results;
      });
      return { success: true, results: result };
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
    dialog.showErrorBox('Load Error', `Failed to load application: ${error.message}`);
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    dialog.showErrorBox('Load Error', `Page failed to load: ${errorDescription} (${errorCode})`);
  });

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
