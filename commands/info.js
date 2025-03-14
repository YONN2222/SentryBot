const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const db = require('../config/jsonDB');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Zeigt Informationen an'),

    async execute(interaction) {
        const guildConfig = db.getGuildConfig(interaction.guildId);

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
            embeds: [embed]
        });
    },
};
