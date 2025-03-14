class MemoryDB {
    constructor() {
        this.storage = new Map();
    }

    setGuildConfig(guildId, config) {
        this.storage.set(guildId, config);
    }

    getGuildConfig(guildId) {
        return this.storage.get(guildId) || {
            absenzeChannel: null,
            requiredRole: null,
            modules: ['abmelden']
        };
    }
}

module.exports = new MemoryDB();
