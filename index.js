const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const db = require('./config/jsonDB');
const { ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Improved environment variable access and validation
const token = process.env['DISCORD_TOKEN'];
const clientId = process.env['CLIENT_ID'];

// Validate environment variables
if (!token) {
    console.error('DISCORD_TOKEN is not set in environment variables');
    process.exit(1);
}

if (!clientId) {
    console.error('CLIENT_ID is not set in environment variables');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
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
        console.log(`Using Client ID: ${clientId}`);

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

// Handle all interactions
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            await command.execute(interaction);
        } else if (interaction.isModalSubmit() && interaction.customId.startsWith('solved_help_modal_')) {
            const userId = interaction.customId.replace('solved_help_modal_', '');
            const reason = interaction.fields.getTextInputValue('reason');
            const message = interaction.message;

            try {
                const user = await client.users.fetch(userId);
                const embed = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setDescription('## ✅ Deine Hilfe-Anfrage wurde gelöst')
                    .addFields(
                        { name: '📝 Grund', value: reason },
                        { name: '👤 Team-Mitglied', value: interaction.user.username }
                    )
                    .setTimestamp()
                    .setFooter({ text: '✅ Hilfe-Anfrage gelöst' });

                await user.send({ embeds: [embed] });

                // Original message updaten
                const originalEmbed = message.embeds[0];
                originalEmbed.data.description = '## ✅ Hilfe-Anfrage gelöst';
                originalEmbed.data.color = 0x00ff00;
                originalEmbed.data.fields.push({ 
                    name: '✨ Lösung', 
                    value: `Gelöst von ${interaction.user.username}\nGrund: ${reason}` 
                });

                await message.edit({ 
                    embeds: [originalEmbed],
                    components: [] 
                });

                const thread = message.thread;
                if (thread) {
                    await thread.send({
                        content: `✅ Diese Hilfe-Anfrage wurde von ${interaction.user.username} als gelöst markiert.\nGrund: ${reason}`
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
        } else if (interaction.isButton() && interaction.customId.startsWith('solved_help_')) {
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
        } else if (interaction.isButton() && interaction.customId.startsWith('help_reply_')) {
            const messageId = interaction.customId.replace('help_reply_', '');

            const modal = new ModalBuilder()
                .setCustomId(`help_user_reply_modal_${messageId}`)
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
        } else if (interaction.isModalSubmit() && interaction.customId.startsWith('help_user_reply_modal_')) {
            const messageId = interaction.customId.replace('help_user_reply_modal_', '');
            const response = interaction.fields.getTextInputValue('response');

            // Find all help threads
            const guilds = client.guilds.cache;
            for (const [, guild] of guilds) {
                const config = db.getGuildConfig(guild.id);
                if (!config.helpChannel) continue;

                const channel = await guild.channels.fetch(config.helpChannel);
                if (!channel) continue;

                // Search for the user's help thread
                const threads = await channel.threads.fetch({ archived: true });
                for (const [, thread] of threads) {
                    const starterMessage = await thread.fetchStarterMessage();
                    if (!starterMessage) continue;
                    const embed = starterMessage.embeds[0];
                    if (!embed?.author?.name) continue;
                    if (embed.author.name !== interaction.user.username) continue;

                    // Send the response to the thread
                    const responseEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setDescription('## ↩️ Antwort vom Nutzer')
                        .setAuthor({
                            name: interaction.user.username,
                            iconURL: interaction.user.displayAvatarURL()
                        })
                        .addFields(
                            { name: '📝 Nachricht', value: response },
                            { name: '👤 Nutzer', value: interaction.user.username }
                        )
                        .setTimestamp()
                        .setFooter({ text: '💬 Nutzer-Antwort' });

                    await thread.send({ embeds: [responseEmbed] });

                    await interaction.reply({
                        content: '✅ Deine Antwort wurde erfolgreich gesendet!',
                        ephemeral: true
                    });
                    return;
                }
            }

            await interaction.reply({
                content: '❌ Konnte den zugehörigen Thread nicht finden.',
                ephemeral: true
            });
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'abmelden_config_modal') {
                const channelId = interaction.fields.getTextInputValue('channel_id');
                const roleId = interaction.fields.getTextInputValue('role_id');

                // Verify channel exists
                const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                if (!channel) {
                    await interaction.reply({
                        content: '❌ Der angegebene Channel wurde nicht gefunden!',
                        ephemeral: true
                    });
                    return;
                }

                // Verify role exists
                const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                if (!role) {
                    await interaction.reply({
                        content: '❌ Die angegebene Rolle wurde nicht gefunden!',
                        ephemeral: true
                    });
                    return;
                }

                db.setGuildConfig(interaction.guildId, {
                    absenzeChannel: channelId,
                    requiredRole: roleId
                });

                await interaction.reply({
                    content: '✅ Konfiguration erfolgreich gespeichert!',
                    ephemeral: true
                });
            } else if (interaction.customId === 'help_config_modal') {
                const channelId = interaction.fields.getTextInputValue('help_channel_id');
                const roleId = interaction.fields.getTextInputValue('help_role_id');

                // Verify channel exists
                const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
                if (!channel) {
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
                        await interaction.reply({
                            content: '❌ Die angegebene Ping-Rolle wurde nicht gefunden!',
                            ephemeral: true
                        });
                        return;
                    }
                }

                db.setGuildConfig(interaction.guildId, {
                    helpChannel: channelId,
                    helpPingRole: roleId || null
                });

                await interaction.reply({
                    content: '✅ Konfiguration erfolgreich gespeichert!',
                    ephemeral: true
                });
            } else if (interaction.customId === 'info_config_modal') {
                const infoText = interaction.fields.getTextInputValue('info_text');

                db.setGuildConfig(interaction.guildId, {
                    infoText: infoText
                });

                await interaction.reply({
                    content: '✅ Info-Text erfolgreich gespeichert!',
                    ephemeral: true
                });
            } else if (interaction.customId.startsWith('help_reply_modal_')) {
                const userId = interaction.customId.replace('help_reply_modal_', '');
                const response = interaction.fields.getTextInputValue('response');

                try {
                    const user = await client.users.fetch(userId);
                    const embed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setDescription('## ✉️ Antwort auf deine Hilfe-Anfrage')
                        .addFields(
                            { name: '📝 Antwort', value: response },
                            { name: '👤 Team-Mitglied', value: interaction.user.username }
                        )
                        .setTimestamp()
                        .setFooter({ text: '✅ Hilfe-Anfrage beantwortet' });

                    await user.send({ embeds: [embed] });

                    await interaction.reply({
                        content: '✅ Antwort wurde erfolgreich an den Nutzer gesendet!',
                        ephemeral: true
                    });
                } catch (error) {
                    await interaction.reply({
                        content: '❌ Konnte die Nachricht nicht an den Nutzer senden. Möglicherweise sind seine DMs deaktiviert.',
                        ephemeral: true
                    });
                }
            }
        } else if (interaction.isButton() && interaction.customId.startsWith('reply_help_')) {
            const userId = interaction.customId.replace('reply_help_', '');

            const modal = new ModalBuilder()
                .setCustomId(`help_reply_modal_${userId}`)
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
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Es gab einen Fehler bei der Ausführung des Befehls!',
                ephemeral: true
            }).catch(console.error);
        }
    }
});

