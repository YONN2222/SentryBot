const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../config/jsonDB');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Konfiguriere den Bot für deinen Server'),

    async execute(interaction) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '⚠️ Du benötigst Administrator-Rechte für diesen Befehl!',
                ephemeral: true
            });
        }

        // Haupt-Menü erstellen
        const mainMenu = new ActionRowBuilder()
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
                            label: 'Hilfe',
                            description: 'Konfiguriere das Hilfe-Modul',
                            value: 'help',
                            emoji: '❓'
                        },
                        {
                            label: 'Info',
                            description: 'Konfiguriere den Info-Text',
                            value: 'info',
                            emoji: 'ℹ️'
                        }
                    ]),
            );

        // Zurück-Button erstellen
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_main')
                    .setLabel('Zurück zur Übersicht')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏠')
            );

        const response = await interaction.reply({
            content: '## 🛠️ Willkommen im Setup!\nWähle ein Modul zur Konfiguration:',
            components: [mainMenu],
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

            const guildConfig = db.getGuildConfig(interaction.guildId);

            if (i.customId === 'module_select') {
                switch(i.values[0]) {
                    case 'abmelden':
                        const configButton = new ButtonBuilder()
                            .setCustomId('configure_abmelden')
                            .setLabel('Konfigurieren')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⚙️');

                        const actionRow = new ActionRowBuilder().addComponents(configButton);

                        await i.update({
                            content: '## 📝 Abmelden Modul\nHier kannst du den Channel und die erforderliche Rolle für das Abmelden festlegen.',
                            components: [actionRow, backButton],
                        });
                        break;

                    case 'help':
                        const helpConfigButton = new ButtonBuilder()
                            .setCustomId('configure_help')
                            .setLabel('Konfigurieren')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⚙️');

                        const helpActionRow = new ActionRowBuilder().addComponents(helpConfigButton);

                        await i.update({
                            content: '## ❓ Hilfe Modul\nHier kannst du den Support-Channel und optional eine Ping-Rolle festlegen.',
                            components: [helpActionRow, backButton],
                        });
                        break;

                    case 'info':
                        const infoConfigButton = new ButtonBuilder()
                            .setCustomId('configure_info')
                            .setLabel('Konfigurieren')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⚙️');

                        const infoActionRow = new ActionRowBuilder().addComponents(infoConfigButton);

                        await i.update({
                            content: '## ℹ️ Info Modul\nHier kannst du den Text festlegen, der bei /info angezeigt wird.',
                            components: [infoActionRow, backButton],
                        });
                        break;
                }
            } else if (i.customId === 'back_to_main') {
                await i.update({
                    content: '## 🛠️ Willkommen im Setup!\nWähle ein Modul zur Konfiguration:',
                    components: [mainMenu],
                });
            } else if (i.customId === 'configure_abmelden') {
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
            } else if (i.customId === 'configure_help') {
                const modal = new ModalBuilder()
                    .setCustomId('help_config_modal')
                    .setTitle('Hilfe Konfiguration');

                const channelInput = new TextInputBuilder()
                    .setCustomId('help_channel_id')
                    .setLabel('Channel ID für Hilfe-Anfragen')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setValue(guildConfig.helpChannel || '');

                const roleInput = new TextInputBuilder()
                    .setCustomId('help_role_id')
                    .setLabel('Ping-Rollen ID (Optional)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false)
                    .setValue(guildConfig.helpPingRole || '');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(channelInput),
                    new ActionRowBuilder().addComponents(roleInput)
                );

                await i.showModal(modal);
            } else if (i.customId === 'configure_info') {
                const modal = new ModalBuilder()
                    .setCustomId('info_config_modal')
                    .setTitle('Info Konfiguration');

                const infoInput = new TextInputBuilder()
                    .setCustomId('info_text')
                    .setLabel('Info Text (Markdown erlaubt)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setValue(guildConfig.infoText || '');

                modal.addComponents(
                    new ActionRowBuilder().addComponents(infoInput)
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