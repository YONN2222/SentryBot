const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
                content: '❌ Der konfigurierte Channel wurde nicht gefunden.\nBitte einen Administrator bitten, den Channel neu zu konfigurieren.',
                ephemeral: true
            });
        }

        const grund = interaction.options.getString('grund');
        const user = interaction.user;

        // Create help request embed
        const helpEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setDescription('## ❗ Neue Hilfe-Anfrage')
            .setAuthor({
                name: user.username,
                iconURL: user.displayAvatarURL()
            })
            .addFields(
                { name: '📝 Problem', value: grund },
                { name: '⚠️ Hinweis', value: 'Der Nutzer wird über DM benachrichtigt, wenn ein Team-Mitglied antwortet.' },
                { name: '@user', value: user.id }
            )
            .setTimestamp()
            .setFooter({ text: '🆘 Hilfe-Anfrage erstellt' });

        // Create "Mark as solved" button
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`solved_help_${user.id}`)
                    .setLabel('Als gelöst markieren')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        // Send initial message and mention support role if configured
        let content = '';
        if (guildConfig.helpPingRole) {
            content = `<@&${guildConfig.helpPingRole}>`;
        }

        // Send help request and create thread
        const message = await channel.send({
            content,
            embeds: [helpEmbed],
            components: [row]
        });

        // Create thread for discussion
        const thread = await message.startThread({
            name: `Hilfe für ${user.username}`,
            autoArchiveDuration: 60,
        });

        // Send initial thread message
        await thread.send('💬 Alle Nachrichten in diesem Thread werden automatisch an den Nutzer als DM weitergeleitet.');

        // Confirm to user
        await interaction.reply({
            content: '✅ Deine Hilfe-Anfrage wurde erfolgreich erstellt!',
            ephemeral: true
        });
    },
};