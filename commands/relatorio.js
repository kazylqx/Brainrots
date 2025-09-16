const { SlashCommandBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');
const SalesLogger = require('../utils/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('relatorio')
        .setDescription('📊 Gerar relatórios de vendas (apenas para DONO)')
        .addStringOption(option =>
            option.setName('periodo')
                .setDescription('Período do relatório')
                .setRequired(true)
                .addChoices(
                    { name: 'Hoje', value: 'daily' },
                    { name: 'Última Semana', value: 'weekly' },
                    { name: 'Este Mês', value: 'monthly' }
                )),

    async execute(interaction) {
        // Verificar permissões
        if (!Helpers.hasOwnerPermission(interaction.member)) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Você não tem permissão para gerar relatórios!')],
                ephemeral: true
            });
        }

        const period = interaction.options.getString('periodo');

        try {
            await interaction.deferReply({ ephemeral: true });

            const report = await SalesLogger.generateSalesReport(interaction.guild, period);

            await interaction.editReply({
                embeds: [report.embed]
            });

        } catch (error) {
            console.error('❌ Erro ao gerar relatório:', error);
            await interaction.editReply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao gerar relatório!')]
            });
        }
    }
};
