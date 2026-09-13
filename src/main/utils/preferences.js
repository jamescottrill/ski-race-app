/**
 * Application preferences, stored as JSON in the Electron userData folder.
 * Today the only key is databasePath; the sync settings will join it.
 */
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class AppPreferences {
  static preferencesPath = path.join(app.getPath('userData'), 'config.json');

  static loadPreferences() {
    try {
      if (fs.existsSync(this.preferencesPath)) {
        const data = fs.readFileSync(this.preferencesPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      // Keep the unreadable file for manual recovery rather than overwriting it
      try {
        fs.copyFileSync(
          this.preferencesPath,
          `${this.preferencesPath}.corrupt`,
        );
      } catch (backupError) {
        console.error('Failed to back up corrupt preferences:', backupError);
      }
    }
    return {};
  }

  static savePreferences(preferences) {
    try {
      // Write to a temp file then rename so a crash mid-write can't
      // leave a truncated config.json behind
      const tmpPath = `${this.preferencesPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(preferences, null, 2));
      fs.renameSync(tmpPath, this.preferencesPath);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw new Error(`Could not save preferences: ${error.message}`);
    }
  }
}

module.exports = { AppPreferences };
