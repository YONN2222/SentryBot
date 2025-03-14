const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../config/jsonDB');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Konfiguriere den Bot für deinen Server'),

    async execute(interaction) {
        // Check if user has admin permissions
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '⚠️ Du benötigst Administrator-Rechte für diesen Befehl!',
                ephemeral: true
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('module_select')
                    .setPlaceholder('Wähle ein Modul')
                    .addOptions([
                        {
                            label: 'Abmelden',
                            description: 'Konfiguriere das Abmelde-Modul',
                            value: 'abmelden',
                            emoji: '📝'
                        },
                        {
                            label: 'Startseite',
                            description: 'Zurück zur Startseite',
                            value: 'start',
                            emoji: '🏠'
                        },
                    ]),
            );

        const response = await interaction.reply({
            content: '## 🛠️ Willkommen im Setup!\nWähle ein Modul zur Konfiguration:',
            components: [row],
            ephemeral: true,
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            time: 600000 // 10 Minuten
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({
                    content: '⚠️ Du kannst nur deine eigenen Setups bearbeiten!',
                    ephemeral: true
                });
                return;
            }

            if (i.customId === 'module_select') {
                if (i.values[0] === 'abmelden') {
                    const configButton = new ButtonBuilder()
                        .setCustomId('configure_abmelden')
                        .setLabel('Konfigurieren')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('⚙️');

                    const actionRow = new ActionRowBuilder().addComponents(configButton);

                    await i.update({
                        content: '## 📝 Abmelden Modul\nHier kannst du den Channel und die erforderliche Rolle für das Abmelden festlegen.',
                        components: [actionRow],
                    });
                } else if (i.values[0] === 'start') {
                    await i.update({
                        content: '## 🛠️ Willkommen im Setup!\nWähle ein Modul zur Konfiguration:',
                        components: [row],
                    });
                }
            } else if (i.customId === 'configure_abmelden') {
                const guildConfig = db.getGuildConfig(interaction.guildId);

                const modal = new ModalBuilder()
                    .setCustomId('abmelden_config_modal')
                    .setTitle('Abmelden Konfiguration');

                const channelInput = new TextInputBuilder()
                    .setCustomId('channel_id')
                    .setLabel('Channel ID für Abmeldungen')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(guildConfig.absenzeChannel || '');

                const roleInput = new TextInputBuilder()
                    .setCustomId('role_id')
                    .setLabel('Erforderliche Rollen ID')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(guildConfig.requiredRole || '');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(channelInput),
                    new ActionRowBuilder().addComponents(roleInput)
                );

                await i.showModal(modal);
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await interaction.editReply({
                    content: '⚠️ Setup wurde aufgrund von Inaktivität beendet.\nBitte führe `/setup` erneut aus, um den Bot zu konfigurieren.',
                    components: [],
                });
            }
        });
    },
};