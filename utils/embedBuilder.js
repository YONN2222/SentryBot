const { EmbedBuilder } = require('discord.js');

function buildAbsenceEmbed(user, start, ende, grund) {
    return new EmbedBuilder()
        .setColor('#0099ff')
        .setDescription('## 📅 Neue Abwesenheit')
        .setAuthor({
            name: user.username,
            iconURL: user.displayAvatarURL()
        })
        .addFields(
            { name: '🗓️ Start', value: start, inline: true },
            { name: '🔚 Ende', value: ende, inline: true },
            { name: '📝 Grund', value: grund }
        )
        .setTimestamp()
        .setFooter({ text: '🕒 Eingetragen am' });
}

module.exports = {
    buildAbsenceEmbed
};