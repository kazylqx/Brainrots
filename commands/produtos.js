const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const Database = require('../utils/database');
const Helpers = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('produtos')
        .setDescription('🛍️ Exibir catálogo de produtos disponíveis'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const products = await Database.getProducts(true);

            if (products.length === 0) {
                return await interaction.editReply({
                    embeds: [Helpers.createWarningEmbed('📦 Nenhum produto disponível no momento!')]
                });
            }

            // Criar embed principal do catálogo
            const catalogEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🛍️ Catálogo de Produtos')
                .setDescription('Confira nossos produtos disponíveis! Clique nos botões abaixo para interagir.')
                .setThumbnail(interaction.client.user.displayAvatarURL())
                .setFooter({ text: `${products.length} produto(s) disponível(is)` })
                .setTimestamp();

            const embeds = [catalogEmbed];

            // Criar embed para cada produto (máximo 10 por mensagem)
            for (let i = 0; i < Math.min(products.length, 10); i++) {
                const product = products[i];
                
                const productEmbed = new EmbedBuilder()
                    .setColor(Helpers.getRandomColor())
                    .setTitle(`📦 ${product.name}`)
                    .setDescription(product.description || 'Sem descrição disponível')
                    .addFields(
                        {
                            name: '💰 Preço',
                            value: Helpers.formatPrice(product.price),
                            inline: true
                        },
                        {
                            name: '📦 Estoque',
                            value: product.stock > 0 ? `${product.stock} unidades` : '❌ Esgotado',
                            inline: true
                        },
                        {
                            name: '🆔 ID',
                            value: `#${product.id}`,
                            inline: true
                        }
                    );

                if (product.image_url && Helpers.isValidUrl(product.image_url)) {
                    productEmbed.setThumbnail(product.image_url);
                }

                if (product.banner_url && Helpers.isValidUrl(product.banner_url)) {
                    productEmbed.setImage(product.banner_url);
                }

                if (product.role_id && product.role_days > 0) {
                    productEmbed.addFields({
                        name: '👑 Benefício',
                        value: `Cargo por ${product.role_days} dias`,
                        inline: false
                    });
                }

                embeds.push(productEmbed);
            }

            // Criar botões de ação para cada produto
            const components = [];
            
            for (let i = 0; i < Math.min(products.length, 5); i++) {
                const product = products[i];
                
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`product_add-to-cart_${product.id}`)
                            .setLabel(`Adicionar "${Helpers.truncateText(product.name, 15)}" ao Carrinho`)
                            .setStyle(product.stock > 0 ? ButtonStyle.Success : ButtonStyle.Secondary)
                            .setEmoji('🛒')
                            .setDisabled(product.stock <= 0),
                        new ButtonBuilder()
                            .setCustomId(`product_buy-now_${product.id}`)
                            .setLabel('Comprar Agora')
                            .setStyle(product.stock > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                            .setEmoji('💳')
                            .setDisabled(product.stock <= 0)
                    );
                
                components.push(row);
            }

            // Adicionar botão para ver carrinho
            const cartRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('product_view-cart')
                        .setLabel('Ver Meu Carrinho')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🛒')
                );
            
            components.push(cartRow);

            await interaction.editReply({
                embeds: embeds,
                components: components
            });

        } catch (error) {
            console.error('❌ Erro ao exibir produtos:', error);
            await interaction.editReply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao carregar catálogo de produtos!')]
            });
        }
    }
};
