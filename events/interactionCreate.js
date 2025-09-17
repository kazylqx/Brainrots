const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Log de atividade para debug
        console.log(`🔄 Interação recebida: ${interaction.type} | User: ${interaction.user.username} | Time: ${new Date().toISOString()}`);
        
        // Comandos slash
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`❌ Comando ${interaction.commandName} não encontrado`);
                return;
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error('❌ Erro ao executar comando:', error);

                // Verificar se é erro de interação expirada
                if (error.code === 10062 || error.code === 40060) {
                    console.log(`⚠️ Comando ${interaction.commandName} - Interação expirou (código: ${error.code})`);
                    return;
                }

                // Verificar idade da interação
                const interactionAge = Date.now() - interaction.createdTimestamp;
                if (interactionAge > 14000) {
                    console.log(`⚠️ Comando ${interaction.commandName} - Interação muito antiga (${interactionAge}ms)`);
                    return;
                }

                const errorMessage = {
                    content: '❌ Houve um erro ao executar este comando!',
                    flags: 64
                };

                try {
                    if (interaction.replied) {
                        await interaction.followUp(errorMessage);
                    } else if (interaction.deferred) {
                        await interaction.editReply(errorMessage);
                    } else {
                        await interaction.reply(errorMessage);
                    }
                } catch (replyError) {
                    console.error('❌ Erro ao responder comando:', replyError);
                }
            }
        }

        // Botões, menus e modais
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            try {
                // Verificar se a interação não expirou
                const interactionAge = Date.now() - interaction.createdTimestamp;
                if (interactionAge > 14000) {
                    console.log(`⚠️ Interação ${interaction.id} muito antiga (${interactionAge}ms), ignorando...`);
                    return;
                }
                
                const { handleButtonInteraction } = require('../utils/interactions');
                await handleButtonInteraction(interaction);
            } catch (error) {
                console.error('❌ Erro ao processar interação:', error);
                
                // Verificar se é erro de interação expirada ou já acknowledgment
                if (error.code === 10062 || error.code === 40060) {
                    console.log(`⚠️ Interação ${interaction.id} expirou ou já foi processada (código: ${error.code})`);
                    return;
                }
                
                const errorMessage = {
                    content: '❌ Erro interno. Tente novamente.',
                    flags: 64
                };
                
                try {
                    // Verificar idade da interação antes de responder
                    const ageCheck = Date.now() - interaction.createdTimestamp;
                    if (ageCheck > 14000) {
                        console.log(`⚠️ Não respondendo erro - interação muito antiga (${ageCheck}ms)`);
                        return;
                    }
                    
                    if (interaction.replied) {
                        await interaction.followUp(errorMessage);
                    } else if (interaction.deferred) {
                        await interaction.editReply(errorMessage);
                    } else {
                        await interaction.reply(errorMessage);
                    }
                } catch (replyError) {
                    console.error('❌ Exceção não capturada:', replyError);
                }
            }
        }
    }
};
