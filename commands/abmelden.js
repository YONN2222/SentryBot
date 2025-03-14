const { SlashCommandBuilder } = require('@discordjs/builders');
const { buildAbsenceEmbed } = require('../utils/embedBuilder');
const { checkPermissions } = require('../utils/permissions');
const db = require('../config/jsonDB');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('abmelden')
        .setDescription('Melde dich für einen Zeitraum ab')
        .addStringOption(option =>
            option.setName('start')
                .setDescription('Startdatum (DD.MM.YYYY)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('ende')
                .setDescription('Enddatum (DD.MM.YYYY)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('grund')
                .setDescription('Grund der Abwesenheit')
                .setRequired(true)),

    async execute(interaction) {
        const guildConfig = db.getGuildConfig(interaction.guildId);

        // Check permissions
        if (!await checkPermissions(interaction, guildConfig.requiredRole)) {
            return await interaction.reply({
                content: '⚠️ Du hast nicht die erforderlichen Berechtigungen für diesen Befehl.',
                ephemeral: true
            });
        }

        const start = interaction.options.getString('start');
        const ende = interaction.options.getString('ende');
        const grund = interaction.options.getString('grund');

        if (!guildConfig.absenzeChannel) {
            return await interaction.reply({
                content: '⚠️ Der Abwesenheits-Channel wurde noch nicht konfiguriert.\nBitte einen Administrator `/setup` ausführen lassen.',
                ephemeral: true
            });
        }

        const channel = await interaction.guild.channels.fetch(guildConfig.absenzeChannel);
        if (!channel) {
            return await interaction.reply({
                content: '❌ Der konfigurierte Channel wurde nicht gefunden.\nBitte einen Administrator bitten, den Channel neu zu konfigurieren.',
                ephemeral: true
            });
        }

        const embed = buildAbsenceEmbed(interaction.user, start, ende, grund);
        await channel.send({ embeds: [embed] });

        await interaction.reply({
            content: '✅ Deine Abwesenheit wurde erfolgreich eingetragen!',
            ephemeral: true
        });
    },
};