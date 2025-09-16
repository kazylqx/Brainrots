const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
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

                const errorMessage = {
                    content: '❌ Houve um erro ao executar este comando!',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // Botões, menus e modais
        if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
            const { handleButtonInteraction } = require('../utils/interactions');
            await handleButtonInteraction(interaction);
        }
    }
};
