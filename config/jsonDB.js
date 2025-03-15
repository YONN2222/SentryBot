const fs = require('fs');
const path = require('path');

class JsonDB {
    constructor() {
        this.dbPath = path.join(__dirname, 'data');
        this.filePath = path.join(this.dbPath, 'guildConfig.json');
        this.storage = new Map();
        this.initDatabase();
    }

    initDatabase() {
        // Erstelle den Dateiordner, falls er nicht existiert
        if (!fs.existsSync(this.dbPath)) {
            fs.mkdirSync(this.dbPath, { recursive: true });
        }

        // Lade existierende Daten, falls vorhanden
        if (fs.existsSync(this.filePath)) {
            try {
                const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
                Object.entries(data).forEach(([key, value]) => {
                    this.storage.set(key, value);
                });
                console.log('✅ Datenbank erfolgreich geladen');
            } catch (error) {
                console.error('❌ Fehler beim Laden der Datenbank:', error);
            }
        } else {
            // Erstelle eine leere Datei
            this.saveToFile();
            console.log('✅ Neue Datenbank erstellt');
        }
    }

    saveToFile() {
        try {
            const data = Object.fromEntries(this.storage);
            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('❌ Fehler beim Speichern der Datenbank:', error);
        }
    }

    setGuildConfig(guildId, config) {
        // Merge mit existierenden Einstellungen
        const existingConfig = this.getGuildConfig(guildId);
        this.storage.set(guildId, { ...existingConfig, ...config });
        this.saveToFile();
    }

    getGuildConfig(guildId) {
        return this.storage.get(guildId) || {
            absenzeChannel: null,
            requiredRole: null,
            helpChannel: null,
            helpPingRole: null,
            infoText: null,
            modules: ['abmelden', 'hilfe']
        };
    }
}

module.exports = new JsonDB();