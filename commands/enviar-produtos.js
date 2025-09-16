const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const Database = require('../utils/database');
const Helpers = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('enviar-produtos')
        .setDescription('📦 Enviar catálogo de produtos para um canal específico (apenas DONO)')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('Canal onde enviar os produtos')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        // Verificar permissões
        if (!Helpers.hasOwnerPermission(interaction.member)) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Você não tem permissão para usar este comando!\n\nApenas membros com o cargo **DONO** podem enviar produtos.')],
                flags: 64 // Ephemeral
            });
        }

        const targetChannel = interaction.options.getChannel('canal');

        try {
            // Buscar produtos ativos
            const products = await Database.getProducts(true);

            if (products.length === 0) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('⚠️ Nenhum produto ativo encontrado!\n\nUse `/painel` para adicionar produtos primeiro.')],
                    flags: 64 // Ephemeral
                });
            }

            await interaction.reply({
                embeds: [Helpers.createInfoEmbed(`🔄 Enviando ${products.length} produtos para ${targetChannel}...`)],
                flags: 64 // Ephemeral
            });

            // Enviar embed principal do catálogo
            const catalogEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🛒 Catálogo de Produtos')
                .setDescription('Confira nossos produtos disponíveis! Clique nos botões abaixo para ver detalhes e adicionar ao carrinho.')
                .setThumbnail(interaction.guild.iconURL())
                .setFooter({ 
                    text: `${products.length} produtos disponíveis • Use /carrinho para ver seu carrinho`,
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setTimestamp();

            await targetChannel.send({ embeds: [catalogEmbed] });

            // Enviar cada produto individualmente
            for (const product of products) {
                const productEmbed = new EmbedBuilder()
                    .setColor(0x2ecc71)
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
                            value: product.stock > 0 ? `${product.stock} disponível` : '❌ Esgotado',
                            inline: true
                        },
                        {
                            name: '🆔 ID',
                            value: `\`${product.id}\``,
                            inline: true
                        }
                    );

                if (product.image_url) {
                    productEmbed.setThumbnail(product.image_url);
                }

                if (product.banner_url) {
                    productEmbed.setImage(product.banner_url);
                }

                if (product.role_id && product.role_days > 0) {
                    productEmbed.addFields({
                        name: '👑 Benefício',
                        value: `Cargo temporário por ${product.role_days} dias`,
                        inline: false
                    });
                }

                const productRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`product_add-to-cart_${product.id}`)
                            .setLabel('Adicionar ao Carrinho')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🛒')
                            .setDisabled(product.stock <= 0),
                        new ButtonBuilder()
                            .setCustomId(`product_details_${product.id}`)
                            .setLabel('Ver Detalhes')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('ℹ️')
                    );

                const productMessage = await targetChannel.send({
                    embeds: [productEmbed],
                    components: [productRow]
                });

                // Salvar mensagem no banco para atualizações futuras
                await Database.saveProductMessage(product.id, targetChannel.id, productMessage.id);

                // Pequena pausa para evitar rate limit
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Enviar embed final com instruções
            const instructionsEmbed = new EmbedBuilder()
                .setColor(0xf39c12)
                .setTitle('📋 Como Comprar')
                .setDescription(
                    '**1.** Clique em "Adicionar ao Carrinho" no produto desejado\n' +
                    '**2.** Use `/carrinho` para ver seus itens\n' +
                    '**3.** Clique em "Finalizar Compra" para gerar o PIX\n' +
                    '**4.** Pague e confirme o pagamento\n' +
                    '**5.** Receba seus produtos automaticamente!'
                )
                .addFields(
                    {
                        name: '💳 Formas de Pagamento',
                        value: '• PIX (Instantâneo)',
                        inline: true
                    },
                    {
                        name: '📱 Suporte',
                        value: 'Entre em contato com a administração',
                        inline: true
                    }
                )
                .setFooter({ text: 'Obrigado por escolher nossos produtos!' });

            await targetChannel.send({ embeds: [instructionsEmbed] });

            await interaction.editReply({
                embeds: [Helpers.createSuccessEmbed(`✅ Catálogo enviado com sucesso!\n\n${products.length} produtos foram enviados para ${targetChannel}.`)]
            });

        } catch (error) {
            console.error('❌ Erro ao enviar produtos:', error);
            await interaction.editReply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao enviar produtos para o canal!')]
            });
        }
    }
};
