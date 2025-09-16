const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('painel')
        .setDescription('🔧 Painel administrativo do bot (apenas para DONO)'),

    async execute(interaction) {
        // Verificar permissões
        if (!Helpers.hasOwnerPermission(interaction.member)) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Você não tem permissão para usar este comando!\n\nApenas membros com o cargo **DONO** podem acessar o painel administrativo.')],
                flags: 64
            });
        }

        // Criar embed do painel
        const panelEmbed = new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle('🔧 Painel Administrativo - DoubeBot')
            .setDescription('Bem-vindo ao painel de controle do bot! Use os botões abaixo para gerenciar produtos, vendas e configurações.')
            .addFields(
                {
                    name: '📦 Gerenciamento de Produtos',
                    value: '• Adicionar novos produtos\n• Editar produtos existentes\n• Excluir produtos\n• Gerenciar estoque',
                    inline: true
                },
                {
                    name: '📊 Vendas e Relatórios',
                    value: '• Visualizar histórico de vendas\n• Acompanhar estatísticas\n• Gerenciar cupons',
                    inline: true
                },
                {
                    name: '⚙️ Configurações',
                    value: '• Configurar PIX\n• Ajustar tempo de expiração\n• Gerenciar canais e categorias',
                    inline: true
                }
            )
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({ 
                text: `Solicitado por ${interaction.user.username}`, 
                iconURL: interaction.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Criar botões do painel
        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_add-product')
                    .setLabel('Adicionar Produto')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('➕'),
                new ButtonBuilder()
                    .setCustomId('admin_edit-product')
                    .setLabel('Editar Produto')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️'),
                new ButtonBuilder()
                    .setCustomId('admin_delete-product')
                    .setLabel('Excluir Produto')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('admin_manage-stock')
                    .setLabel('Gerenciar Estoque')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📦'),
                new ButtonBuilder()
                    .setCustomId('admin_view-sales')
                    .setLabel('Ver Vendas')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId('admin_settings')
                    .setLabel('Configurações')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('⚙️')
            );

        await interaction.reply({
            embeds: [panelEmbed],
            components: [row1, row2],
            flags: 64 // Ephemeral flag
        });
    }
};
