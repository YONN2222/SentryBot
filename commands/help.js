const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../config/jsonDB');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Erstelle eine Hilfe-Anfrage')
        .addStringOption(option =>
            option.setName('grund')
                .setDescription('Beschreibe dein Problem')
                .setRequired(true)),

    async execute(interaction) {
        const guildConfig = db.getGuildConfig(interaction.guildId);

        if (!guildConfig.helpChannel) {
            return await interaction.reply({
                content: '⚠️ Der Hilfe-Channel wurde noch nicht konfiguriert.\nBitte einen Administrator `/setup` ausführen lassen.',
                ephemeral: true
            });
        }

        const channel = await interaction.guild.channels.fetch(guildConfig.helpChannel);
        if (!channel) {
            return await interaction.reply({
                content: '❌ Der konfigurierte Hilfe-Channel wurde nicht gefunden.\nBitte einen Administrator bitten, den Channel neu zu konfigurieren.',
                ephemeral: true
            });
        }

        const grund = interaction.options.getString('grund');
        const user = interaction.user;

        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('## ❗ Neue Hilfe-Anfrage')
            .setAuthor({
                name: user.username,
                iconURL: user.displayAvatarURL()
            })
            .addFields(
                { name: '📝 Problem', value: grund },
                { name: '⚠️ Hinweis', value: 'Der Nutzer wird über DM benachrichtigt, wenn ein Team-Mitglied antwortet.' }
            )
            .setTimestamp()
            .setFooter({ text: '🆘 Hilfe-Anfrage erstellt' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`solved_help_${user.id}`)
                    .setLabel('Als gelöst markieren')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        let content = '';
        if (guildConfig.helpPingRole) {
            content = `<@&${guildConfig.helpPingRole}>`;
        }

        const message = await channel.send({
            content,
            embeds: [embed],
            components: [row]
        });

        // Thread erstellen
        const thread = await message.startThread({
            name: `Hilfe für ${user.username}`,
            autoArchiveDuration: 60,
        });

        await thread.send('💬 Hier können Sie dem Nutzer eine Nachricht senden. Alle Nachrichten werden automatisch als DM weitergeleitet.');

        await interaction.reply({
            content: '✅ Deine Hilfe-Anfrage wurde erfolgreich erstellt!',
            ephemeral: true
        });
    },
};