// Thread message handler
client.on('messageCreate', async message => {
    try {
        // Ignore bot messages and messages not in threads
        if (message.author.bot || !message.channel.isThread()) return;

        const thread = message.channel;
        const parentMessage = await thread.fetchStarterMessage();
        if (!parentMessage) return;

        const embed = parentMessage.embeds[0];
        if (!embed || !embed.description?.includes('Neue Hilfe-Anfrage')) return;

        // Get user from the embed's author
        const username = embed.author?.name;
        if (!username) return;

        try {
            // Find the user in the guild members
            const guild = message.guild;
            const members = await guild.members.fetch();
            const member = members.find(m => m.user.username === username);
            if (!member) {
                await thread.send('⚠️ Konnte den Nutzer nicht finden.');
                return;
            }

            // Send DM to user
            const dmEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setDescription('## ✉️ Neue Nachricht zu deiner Hilfe-Anfrage')
                .setAuthor({
                    name: message.author.username,
                    iconURL: message.author.displayAvatarURL()
                })
                .addFields(
                    { name: '📝 Nachricht', value: message.content },
                    { name: '👤 Team-Mitglied', value: message.author.username }
                )
                .setTimestamp()
                .setFooter({ text: '💬 Support-Nachricht' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`help_reply_${message.id}`)
                        .setLabel('Antworten')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('↩️')
                );

            await member.user.send({ 
                embeds: [dmEmbed],
                components: [row]
            });

        } catch (error) {
            console.error('Error sending DM:', error);
            await thread.send('⚠️ Konnte die Nachricht nicht an den Nutzer senden. Möglicherweise sind seine DMs deaktiviert.');
        }

    } catch (error) {
        console.error('Error handling thread message:', error);
    }
});

// DM handler for help responses
client.on('messageCreate', async message => {
    try {
        // Only process DMs from non-bot users
        if (!message.channel.isDMBased() || message.author.bot) return;

        // Check if the last message in this DM was from the bot and was a help response
        const messages = await message.channel.messages.fetch({ limit: 5 });
        const lastBotMessage = messages.find(m => 
            m.author.id === client.user.id && 
            m.embeds[0]?.description?.includes('Neue Nachricht zu deiner Hilfe-Anfrage')
        );

        if (!lastBotMessage) return;

        // Find all help threads
        const guilds = client.guilds.cache;
        for (const [, guild] of guilds) {
            const config = db.getGuildConfig(guild.id);
            if (!config.helpChannel) continue;

            const channel = await guild.channels.fetch(config.helpChannel);
            if (!channel) continue;

            // Search for the user's help thread
            const threads = await channel.threads.fetchActive();
            for (const [, thread] of threads) {
                const starterMessage = await thread.fetchStarterMessage();
                if (!starterMessage) continue;
                const embed = starterMessage.embeds[0];
                if (!embed?.author?.name) continue;
                if (embed.author.name !== message.author.username) continue;

                // Send the response to the thread
                const responseEmbed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setDescription('## ↩️ Antwort vom Nutzer')
                    .setAuthor({
                        name: message.author.username,
                        iconURL: message.author.displayAvatarURL()
                    })
                    .addFields(
                        { name: '📝 Nachricht', value: message.content },
                        { name: '👤 Nutzer', value: message.author.username }
                    )
                    .setTimestamp()
                    .setFooter({ text: '💬 Nutzer-Antwort' });

                await thread.send({ embeds: [responseEmbed] });
                return;
            }
        }
    } catch (error) {
        console.error('Error handling DM response:', error);
    }
});

// Improved error handling for login
client.login(token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});