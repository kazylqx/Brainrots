const { Events } = require('discord.js');
const Helpers = require('../utils/helpers');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`🤖 ${client.user.tag} está online!`);
        console.log(`📊 Conectado em ${client.guilds.cache.size} servidor(es)`);
        console.log(`👥 Servindo ${client.users.cache.size} usuários`);
        
        // Definir status do bot
        client.user.setActivity('🛒 Vendas | /produtos', { type: 'WATCHING' });
        
        // Iniciar limpeza automática de carrinhos expirados (a cada hora)
        setInterval(async () => {
            for (const guild of client.guilds.cache.values()) {
                try {
                    const Database = require('../utils/database');
                    await Helpers.cleanupExpiredCarts(guild, Database);
                } catch (error) {
                    console.error('❌ Erro na limpeza automática:', error);
                }
            }
        }, 60 * 60 * 1000); // 1 hora

        // Iniciar limpeza automática de cargos expirados (a cada 30 minutos)
        setInterval(async () => {
            try {
                const RoleManager = require('../utils/roleManager');
                await RoleManager.cleanupExpiredRoles(client);
            } catch (error) {
                console.error('❌ Erro na limpeza de cargos:', error);
            }
        }, 30 * 60 * 1000); // 30 minutos
        
        console.log('✅ Bot inicializado com sucesso!');
        console.log('📝 Comandos disponíveis: /painel, /produtos, /carrinho, /cupom');
        console.log('🔧 Use /painel para acessar o painel administrativo');
    }
};
