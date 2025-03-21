const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const db = require('./config/jsonDB');
const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Environment variables
const token = process.env['DISCORD_TOKEN'];
const clientId = process.env['CLIENT_ID'];

if (!token || !clientId) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// Load commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const commands = [];

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

// Register commands
const rest = new REST({ version: '9' }).setToken(token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error during command registration:', error);
    }
})();

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Handle interactions
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isCommand()) {
            console.log('Debug - Command executed:', interaction.commandName);
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            await command.execute(interaction);
        }
        // Handle user reply button
        else if (interaction.isButton() && interaction.customId.startsWith('help_reply_')) {
            const modal = new ModalBuilder()
                .setCustomId(`help_user_reply_modal_${interaction.message.id}`)
                .setTitle('Antwort verfassen');

            const responseInput = new TextInputBuilder()
                .setCustomId('response')
                .setLabel('Deine Antwort')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(responseInput)
            );

            await interaction.showModal(modal);
        }
        // Handle user reply submission
        else if (interaction.isModalSubmit() && interaction.customId.startsWith('help_user_reply_modal_')) {
            const response = interaction.fields.getTextInputValue('response');
            console.log('Debug - Got user response:', response);
            console.log('Debug - User ID:', interaction.user.id);

            let threadFound = false;
            const guilds = client.guilds.cache;

            // Durchsuche alle Server
            for (const [, guild] of guilds) {
                const config = db.getGuildConfig(guild.id);
                if (!config.modules || !config.modules.includes('hilfe') || !config.helpChannel) continue;

                const channel = await guild.channels.fetch(config.helpChannel);
                if (!channel) continue;

                console.log('Debug - Checking help channel in guild:', guild.name);

                // Durchsuche aktive und archivierte Threads
                const activeThreads = await channel.threads.fetchActive();
                const archivedThreads = await channel.threads.fetchArchived();
                const allThreads = [...activeThreads.threads.values(), ...archivedThreads.threads.values()];

                for (const thread of allThreads) {
                    try {
                        console.log('Debug - Checking thread:', thread.name);

                        const starterMessage = await thread.fetchStarterMessage();
                        if (!starterMessage) {
                            console.log('Debug - No starter message found');
                            continue;
                        }

                        const embed = starterMessage.embeds[0];
                        if (!embed || !embed.description?.includes('Neue Hilfe-Anfrage')) {
                            console.log('Debug - Not a help request thread');
                            continue;
                        }

                        // Finde das Mitglied-Feld
                        const userIdField = embed.fields.find(field => field.name === 'Mitglied');
                        if (!userIdField) {
                            console.log('Debug - No user ID field found');
                            continue;
                        }

                        // Extrahiere die User-ID aus dem Mention-String
                        const userId = userIdField.value.replace(/[<@>]/g, '');
                        console.log('Debug - Thread user ID:', userId);
                        console.log('Debug - Current user ID:', interaction.user.id);

                        if (userId !== interaction.user.id) {
                            console.log('Debug - User ID mismatch');
                            continue;
                        }

                        console.log('Debug - Found matching thread, sending response');

                        // Create response embed
                        const responseEmbed = new EmbedBuilder()
                            .setColor('#0099ff')
                            .setDescription('## ↩️ Antwort vom Nutzer')
                            .setAuthor({
                                name: interaction.user.username,
                                iconURL: interaction.user.displayAvatarURL()
                            })
                            .addFields(
                                { name: '📝 Nachricht', value: response }
                            )
                            .setTimestamp()
                            .setFooter({ text: '💬 Nutzer-Antwort' });

                        await thread.send({ embeds: [responseEmbed] });
                        threadFound = true;

                        await interaction.reply({
                            content: '✅ Deine Antwort wurde erfolgreich gesendet!',
                            ephemeral: true
                        });
                        break;
                    } catch (error) {
                        console.error('Error processing thread:', error);
                        console.error('Error stack:', error.stack);
                    }
                }
                if (threadFound) break;
            }

            if (!threadFound) {
                console.log('Debug - No matching thread found for user');
                await interaction.reply({
                    content: '❌ Konnte den zugehörigen Thread nicht finden.',
                    ephemeral: true
                });
            }
        }
        // Handle "mark as solved" button
        else if (interaction.isButton() && interaction.customId.startsWith('solved_help_')) {
            const userId = interaction.customId.replace('solved_help_', '');
            const modal = new ModalBuilder()
                .setCustomId(`solved_help_modal_${userId}`)
                .setTitle('Hilfe-Anfrage lösen');

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Grund für die Lösung')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(reasonInput)
            );

            await interaction.showModal(modal);
        }
        // Handle "mark as solved" submission
        else if (interaction.isModalSubmit() && interaction.customId.startsWith('solved_help_modal_')) {
            const userId = interaction.customId.replace('solved_help_modal_', '');
            const reason = interaction.fields.getTextInputValue('reason');

            try {
                const user = await client.users.fetch(userId);
                const solvedEmbed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setDescription('## ✅ Deine Hilfe-Anfrage wurde gelöst')
                    .addFields(
                        { name: '📝 Grund', value: reason },
                        { name: '👤 Team-Mitglied', value: `<@${interaction.user.id}>` }
                    )
                    .setTimestamp()
                    .setFooter({ text: '✅ Hilfe-Anfrage gelöst' });

                await user.send({ embeds: [solvedEmbed] });

                // Update original message
                const message = interaction.message;
                const originalEmbed = message.embeds[0];
                originalEmbed.data.description = '## ✅ Hilfe-Anfrage gelöst';
                originalEmbed.data.color = 0x00ff00;
                originalEmbed.data.fields.push({
                    name: '✨ Lösung',
                    value: `Gelöst von <@${interaction.user.id}>\nGrund: ${reason}`
                });

                await message.edit({
                    embeds: [originalEmbed],
                    components: []
                });

                const thread = message.thread;
                if (thread) {
                    await thread.send({
                        content: `✅ Diese Hilfe-Anfrage wurde von <@${interaction.user.id}> als gelöst markiert.\nGrund: ${reason}`
                    });
                    await thread.setArchived(true);
                }

                await interaction.reply({
                    content: '✅ Die Hilfe-Anfrage wurde als gelöst markiert!',
                    ephemeral: true
                });
            } catch (error) {
                console.error('Error handling solved help modal:', error);
                await interaction.reply({
                    content: '❌ Es gab einen Fehler beim Markieren der Anfrage als gelöst.',
                    ephemeral: true
                });
            }
        }
        // Handle modal submissions for setup configuration
        else if (interaction.isModalSubmit()) {
            console.log('Debug - Modal submit received:', interaction.customId);

            if (interaction.customId === 'setup_abmelden_config_modal') {
                const channelId = interaction.fields.getTextInputValue('channel_id');
                const roleId = interaction.fields.getTextInputValue('role_id');

                console.log('Debug - Validating abmelden config:', { channelId, roleId });

                // Verify channel exists
                const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                if (!channel) {
                    console.log('Debug - Channel not found:', channelId);
                    await interaction.reply({
                        content: '❌ Der angegebene Channel wurde nicht gefunden!',
                        ephemeral: true
                    });
                    return;
                }

                // Verify role exists
                const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                if (!role) {
                    console.log('Debug - Role not found:', roleId);
                    await interaction.reply({
                        content: '❌ Die angegebene Rolle wurde nicht gefunden!',
                        ephemeral: true
                    });
                    return;
                }

                console.log('Debug - Saving abmelden config:', { channelId, roleId });
                db.setGuildConfig(interaction.guildId, {
                    absenzeChannel: channelId,
                    requiredRole: roleId
                });

                await interaction.reply({
                    content: '✅ Konfiguration erfolgreich gespeichert!',
                    ephemeral: true
                });
            } else if (interaction.customId === 'setup_hilfe_config_modal') {
                const channelId = interaction.fields.getTextInputValue('help_channel_id');
                const roleId = interaction.fields.getTextInputValue('help_role_id');

                console.log('Debug - Validating hilfe config:', { channelId, roleId });

                // Verify channel exists
                const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                if (!channel) {
                    console.log('Debug - Channel not found:', channelId);
                    await interaction.reply({
                        content: '❌ Der angegebene Channel wurde nicht gefunden!',
                        ephemeral: true
                    });
                    return;
                }

                // Verify role exists if provided
                if (roleId) {
                    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                    if (!role) {
                        console.log('Debug - Role not found:', roleId);
                        await interaction.reply({
                            content: '❌ Die angegebene Ping-Rolle wurde nicht gefunden!',
                            ephemeral: true
                        });
                        return;
                    }
                }

                console.log('Debug - Saving hilfe config:', { channelId, roleId });
                db.setGuildConfig(interaction.guildId, {
                    helpChannel: channelId,
                    helpPingRole: roleId || null
                });

                await interaction.reply({
                    content: '✅ Konfiguration erfolgreich gespeichert!',
                    ephemeral: true
                });
            } else if (interaction.customId === 'setup_info_config_modal') {
                const infoText = interaction.fields.getTextInputValue('info_text');

                console.log('Debug - Saving info config');
                db.setGuildConfig(interaction.guildId, {
                    infoText: infoText
                });

                await interaction.reply({
                    content: '✅ Info-Text erfolgreich gespeichert!',
                    ephemeral: true
                });
            }
        }
        // Handle messages in help threads
        else if (interaction.isMessageComponent()) {
          console.log("Message Component received");
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        console.error('Error stack:', error.stack);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Es gab einen Fehler bei der Ausführung des Befehls!',
                ephemeral: true
            });
        }
    }
});

