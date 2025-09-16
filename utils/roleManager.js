const Database = require('./database');

class RoleManager {
    // Limpar cargos expirados
    static async cleanupExpiredRoles(client) {
        try {
            const expiredRoles = await Database.db.all(`
                SELECT * FROM role_assignments 
                WHERE expires_at < datetime('now')
            `);

            for (const assignment of expiredRoles) {
                try {
                    const guild = client.guilds.cache.get(assignment.guild_id);
                    if (!guild) continue;

                    const member = await guild.members.fetch(assignment.user_id);
                    if (!member) continue;

                    const role = guild.roles.cache.get(assignment.role_id);
                    if (!role) continue;

                    // Remover cargo
                    await member.roles.remove(role);
                    console.log(`👑 Cargo ${role.name} removido de ${member.user.username} (expirado)`);

                    // Notificar usuário
                    try {
                        await member.user.send({
                            embeds: [{
                                color: 0xe74c3c,
                                title: '👑 Cargo Expirado',
                                description: `Seu cargo **${role.name}** expirou e foi removido.`,
                                timestamp: new Date().toISOString()
                            }]
                        });
                    } catch (dmError) {
                        console.error('❌ Erro ao notificar usuário sobre expiração:', dmError);
                    }

                    // Remover do banco
                    await Database.db.run('DELETE FROM role_assignments WHERE id = ?', [assignment.id]);

                } catch (error) {
                    console.error(`❌ Erro ao remover cargo expirado ${assignment.id}:`, error);
                }
            }

            if (expiredRoles.length > 0) {
                console.log(`🧹 ${expiredRoles.length} cargo(s) expirado(s) removido(s)`);
            }

        } catch (error) {
            console.error('❌ Erro na limpeza de cargos expirados:', error);
        }
    }

    // Listar cargos ativos de um usuário
    static async getUserActiveRoles(userId, guildId) {
        try {
            return await Database.db.all(`
                SELECT * FROM role_assignments 
                WHERE user_id = ? AND guild_id = ? AND expires_at > datetime('now')
                ORDER BY expires_at ASC
            `, [userId, guildId]);
        } catch (error) {
            console.error('❌ Erro ao buscar cargos ativos:', error);
            return [];
        }
    }

    // Estender tempo de cargo
    static async extendRole(userId, roleId, guildId, additionalDays) {
        try {
            const assignment = await Database.db.get(`
                SELECT * FROM role_assignments 
                WHERE user_id = ? AND role_id = ? AND guild_id = ?
                ORDER BY expires_at DESC LIMIT 1
            `, [userId, roleId, guildId]);

            if (!assignment) {
                return false;
            }

            const currentExpiry = new Date(assignment.expires_at);
            const newExpiry = new Date(currentExpiry.getTime() + (additionalDays * 24 * 60 * 60 * 1000));

            await Database.db.run(`
                UPDATE role_assignments 
                SET expires_at = ? 
                WHERE id = ?
            `, [newExpiry.toISOString(), assignment.id]);

            return true;
        } catch (error) {
            console.error('❌ Erro ao estender cargo:', error);
            return false;
        }
    }
}

module.exports = RoleManager;
