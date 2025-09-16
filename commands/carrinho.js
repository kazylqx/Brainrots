const { SlashCommandBuilder } = require('discord.js');
const Database = require('../utils/database');
const Helpers = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('carrinho')
        .setDescription('🛒 Ver seu carrinho de compras atual'),

    async execute(interaction) {
        try {
            const cart = await Database.getCartByUser(interaction.user.id);
            
            if (!cart) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('🛒 Seu carrinho está vazio!\n\nUse `/produtos` para ver os itens disponíveis.')],
                    ephemeral: true
                });
            }

            const cartItems = await Database.getCartItems(cart.id);
            
            if (cartItems.length === 0) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('🛒 Seu carrinho está vazio!\n\nUse `/produtos` para adicionar itens.')],
                    ephemeral: true
                });
            }

            const itemsText = cartItems.map((item, index) => 
                `**${index + 1}.** ${item.name}\n` +
                `   • Quantidade: ${item.quantity}\n` +
                `   • Preço unitário: ${Helpers.formatPrice(item.unit_price)}\n` +
                `   • Subtotal: ${Helpers.formatPrice(item.quantity * item.unit_price)}`
            ).join('\n\n');

            const total = cartItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            const expirationDate = new Date(cart.expires_at);
            const timeLeft = expirationDate.getTime() - Date.now();

            await interaction.reply({
                embeds: [{
                    color: 0x3498db,
                    title: '🛒 Seu Carrinho de Compras',
                    description: itemsText,
                    fields: [
                        {
                            name: '💰 Total',
                            value: Helpers.formatPrice(total),
                            inline: true
                        },
                        {
                            name: '📦 Itens',
                            value: cartItems.length.toString(),
                            inline: true
                        },
                        {
                            name: '⏰ Expira em',
                            value: timeLeft > 0 ? Helpers.timeToString(timeLeft) : '❌ Expirado',
                            inline: true
                        }
                    ],
                    footer: { text: 'Use os botões abaixo para gerenciar seu carrinho' },
                    timestamp: new Date().toISOString()
                }],
                components: [
                    {
                        type: 1,
                        components: [
                            {
                                type: 2,
                                style: 3,
                                label: 'Finalizar Compra',
                                emoji: { name: '💳' },
                                custom_id: 'cart_checkout'
                            },
                            {
                                type: 2,
                                style: 2,
                                label: 'Aplicar Cupom',
                                emoji: { name: '🎟️' },
                                custom_id: 'cart_apply-coupon'
                            },
                            {
                                type: 2,
                                style: 4,
                                label: 'Limpar Carrinho',
                                emoji: { name: '🗑️' },
                                custom_id: 'cart_clear'
                            }
                        ]
                    }
                ],
                ephemeral: true
            });

        } catch (error) {
            console.error('❌ Erro ao visualizar carrinho:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao carregar seu carrinho!')],
                ephemeral: true
            });
        }
    }
};