// Handle messages in help threads
client.on('messageCreate', async message => {
    try {
        // Ignore bot messages and messages not in threads
        if (message.author.bot || !message.channel.isThread()) return;

        const thread = message.channel;
        const starterMessage = await thread.fetchStarterMessage();
        if (!starterMessage) return;

        const embed = starterMessage.embeds[0];
        if (!embed || !embed.description?.includes('Neue Hilfe-Anfrage')) return;

        // Find user ID field in embed fields
        const userIdField = embed.fields.find(field => field.name === 'Mitglied');
        console.log('Debug - User ID Field:', userIdField);

        if (!userIdField) {
            console.log('Debug - No User ID field found in embed');
            await thread.send('⚠️ Konnte keine Benutzer-ID finden.');
            return;
        }

        try {
            // Get user ID from mention string
            const userId = userIdField.value.replace(/[<@>]/g, '');
            console.log('Debug - Attempting to fetch user with ID:', userId);
            const user = await client.users.fetch(userId);
            if (!user) {
                console.log('Debug - Could not fetch user with ID:', userId);
                await thread.send('⚠️ Konnte den Nutzer nicht finden.');
                return;
            }

            // Create DM embed
            const dmEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setDescription('## ✉️ Neue Nachricht zu deiner Hilfe-Anfrage')
                .setAuthor({
                    name: message.author.username,
                    iconURL: message.author.displayAvatarURL()
                })
                .addFields(
                    { name: '📝 Nachricht', value: message.content },
                    { name: '👤 Team-Mitglied', value: `<@${message.author.id}>` }
                )
                .setTimestamp()
                .setFooter({ text: '💬 Support-Nachricht' });

            // Add reply button
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`help_reply_${message.id}`)
                        .setLabel('Antworten')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('↩️')
                );

            console.log('Debug - Attempting to send DM to user:', user.username);
            await user.send({
                embeds: [dmEmbed],
                components: [row]
            });

            console.log('Debug - Successfully sent DM to user:', user.username);

        } catch (error) {
            console.error('Error sending DM:', error);
            await thread.send('⚠️ Konnte die Nachricht nicht an den Nutzer senden. Möglicherweise sind seine DMs deaktiviert.');
        }
    } catch (error) {
        console.error('Error handling thread message:', error);
    }
});

client.login(token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});