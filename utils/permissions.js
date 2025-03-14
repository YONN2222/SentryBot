async function checkPermissions(interaction, requiredRoleId) {
    if (!requiredRoleId) return true;
    
    const member = await interaction.guild.members.fetch(interaction.user.id);
    return member.roles.cache.has(requiredRoleId);
}

module.exports = {
    checkPermissions
};
