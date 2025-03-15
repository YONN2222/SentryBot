const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../config/jsonDB');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Zeigt Informationen an'),

    async execute(interaction) {
        const guildConfig = db.getGuildConfig(interaction.guildId);

        // Prüfe ob das Modul aktiviert ist
        if (!guildConfig.modules.includes('info')) {
            return await interaction.reply({
                content: '⚠️ Das Info-Modul ist momentan deaktiviert.',
                ephemeral: true
            });
        }

        if (!guildConfig.infoText) {
            return await interaction.reply({
                content: '⚠️ Es wurde noch kein Info-Text konfiguriert.\nBitte einen Administrator `/setup` ausführen lassen.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setDescription(guildConfig.infoText)
            .setTimestamp()
            .setFooter({ text: 'ℹ️ Server Information' });

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    },
};