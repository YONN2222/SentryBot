const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');
const path = require('path');
const db = require('./config/jsonDB');

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
        } else if (interaction.isModalSubmit() && interaction.customId === 'abmelden_config_modal') {
            const channelId = interaction.fields.getTextInputValue('channel_id');
            const roleId = interaction.fields.getTextInputValue('role_id');

            // Verify channel exists
            const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
            if (!channel) {
                await interaction.reply({
                    content: 'Der angegebene Channel wurde nicht gefunden!',
                    ephemeral: true
                });
                return;
            }

            // Verify role exists
            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            if (!role) {
                await interaction.reply({
                    content: 'Die angegebene Rolle wurde nicht gefunden!',
                    ephemeral: true
                });
                return;
            }

            db.setGuildConfig(interaction.guildId, {
                absenzeChannel: channelId,
                requiredRole: roleId,
                modules: ['abmelden']
            });

            await interaction.reply({
                content: 'Konfiguration erfolgreich gespeichert!',
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'Es gab einen Fehler bei der Ausführung des Befehls!',
                ephemeral: true
            }).catch(console.error);
        }
    }
});

// Improved error handling for login
client.login(token).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});