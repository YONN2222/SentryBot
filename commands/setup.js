const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('../config/jsonDB');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup')
        .setDescription('Konfiguriere den Bot für deinen Server'),

    async execute(interaction) {
        console.log('Debug - Setup command executed by:', interaction.user.tag);

        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            console.log('Debug - User lacks admin permissions:', interaction.user.tag);
            return await interaction.reply({
                content: '⚠️ Du benötigst Administrator-Rechte für diesen Befehl!',
                ephemeral: true
            });
        }

        // Haupt-Menü erstellen
        const mainMenu = new ActionRowBuilder()
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('setup_module_select')
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
                            description: 'Konfiguriere das Info-Modul',
                            value: 'info',
                            emoji: 'ℹ️'
                        }
                    ]),
            );

        // Zurück-Button erstellen
        const backButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('setup_back_to_main')
                    .setLabel('Zurück zur Übersicht')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏠')
            );

        console.log('Debug - Sending setup menu to:', interaction.user.tag);
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
            console.log('Debug - Setup interaction received:', i.customId);

            if (i.user.id !== interaction.user.id) {
                await i.reply({
                    content: '⚠️ Du kannst nur deine eigenen Setups bearbeiten!',
                    ephemeral: true
                });
                return;
            }

            const guildConfig = db.getGuildConfig(interaction.guildId);
            console.log('Debug - Current guild config:', guildConfig);

            if (i.customId === 'setup_module_select') {
                console.log('Debug - Selected module:', i.values[0]);

                switch(i.values[0]) {
                    case 'abmelden':
                        const configButton = new ButtonBuilder()
                            .setCustomId('setup_configure_abmelden')
                            .setLabel('Konfigurieren')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⚙️');

                        const toggleButton = new ButtonBuilder()
                            .setCustomId('setup_toggle_abmelden')
                            .setLabel(guildConfig.modules.includes('abmelden') ? 'Deaktivieren' : 'Aktivieren')
                            .setStyle(guildConfig.modules.includes('abmelden') ? ButtonStyle.Danger : ButtonStyle.Success)
                            .setEmoji(guildConfig.modules.includes('abmelden') ? '🔴' : '🟢');

                        const actionRow = new ActionRowBuilder().addComponents(configButton, toggleButton);

                        await i.update({
                            content: `## 📝 Abmelden Modul (${guildConfig.modules.includes('abmelden') ? '🟢 Aktiv' : '🔴 Inaktiv'})\nHier kannst du den Channel und die erforderliche Rolle für das Abmelden festlegen.`,
                            components: [actionRow, backButton],
                        });
                        break;

                    case 'help':
                        const helpConfigButton = new ButtonBuilder()
                            .setCustomId('setup_configure_help')
                            .setLabel('Konfigurieren')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⚙️');

                        const helpToggleButton = new ButtonBuilder()
                            .setCustomId('setup_toggle_help')
                            .setLabel(guildConfig.modules.includes('help') ? 'Deaktivieren' : 'Aktivieren')
                            .setStyle(guildConfig.modules.includes('help') ? ButtonStyle.Danger : ButtonStyle.Success)
                            .setEmoji(guildConfig.modules.includes('help') ? '🔴' : '🟢');

                        const helpActionRow = new ActionRowBuilder().addComponents(helpConfigButton, helpToggleButton);

                        await i.update({
                            content: `## ❓ Hilfe Modul (${guildConfig.modules.includes('help') ? '🟢 Aktiv' : '🔴 Inaktiv'})\nHier kannst du den Support-Channel und optional eine Ping-Rolle festlegen.`,
                            components: [helpActionRow, backButton],
                        });
                        break;

                    case 'info':
                        const infoConfigButton = new ButtonBuilder()
                            .setCustomId('setup_configure_info')
                            .setLabel('Konfigurieren')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('⚙️');

                        const infoToggleButton = new ButtonBuilder()
                            .setCustomId('setup_toggle_info')
                            .setLabel(guildConfig.modules.includes('info') ? 'Deaktivieren' : 'Aktivieren')
                            .setStyle(guildConfig.modules.includes('info') ? ButtonStyle.Danger : ButtonStyle.Success)
                            .setEmoji(guildConfig.modules.includes('info') ? '🔴' : '🟢');

                        const infoActionRow = new ActionRowBuilder().addComponents(infoConfigButton, infoToggleButton);

                        await i.update({
                            content: `## ℹ️ Info Modul (${guildConfig.modules.includes('info') ? '🟢 Aktiv' : '🔴 Inaktiv'})\nHier kannst du den Text festlegen, der bei /info angezeigt wird.`,
                            components: [infoActionRow, backButton],
                        });
                        break;
                }
            } else if (i.customId === 'setup_back_to_main') {
                console.log('Debug - Returning to main menu');
                await i.update({
                    content: '## 🛠️ Willkommen im Setup!\nWähle ein Modul zur Konfiguration:',
                    components: [mainMenu],
                });
            } else if (i.customId === 'setup_configure_abmelden') {
                console.log('Debug - Opening abmelden config modal');
                const modal = new ModalBuilder()
                    .setCustomId('setup_abmelden_config_modal')
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
            } else if (i.customId === 'setup_configure_help') {
                console.log('Debug - Opening help config modal');
                const modal = new ModalBuilder()
                    .setCustomId('setup_help_config_modal')
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
            } else if (i.customId === 'setup_configure_info') {
                console.log('Debug - Opening info config modal');
                const modal = new ModalBuilder()
                    .setCustomId('setup_info_config_modal')
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
            } else if (i.customId.startsWith('setup_toggle_')) {
                const moduleName = i.customId.replace('setup_toggle_', '');
                console.log('Debug - Toggling module:', moduleName);

                const modules = new Set(guildConfig.modules);
                if (modules.has(moduleName)) {
                    modules.delete(moduleName);
                } else {
                    modules.add(moduleName);
                }

                db.setGuildConfig(interaction.guildId, {
                    modules: Array.from(modules)
                });

                const newConfig = db.getGuildConfig(interaction.guildId);
                const isActive = newConfig.modules.includes(moduleName);

                await i.reply({
                    content: `${isActive ? '✅' : '❌'} Das Modul "${moduleName}" wurde ${isActive ? 'aktiviert' : 'deaktiviert'}.`,
                    ephemeral: true
                });

                // Aktualisiere die Ansicht
                const configButton = new ButtonBuilder()
                    .setCustomId(`setup_configure_${moduleName}`)
                    .setLabel('Konfigurieren')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚙️');

                const toggleButton = new ButtonBuilder()
                    .setCustomId(`setup_toggle_${moduleName}`)
                    .setLabel(isActive ? 'Deaktivieren' : 'Aktivieren')
                    .setStyle(isActive ? ButtonStyle.Danger : ButtonStyle.Success)
                    .setEmoji(isActive ? '🔴' : '🟢');

                const actionRow = new ActionRowBuilder().addComponents(configButton, toggleButton);

                let moduleEmoji = '📝';
                let moduleDescription = 'Abmelden Modul';
                if (moduleName === 'help') {
                    moduleEmoji = '❓';
                    moduleDescription = 'Hilfe Modul';
                } else if (moduleName === 'info') {
                    moduleEmoji = 'ℹ️';
                    moduleDescription = 'Info Modul';
                }

                await i.message.edit({
                    content: `## ${moduleEmoji} ${moduleDescription} (${isActive ? '🟢 Aktiv' : '🔴 Inaktiv'})`,
                    components: [actionRow, backButton],
                });
            }
        });

        collector.on('end', async (collected) => {
            console.log('Debug - Setup collector ended. Interactions:', collected.size);
            if (collected.size === 0) {
                await interaction.editReply({
                    content: '⚠️ Setup wurde aufgrund von Inaktivität beendet.\nBitte führe `/setup` erneut aus, um den Bot zu konfigurieren.',
                    components: [],
                });
            }
        });
    },
};