const { Events } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        console.log(`👋 Novo membro: ${member.user.tag} (${member.id})`);
        
        // Aqui você pode adicionar lógica para:
        // - Enviar mensagem de boas-vindas
        // - Dar cargo inicial
        // - Registrar no banco de dados
        // - Etc.
    }
};
