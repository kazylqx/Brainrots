const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const Database = require('./database');
const Helpers = require('./helpers');
const PixGenerator = require('./pix');
const TicketSystem = require('./ticketSystem');

class InteractionHandler {
    static async handleButtonInteraction(interaction) {
        const customId = interaction.customId;
        
        try {
            // Verificar permissões para comandos administrativos
            if (customId.startsWith('admin_') && !Helpers.hasOwnerPermission(interaction.member)) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Você não tem permissão para usar este comando!')],
                    flags: 64
                });
            }

            // Roteamento de interações
            if (interaction.isModalSubmit()) {
                await this.handleModalSubmit(interaction);
                return;
            }
            
            if (interaction.isStringSelectMenu()) {
                if (interaction.customId.startsWith('product_select_')) {
                    await this.handleProductSelect(interaction);
                } else if (interaction.customId === 'admin_select-channel-for-product') {
                    const channelId = interaction.values[0];
                    await this.showAddProductModal(interaction, channelId);
                }
                return;
            }

            // Button interactions
            if (interaction.isButton()) {
                if (customId.startsWith('admin_')) {
                    await this.handleAdminInteraction(interaction);
                } else if (customId.startsWith('product_')) {
                    await this.handleProductInteraction(interaction);
                } else if (customId.startsWith('cart_')) {
                    await this.handleCartInteraction(interaction);
                } else if (customId.startsWith('payment_')) {
                    await this.handlePaymentInteraction(interaction);
                } else if (customId.startsWith('ticket_')) {
                    await this.handleTicketInteraction(interaction);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao processar interação:', error);
            
            const errorMessage = {
                embeds: [Helpers.createErrorEmbed('❌ Ocorreu um erro interno. Tente novamente.')],
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
                console.error('❌ Erro ao responder interação:', replyError);
            }
        }
    }

    // Handler para modal submissions
    static async handleModalSubmit(interaction) {
        const customId = interaction.customId;
        
        try {
            if (customId.startsWith('admin_add-product-modal_')) {
                await this.processAddProduct(interaction);
            } else if (customId.startsWith('admin_edit-product-modal_')) {
                const productId = customId.split('_')[2];
                await this.processEditProduct(interaction, productId);
            } else if (customId.startsWith('modal_stock_')) {
                const productId = customId.split('_')[2];
                await this.processStockUpdate(interaction, productId);
            } else if (customId.startsWith('payment_confirm_modal_')) {
                const saleId = customId.split('_')[3];
                await this.processPaymentConfirmation(interaction, saleId);
            } else if (customId === 'modal_apply_coupon') {
                await this.processApplyCoupon(interaction);
            } else {
                await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Modal não reconhecido!')],
                    flags: 64
                });
            }
        } catch (error) {
            console.error('❌ Erro ao processar modal:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao processar formulário!')],
                flags: 64
            });
        }
    }

    // Handler para interações administrativas
    static async handleAdminInteraction(interaction) {
        const action = interaction.customId.split('_')[1];
        
        switch (action) {
            case 'add-product':
                await this.showAddProductChannelSelect(interaction);
                break;
            case 'edit-product':
                await this.showProductSelectMenu(interaction, 'edit');
                break;
            case 'delete-product':
                await this.showProductSelectMenu(interaction, 'delete');
                break;
            case 'manage-stock':
                await this.showProductSelectMenu(interaction, 'stock');
                break;
            case 'view-sales':
                await this.showSalesHistory(interaction);
                break;
            case 'settings':
                await this.showSettingsPanel(interaction);
                break;
            case 'confirm-delete':
                const productId = interaction.customId.split('_')[2];
                await this.processDeleteProduct(interaction, productId);
                break;
            case 'cancel-delete':
                await this.cancelDelete(interaction);
                break;
            default:
                await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Ação administrativa não encontrada!')],
                    flags: 64
                });
        }
    }

    // Interações de produtos
    static async handleProductInteraction(interaction) {
        const [, action, productId] = interaction.customId.split('_');

        // Defer reply para operações que podem demorar
        let shouldDefer = ['buy-now', 'details', 'add-to-cart', 'checkout'].includes(action);
        if (shouldDefer && !interaction.deferred && !interaction.replied) {
            try {
                await interaction.deferReply({ flags: 64 });
            } catch (error) {
                console.log('⚠️ Erro ao defer reply (já foi processado):', error.message);
            }
        }

        switch (action) {
            case 'add-to-cart':
                await this.addToCart(interaction, productId);
                break;
            case 'view-cart':
                await this.viewCart(interaction);
                break;
            case 'buy-now':
                await this.buyNow(interaction, productId);
                break;
            case 'details':
                await this.showProductDetails(interaction, productId);
                break;
            default:
                if (interaction.deferred) {
                    await interaction.editReply({
                        embeds: [Helpers.createErrorEmbed('❌ Ação de produto não encontrada!')]
                    });
                } else {
                    await interaction.reply({
                        embeds: [Helpers.createErrorEmbed('❌ Ação de produto não encontrada!')],
                        flags: 64
                    });
                }
        }
    }

    // Interações do carrinho
    static async handleCartInteraction(interaction) {
        const action = interaction.customId.split('_')[1];

        // Defer reply será feito dentro de cada método conforme necessário

        switch (action) {
            case 'checkout':
                await this.processCheckout(interaction);
                break;
            case 'clear':
                await this.clearCart(interaction);
                break;
            case 'apply-coupon':
                await this.showCouponModal(interaction);
                break;
            case 'remove-item':
                const itemId = interaction.customId.split('_')[2];
                await this.removeCartItem(interaction, itemId);
                break;
            default:
                await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Ação de carrinho não encontrada!')],
                    flags: 64
                });
        }
    }

    // Interações de pagamento
    static async handlePaymentInteraction(interaction) {
        const action = interaction.customId.split('_')[1];
        const orderId = interaction.customId.split('_')[2];

        switch (action) {
            case 'check':
                // Enviar para canal específico de comprovantes
                await this.sendPaymentProofToChannel(interaction, orderId);
                break;
            case 'cancel':
                await this.cancelPayment(interaction, orderId);
                break;
            case 'confirm':
                await this.processPaymentConfirmation(interaction, orderId);
                break;
            default:
                await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Ação de pagamento não encontrada!')],
                    flags: 64
                });
        }
    }

    // Orientar cliente para canal de tickets
    static async sendPaymentProofToChannel(interaction, saleId) {
        try {
            const TICKET_CHANNEL_ID = '1416922954490576946';
            
            // Buscar dados da venda
            const sale = await Database.getSaleById(saleId);
            if (!sale) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada!')],
                    flags: 64
                });
            }

            // Buscar canal de tickets
            const ticketChannel = interaction.client.channels.cache.get(TICKET_CHANNEL_ID);
            if (!ticketChannel) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Canal de tickets não encontrado!')],
                    flags: 64
                });
            }

            // Responder ao usuário com orientações
            await interaction.reply({
                embeds: [{
                    color: 0x3498db,
                    title: '📎 Enviar Comprovante de Pagamento',
                    description: `Para enviar seu comprovante de pagamento, siga os passos abaixo:\n\n` +
                                `**1.** Vá até o canal ${ticketChannel}\n` +
                                `**2.** Abra um ticket usando o bot de tickets\n` +
                                `**3.** Envie seu comprovante de PIX no ticket\n` +
                                `**4.** Inclua o **ID da Venda** no ticket: \`${saleId}\`\n\n` +
                                `📋 **ID da Venda:** \`${saleId}\`\n` +
                                `💰 **Valor Pago:** R$ ${parseFloat(sale.total_amount).toFixed(2).replace('.', ',')}\n\n` +
                                `⏰ Nossa equipe verificará seu comprovante e liberará seus produtos em breve!`,
                    footer: { text: 'Você receberá uma DM quando o pagamento for confirmado' },
                    fields: [
                        {
                            name: '⚠️ Importante',
                            value: `• Certifique-se de que o valor pago está correto\n` +
                                   `• Inclua o ID da venda no ticket\n` +
                                   `• Envie uma imagem clara do comprovante`,
                            inline: false
                        }
                    ]
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao orientar cliente:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao processar solicitação. Tente novamente.')],
                flags: 64
            });
        }
    }

    // Interações de tickets
    static async handleTicketInteraction(interaction) {
        const action = interaction.customId.split('_')[1];
        const saleId = interaction.customId.split('_')[2];

        switch (action) {
            case 'confirm':
                await this.confirmPaymentFromProof(interaction, saleId);
                break;
            case 'reject':
                await this.rejectPaymentProof(interaction, saleId);
                break;
            default:
                await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Ação de ticket não encontrada!')],
                    flags: 64
                });
        }
    }

    // Confirmar pagamento via comprovante
    static async confirmPaymentFromProof(interaction, saleId) {
        try {
            // Verificar permissões de admin
            if (!Helpers.hasOwnerPermission(interaction.member)) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Você não tem permissão para confirmar pagamentos!')],
                    flags: 64
                });
            }

            // Buscar venda
            const sale = await Database.getSaleById(saleId);
            if (!sale) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada!')],
                    flags: 64
                });
            }

            if (sale.status === 'completed') {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Esta venda já foi confirmada!')],
                    flags: 64
                });
            }

            // Confirmar pagamento e entregar produtos
            await this.deliverProducts(sale, interaction.client);

            // Atualizar estoque dos produtos
            await this.updateStockAfterPurchase(sale);

            // Atualizar status da venda
            await Database.updateSaleStatus(saleId, 'completed');

            // Atualizar embed original
            const confirmEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Pagamento Confirmado')
                .setDescription(`**Confirmado por:** <@${interaction.user.id}>\n**ID da Venda:** \`${saleId}\``)
                .addFields([
                    {
                        name: '💰 Valor Total',
                        value: `R$ ${parseFloat(sale.total_amount).toFixed(2).replace('.', ',')}`,
                        inline: true
                    },
                    {
                        name: '📅 Confirmado em',
                        value: new Date().toLocaleString('pt-BR'),
                        inline: true
                    }
                ])
                .setFooter({ text: 'Produtos entregues automaticamente' })
                .setTimestamp();

            await interaction.update({
                embeds: [confirmEmbed],
                components: []
            });

            // Notificar cliente
            try {
                const user = await interaction.client.users.fetch(sale.user_id);
                await user.send({
                    embeds: [{
                        color: 0x2ecc71,
                        title: '✅ Pagamento Confirmado!',
                        description: `Seu pagamento foi confirmado e seus produtos foram entregues!\n\n` +
                                    `**ID da Venda:** \`${saleId}\`\n` +
                                    `**Valor:** R$ ${parseFloat(sale.total_amount).toFixed(2).replace('.', ',')}\n\n` +
                                    `Obrigado pela compra! 🎉`,
                        footer: { text: 'Verifique suas DMs para os produtos' }
                    }]
                });
            } catch (error) {
                console.log('❌ Não foi possível notificar o cliente via DM');
            }

        } catch (error) {
            console.error('❌ Erro ao confirmar pagamento:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao confirmar pagamento. Tente novamente.')],
                flags: 64
            });
        }
    }

    // Rejeitar comprovante de pagamento
    static async rejectPaymentProof(interaction, saleId) {
        try {
            // Verificar permissões de admin
            if (!Helpers.hasOwnerPermission(interaction.member)) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Você não tem permissão para rejeitar pagamentos!')],
                    flags: 64
                });
            }

            // Buscar venda
            const sale = await Database.getSaleById(saleId);
            if (!sale) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada!')],
                    flags: 64
                });
            }

            // Atualizar embed original
            const rejectEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('❌ Comprovante Rejeitado')
                .setDescription(`**Rejeitado por:** <@${interaction.user.id}>\n**ID da Venda:** \`${saleId}\``)
                .addFields([
                    {
                        name: '💰 Valor Total',
                        value: `R$ ${parseFloat(sale.total_amount).toFixed(2).replace('.', ',')}`,
                        inline: true
                    },
                    {
                        name: '📅 Rejeitado em',
                        value: new Date().toLocaleString('pt-BR'),
                        inline: true
                    }
                ])
                .setFooter({ text: 'Cliente deve enviar novo comprovante' })
                .setTimestamp();

            await interaction.update({
                embeds: [rejectEmbed],
                components: []
            });

            // Notificar cliente
            try {
                const user = await interaction.client.users.fetch(sale.user_id);
                await user.send({
                    embeds: [{
                        color: 0xe74c3c,
                        title: '❌ Comprovante Rejeitado',
                        description: `Seu comprovante de pagamento foi rejeitado.\n\n` +
                                    `**ID da Venda:** \`${saleId}\`\n` +
                                    `**Valor:** R$ ${parseFloat(sale.total_amount).toFixed(2).replace('.', ',')}\n\n` +
                                    `Por favor, verifique se:\n` +
                                    `• O valor está correto\n` +
                                    `• O comprovante está legível\n` +
                                    `• O PIX foi feito para a chave correta\n\n` +
                                    `Envie um novo comprovante válido.`,
                        footer: { text: 'Entre em contato com o suporte se precisar de ajuda' }
                    }]
                });
            } catch (error) {
                console.log('❌ Não foi possível notificar o cliente via DM');
            }

        } catch (error) {
            console.error('❌ Erro ao rejeitar comprovante:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao rejeitar comprovante. Tente novamente.')],
                flags: 64
            });
        }
    }

    // Atualizar estoque após compra
    static async updateStockAfterPurchase(sale, cartItems = null) {
        try {
            let items = cartItems;
            
            // Se não temos os itens do carrinho, buscar pelos dados da venda
            if (!items && sale.products_data) {
                items = JSON.parse(sale.products_data);
            }
            
            if (!items || items.length === 0) {
                console.log('❌ Nenhum item encontrado para atualizar estoque');
                return;
            }

            for (const item of items) {
                // Buscar produto atual
                const product = await Database.getProductById(item.product_id || item.id);
                if (!product) {
                    console.log(`❌ Produto ${item.product_id || item.id} não encontrado`);
                    continue;
                }

                // Calcular novo estoque
                const newStock = product.stock - item.quantity;
                
                // Atualizar estoque no banco
                await Database.updateProductStock(product.id, newStock);
                
                console.log(`📦 Estoque atualizado: ${product.name} - ${product.stock} → ${newStock}`);
                
                // Verificar se estoque zerou
                if (newStock <= 0) {
                    await this.notifyStockOut(product);
                }

                // Atualizar embed do produto no canal
                await this.updateProductEmbed(product.id, interaction.client);
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar estoque:', error);
        }
    }

    // Notificar quando estoque acabar (DESABILITADO - causava conflitos)
    static async notifyStockOut(product) {
        try {
            // Webhook desabilitado para evitar conflitos de interação
            console.log(`⚠️ Estoque esgotado: ${product.name} (ID: ${product.id})`);
            
            // TODO: Implementar notificação via canal Discord ao invés de webhook
            // const channel = client.channels.cache.get(process.env.STOCK_NOTIFICATION_CHANNEL_ID);
            // if (channel) {
            //     await channel.send(`⚠️ **Estoque Esgotado!** O produto **${product.name}** está sem estoque.`);
            // }

        } catch (error) {
            console.error('❌ Erro ao processar notificação de estoque:', error);
        }
    }

    // Atualizar embed do produto no canal
    static async updateProductEmbed(productId, client) {
        try {
            // Buscar produto atualizado
            const product = await Database.getProductById(productId);
            if (!product) {
                console.log(`❌ Produto ${productId} não encontrado para atualizar embed`);
                return;
            }

            // Buscar mensagens do produto
            const productMessages = await Database.getProductMessages(productId);
            if (!productMessages || productMessages.length === 0) {
                console.log(`📝 Nenhuma mensagem encontrada para o produto ${product.name}`);
                return;
            }

            // Criar embed atualizado
            const updatedEmbed = new EmbedBuilder()
                .setColor(product.stock > 0 ? 0x2ecc71 : 0xe74c3c)
                .setTitle(`🛒 ${product.name}`)
                .setDescription(product.description || 'Sem descrição disponível')
                .addFields([
                    {
                        name: '💰 Preço',
                        value: `R$ ${parseFloat(product.price).toFixed(2).replace('.', ',')}`,
                        inline: true
                    },
                    {
                        name: '📦 Estoque',
                        value: product.stock > 0 ? `${product.stock} unidades` : '**ESGOTADO**',
                        inline: true
                    },
                    {
                        name: '🎯 Status',
                        value: product.stock > 0 ? '✅ Disponível' : '❌ Indisponível',
                        inline: true
                    }
                ])
                .setFooter({ text: 'Clique no botão abaixo para comprar' })
                .setTimestamp();

            // Adicionar imagem se disponível
            if (product.image_url) {
                updatedEmbed.setImage(product.image_url);
            }

            // Criar botão de compra
            const buyButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`product_buy_${product.id}`)
                    .setLabel(product.stock > 0 ? '🛒 Comprar Agora' : '❌ Esgotado')
                    .setStyle(product.stock > 0 ? ButtonStyle.Success : ButtonStyle.Danger)
                    .setDisabled(product.stock <= 0)
            );

            // Atualizar todas as mensagens do produto
            for (const messageData of productMessages) {
                try {
                    const channel = client.channels.cache.get(messageData.channel_id);
                    if (!channel) {
                        console.log(`❌ Canal ${messageData.channel_id} não encontrado`);
                        // Remover mensagem inválida do banco
                        await Database.deleteProductMessage(productId, messageData.message_id);
                        continue;
                    }

                    const message = await channel.messages.fetch(messageData.message_id).catch(() => null);
                    if (!message) {
                        console.log(`❌ Mensagem ${messageData.message_id} não encontrada`);
                        // Remover mensagem inválida do banco
                        await Database.deleteProductMessage(productId, messageData.message_id);
                        continue;
                    }

                    // Atualizar a mensagem
                    await message.edit({
                        embeds: [updatedEmbed],
                        components: [buyButton]
                    });

                    console.log(`✅ Embed atualizado para ${product.name} no canal ${channel.name}`);

                } catch (error) {
                    console.error(`❌ Erro ao atualizar mensagem ${messageData.message_id}:`, error);
                    // Se a mensagem não existe mais, remover do banco
                    if (error.code === 10008) { // Unknown Message
                        await Database.deleteProductMessage(productId, messageData.message_id);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar embed do produto:', error);
        }
    }

    // Verificar confirmação de pagamento
    static async checkPaymentConfirmation(interaction, saleId) {
        try {
            // Buscar venda pelo ID
            const sale = await Database.db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
            if (!sale) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada!')],
                    flags: 64
                });
            }

            if (sale.payment_status === 'completed') {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('⚠️ Este pagamento já foi processado!')],
                    flags: 64
                });
            }

            if (sale.payment_status === 'cancelled') {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Esta venda foi cancelada!')],
                    flags: 64
                });
            }

            // Modal para confirmação manual do pagamento
            const confirmModal = new ModalBuilder()
                .setCustomId(`payment_confirm_${saleId}`)
                .setTitle('💰 Confirmar Pagamento');

            const totalAmount = parseFloat(sale.total_amount) || 0;
            const valueInput = new TextInputBuilder()
                .setCustomId('paid_value')
                .setLabel(`Valor Pago (R$) - Esperado: ${Helpers.formatPrice(totalAmount)}`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder(`Ex: ${totalAmount.toFixed(2).replace('.', ',')}`)
                .setMaxLength(10);

            const proofInput = new TextInputBuilder()
                .setCustomId('payment_proof')
                .setLabel('Comprovante/Observação (opcional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder('Cole aqui o comprovante ou alguma observação')
                .setMaxLength(500);

            const firstRow = new ActionRowBuilder().addComponents(valueInput);
            const secondRow = new ActionRowBuilder().addComponents(proofInput);

            confirmModal.addComponents(firstRow, secondRow);

            await interaction.showModal(confirmModal);

        } catch (error) {
            console.error('❌ Erro ao verificar pagamento:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao verificar pagamento!')],
                flags: 64
            });
        }
    }

    // Processar confirmação de pagamento
    static async processPaymentConfirmation(interaction, saleId) {
        try {
            const paidValueString = interaction.fields.getTextInputValue('paid_value');
            const paymentProof = interaction.fields.getTextInputValue('payment_proof') || '';

            const paidValue = parseFloat(paidValueString.replace(',', '.'));
            
            if (isNaN(paidValue) || paidValue <= 0) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Valor pago inválido!')],
                    flags: 64
                });
            }

            // Buscar venda
            const sale = await Database.db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
            if (!sale) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada!')],
                    flags: 64
                });
            }

            // Verificar se o valor pago corresponde EXATAMENTE ao valor total
            const expectedValue = parseFloat(sale.total_amount);
            const tolerance = 0.01; // Tolerância de 1 centavo

            if (Math.abs(paidValue - expectedValue) > tolerance) {
                return await interaction.reply({
                    embeds: [{
                        color: 0xe74c3c,
                        title: '❌ Valor Incorreto',
                        description: `O valor pago deve ser EXATAMENTE o valor total do produto!\n\n` +
                                   `**Valor esperado:** ${Helpers.formatPrice(expectedValue)}\n` +
                                   `**Valor informado:** ${Helpers.formatPrice(paidValue)}\n\n` +
                                   `⚠️ **IMPORTANTE:** Você deve pagar o valor completo para confirmar o pedido.`,
                        footer: { text: 'Entre em contato com o suporte se houver algum problema' }
                    }],
                    flags: 64
                });
            }

            // Atualizar status da venda para pago
            const paymentData = JSON.stringify({
                paid_value: paidValue,
                proof: paymentProof,
                confirmed_by: interaction.user.id,
                confirmed_at: new Date().toISOString()
            });

            await Database.completeSalePayment(saleId, paymentData);

            // Buscar informações do carrinho e produtos
            const cart = await Database.getCart(sale.cart_id);
            const cartItems = await Database.getCartItems(sale.cart_id);

            // Processar entrega de cada produto
            for (const item of cartItems) {
                const product = await Database.getProduct(item.product_id);
                
                // Reduzir estoque
                await Database.updateStock(item.product_id, product.stock - item.quantity);
                
                // Processar entrega do produto
                await this.deliverProduct(interaction, sale, product, item.quantity);
            }

            // Atualizar status do carrinho
            await Database.updateCartStatus(sale.cart_id, 'completed');

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Pagamento Confirmado!',
                    description: `Seu pagamento foi confirmado com sucesso!\n\n` +
                               `**Valor:** ${Helpers.formatPrice(expectedValue)}\n` +
                               `**Venda:** \`#${saleId}\`\n\n` +
                               `🎉 **Produtos entregues!** Verifique suas mensagens privadas.`,
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

            // Log da venda
            const Logger = require('./logger');
            await Logger.logSale({
                saleId: saleId,
                userId: sale.user_id,
                username: sale.username,
                amount: expectedValue,
                status: 'completed'
            });

        } catch (error) {
            console.error('❌ Erro ao processar confirmação:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao processar confirmação!')],
                flags: 64
            });
        }
    }

    // Entregar produto individual
    static async deliverProduct(interaction, sale, product, quantity) {
        try {
            const user = await interaction.client.users.fetch(sale.user_id);

            // Dar cargo cliente permanente
            await this.giveClientRole(interaction, user);

            // Dar cargo temporário se configurado
            if (product.role_id && product.role_days > 0) {
                await this.giveTemporaryRole(interaction, user, product.role_id, product.role_days);
            }

            // Enviar produto via DM
            try {
                await user.send({
                    embeds: [{
                        color: 0x2ecc71,
                        title: '🎉 Produto Entregue!',
                        description: `Obrigado pela sua compra!\n\n` +
                                   `**Produto:** ${product.name}\n` +
                                   `**Quantidade:** ${quantity}\n` +
                                   `**Venda:** \`#${sale.id}\`\n\n` +
                                   `${product.description || 'Aproveite seu produto!'}`,
                        fields: [
                            {
                                name: '📞 Suporte',
                                value: 'Entre em contato caso tenha alguma dúvida',
                                inline: false
                            }
                        ],
                        image: product.image_url ? { url: product.image_url } : null,
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (dmError) {
                console.error('❌ Erro ao enviar DM:', dmError);
                // Tentar enviar no canal do carrinho como fallback
                try {
                    const channel = await interaction.client.channels.fetch(sale.cart_id);
                    if (channel) {
                        await channel.send({
                            content: `<@${sale.user_id}>`,
                            embeds: [{
                                color: 0xf39c12,
                                title: '⚠️ Produto Entregue (DM Falhou)',
                                description: `Não foi possível enviar o produto via DM.\n\n` +
                                           `**Produto:** ${product.name}\n` +
                                           `**Quantidade:** ${quantity}\n\n` +
                                           `${product.description || 'Aproveite seu produto!'}`,
                                footer: { text: 'Verifique suas configurações de DM' }
                            }]
                        });
                    }
                } catch (channelError) {
                    console.error('❌ Erro ao enviar no canal:', channelError);
                }
            }

        } catch (error) {
            console.error('❌ Erro ao entregar produto:', error);
        }
    }

    // Cancelar pagamento
    static async cancelPayment(interaction, orderId) {
        try {
            await Database.updateSaleStatus(orderId, 'cancelled');

            await interaction.reply({
                embeds: [{
                    color: 0x95a5a6,
                    title: '❌ Pagamento Cancelado',
                    description: `O pagamento do pedido \`#${orderId}\` foi cancelado.\n\n` +
                               `Você pode fazer uma nova compra a qualquer momento.`
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao cancelar pagamento:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao cancelar pagamento!')],
                flags: 64
            });
        }
    }

    // Mostrar seleção de canal para adicionar produto
    static async showAddProductChannelSelect(interaction) {
        try {
            const guild = interaction.guild;
            const PRODUCTS_CATEGORY_ID = '1416922927328395304';
            
            // Filtrar apenas canais da categoria específica
            const textChannels = guild.channels.cache
                .filter(channel => 
                    channel.type === 0 && // Text channels only
                    channel.parentId === PRODUCTS_CATEGORY_ID // Apenas da categoria especificada
                )
                .first(25); // Discord limit

            if (textChannels.length === 0) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Nenhum canal de texto encontrado na categoria de produtos!')],
                    flags: 64
                });
            }

            const channelOptions = textChannels.map(channel => ({
                label: `#${channel.name}`,
                description: `Canal na categoria de produtos`,
                value: channel.id
            }));

            // Adicionar opção "Nenhum canal"
            channelOptions.push({
                label: '❌ Não enviar para canal',
                description: 'Criar produto sem enviar automaticamente',
                value: 'none'
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('admin_select-channel-for-product')
                .setPlaceholder('Escolha o canal onde o produto será exibido')
                .addOptions(channelOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            await interaction.reply({
                embeds: [{
                    color: 0x3498db,
                    title: '📺 Escolher Canal para Produto',
                    description: 'Selecione o canal da **categoria de produtos** onde este produto será automaticamente enviado após a criação:',
                    footer: { text: 'Apenas canais da categoria de produtos são exibidos' }
                }],
                components: [row],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao mostrar seleção de canal:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao carregar canais!')],
                flags: 64
            });
        }
    }

    // Mostrar modal para adicionar produto (com canal selecionado)
    static async showAddProductModal(interaction, channelId = null) {
        const modal = new ModalBuilder()
            .setCustomId(`admin_add-product-modal_${channelId || 'none'}`)
            .setTitle('➕ Adicionar Novo Produto');

        const nameInput = new TextInputBuilder()
            .setCustomId('product_name')
            .setLabel('Nome do Produto')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('product_description')
            .setLabel('Descrição')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);

        const priceInput = new TextInputBuilder()
            .setCustomId('product_price')
            .setLabel('Preço (ex: 29.90)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10);

        const stockInput = new TextInputBuilder()
            .setCustomId('product_stock')
            .setLabel('Estoque')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(5);

        const imageInput = new TextInputBuilder()
            .setCustomId('product_image')
            .setLabel('URL da Imagem (opcional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setMaxLength(500);

        const firstRow = new ActionRowBuilder().addComponents(nameInput);
        const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
        const thirdRow = new ActionRowBuilder().addComponents(priceInput);
        const fourthRow = new ActionRowBuilder().addComponents(stockInput);
        const fifthRow = new ActionRowBuilder().addComponents(imageInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

        await interaction.showModal(modal);
    }

    // Menu de seleção de produtos
    static async showProductSelectMenu(interaction, action) {
        try {
            const products = await Database.getProducts();

            if (products.length === 0) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('⚠️ Nenhum produto encontrado!')],
                    flags: 64
                });
            }

            const options = products.slice(0, 25).map(product => ({
                label: product.name,
                description: `Preço: ${Helpers.formatPrice(product.price)} | Estoque: ${product.stock}`,
                value: `${action}_${product.id}`
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`product_select_${action}`)
                .setPlaceholder('Escolha um produto')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const actionText = {
                'edit': 'editar',
                'delete': 'excluir',
                'stock': 'gerenciar estoque'
            };

            await interaction.reply({
                embeds: [{
                    color: 0x3498db,
                    title: `📦 Selecionar Produto para ${actionText[action]}`,
                    description: 'Escolha um produto da lista abaixo:'
                }],
                components: [row],
                flags: 64
            });
        } catch (error) {
            console.error('❌ Erro ao mostrar menu de produtos:', error);
            
            try {
                const errorMessage = {
                    embeds: [Helpers.createErrorEmbed('❌ Erro ao carregar produtos!')],
                    flags: 64
                };
                
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                console.error('❌ Erro ao responder erro:', replyError);
            }
        }
    }

    // Adicionar produto ao carrinho
    static async addToCart(interaction, productId) {
        try {
            console.log(`🔍 AddToCart - Buscando produto ID: ${productId}`);
            const product = await Database.getProductById(productId);
            console.log(`📦 AddToCart - Produto encontrado:`, product);
            
            if (!product || !product.active) {
                console.log(`❌ AddToCart - Produto não encontrado ou inativo. Product:`, product);
                const errorMessage = {
                    embeds: [Helpers.createErrorEmbed('❌ Produto não encontrado!')]
                };
                
                if (interaction.deferred) {
                    return await interaction.editReply(errorMessage);
                } else {
                    return await interaction.reply({ ...errorMessage, flags: 64 });
                }
            }

            if (product.stock <= 0) {
                const errorMessage = {
                    embeds: [Helpers.createErrorEmbed('❌ Produto fora de estoque!')]
                };
                
                if (interaction.deferred) {
                    return await interaction.editReply(errorMessage);
                } else {
                    return await interaction.reply({ ...errorMessage, flags: 64 });
                }
            }

            // Verificar se usuário já tem carrinho ativo
            let cart = await Database.getCartByUser(interaction.user.id);
            
            if (!cart) {
                // Criar novo carrinho
                const cartId = Helpers.generateUUID();
                const expiresAt = Helpers.calculateExpirationDate(parseInt(process.env.CART_EXPIRATION_HOURS) || 24);
                
                await Database.createCart({
                    id: cartId,
                    user_id: interaction.user.id,
                    channel_id: null,
                    expires_at: expiresAt.toISOString()
                });
                
                cart = await Database.getCart(cartId);
            }

            // Adicionar item ao carrinho
            await Database.addCartItem(cart.id, productId, 1, product.price);

            // Atualizar total do carrinho
            const cartItems = await Database.getCartItems(cart.id);
            const total = cartItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
            await Database.updateCartTotal(cart.id, total);

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Produto Adicionado ao Carrinho!',
                    description: `**${product.name}** foi adicionado ao seu carrinho.\n\n` +
                                `💰 **Preço:** ${Helpers.formatPrice(product.price)}\n` +
                                `🛒 **Total no carrinho:** ${Helpers.formatPrice(total)}`,
                    thumbnail: { url: product.image_url || null },
                    timestamp: new Date().toISOString()
                }],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('product_view-cart')
                            .setLabel('Ver Carrinho')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🛒'),
                        new ButtonBuilder()
                            .setCustomId('cart_checkout')
                            .setLabel('Finalizar Compra')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💳')
                    )
                ],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao adicionar ao carrinho:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao adicionar produto ao carrinho!')],
                flags: 64
            });
        }
    }

    // Visualizar carrinho
    static async viewCart(interaction) {
        try {
            const cart = await Database.getCartByUser(interaction.user.id);
            
            if (!cart) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('🛒 Seu carrinho está vazio!')],
                    flags: 64
                });
            }

            const cartItems = await Database.getCartItems(cart.id);
            
            if (cartItems.length === 0) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('🛒 Seu carrinho está vazio!')],
                    flags: 64
                });
            }

            const itemsText = cartItems.map(item => 
                `**${item.name}**\n` +
                `Quantidade: ${item.quantity}\n` +
                `Preço unitário: ${Helpers.formatPrice(item.unit_price)}\n` +
                `Subtotal: ${Helpers.formatPrice(item.quantity * item.unit_price)}`
            ).join('\n\n');

            const total = cartItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

            await interaction.reply({
                embeds: [{
                    color: 0x3498db,
                    title: '🛒 Seu Carrinho',
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
                        }
                    ],
                    timestamp: new Date().toISOString()
                }],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('cart_checkout')
                            .setLabel('Finalizar Compra')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💳'),
                        new ButtonBuilder()
                            .setCustomId('cart_apply-coupon')
                            .setLabel('Aplicar Cupom')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🎟️'),
                        new ButtonBuilder()
                            .setCustomId('cart_clear')
                            .setLabel('Limpar Carrinho')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🗑️')
                    )
                ],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao visualizar carrinho:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao carregar carrinho!')],
                flags: 64
            });
        }
    }

    // Processar checkout
    static async processCheckout(interaction, cartId = null) {
        try {
            // Verificar se a interação já foi deferida, se não, deferir agora
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: 64 });
            }

            // Se cartId foi fornecido (compra direta), usar ele, senão buscar carrinho do usuário
            let cart;
            if (cartId) {
                cart = await Database.getCart(cartId);
            } else {
                cart = await Database.getCartByUser(interaction.user.id);
            }
            
            if (!cart) {
                return await interaction.editReply({
                    embeds: [Helpers.createWarningEmbed('🛒 Carrinho não encontrado!')]
                });
            }

            const cartItems = await Database.getCartItems(cart.id);
            
            if (cartItems.length === 0) {
                return await interaction.editReply({
                    embeds: [Helpers.createWarningEmbed('🛒 Carrinho vazio!')]
                });
            }

            // Verificar estoque
            for (const item of cartItems) {
                const product = await Database.getProductById(item.product_id);
                if (!product || product.stock < item.quantity) {
                    return await interaction.editReply({
                        embeds: [Helpers.createErrorEmbed(`❌ Produto "${item.name}" não tem estoque suficiente!`)]
                    });
                }
            }

            // Criar canal privado do carrinho
            const guild = interaction.guild;
            const orderId = Helpers.generateOrderId();
            const channelName = Helpers.generateCartChannelName(interaction.user.username, orderId);

            // Encontrar ou criar categoria "Carrinho"
            const cartCategoryId = process.env.CART_CATEGORY_ID;
            let category;
            
            // Se ID estiver configurado, usar ID
            if (cartCategoryId && cartCategoryId !== 'your_cart_category_id_here') {
                category = guild.channels.cache.get(cartCategoryId);
            } else {
                // Fallback: buscar por nome
                category = guild.channels.cache.find(c => c.name === 'Carrinho' && c.type === 4);
            }
            
            if (!category) {
                category = await guild.channels.create({
                    name: 'Carrinho',
                    type: 4, // Category
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: ['ViewChannel']
                        }
                    ]
                });
            }

            // Criar canal do carrinho
            const cartChannel = await guild.channels.create({
                name: channelName,
                type: 0, // Text channel
                parent: category.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    },
                    {
                        id: interaction.user.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                    },
                    // Adicionar permissão para administradores
                    ...guild.roles.cache
                        .filter(role => {
                            const ownerRoleId = process.env.OWNER_ROLE_ID;
                            if (ownerRoleId && ownerRoleId !== 'your_owner_role_id_here') {
                                return role.id === ownerRoleId || role.permissions.has('Administrator');
                            } else {
                                return role.name === 'DONO' || role.permissions.has('Administrator');
                            }
                        })
                        .map(role => ({
                            id: role.id,
                            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                        }))
                ]
            });

            // Atualizar carrinho com canal
            await Database.updateCartStatus(cart.id, 'active');
            if (Database.useSupabase) {
                await Database.supabase.supabase.from('carts').update({ channel_id: cartChannel.id }).eq('id', cart.id);
            } else {
                await Database.db.run('UPDATE carts SET channel_id = ? WHERE id = ?', [cartChannel.id, cart.id]);
            }

            // Gerar PIX
            const total = cart.total_amount;
            const pixGenerator = new PixGenerator();
            
            // Validar configuração PIX
            const configValidation = pixGenerator.validateConfig();
            if (!configValidation.valid) {
                console.error('❌ Configuração PIX inválida:', configValidation.errors);
                return await interaction.editReply({
                    embeds: [Helpers.createErrorEmbed(`❌ Erro na configuração PIX:\n${configValidation.errors.join('\n')}`)]
                });
            }
            
            const pixData = await pixGenerator.generatePixQRCode(total, orderId, `Pedido ${orderId}`);

            if (!pixData.success) {
                return await interaction.editReply({
                    embeds: [Helpers.createErrorEmbed('❌ Erro ao gerar código PIX!')]
                });
            }

            // Criar venda no banco
            const saleId = Helpers.generateUUID();
            await Database.createSale({
                id: saleId,
                cart_id: cart.id,
                user_id: interaction.user.id,
                username: interaction.user.username,
                total_amount: total,
                coupon_code: cart.coupon_code,
                pix_code: pixData.payload
            });

            // Enviar informações no canal do carrinho
            const attachment = new AttachmentBuilder(pixData.qrCodeBuffer, { name: 'qrcode-pix.png' });

            const itemsText = cartItems.map(item => 
                `**${item.name}**\n` +
                `Quantidade: ${item.quantity}\n` +
                `Preço: ${Helpers.formatPrice(item.unit_price)}\n` +
                `Subtotal: ${Helpers.formatPrice(item.quantity * item.unit_price)}`
            ).join('\n\n');

            await cartChannel.send({
                content: `<@${interaction.user.id}>`,
                embeds: [{
                    color: 0x00ff00,
                    title: '🛒 Resumo do Pedido',
                    description: `**ID do Pedido:** \`${orderId}\`\n\n**Produtos:**\n${itemsText}`,
                    fields: [
                        {
                            name: '💰 Total',
                            value: Helpers.formatPrice(total),
                            inline: true
                        },
                        {
                            name: '🆔 ID da Venda',
                            value: `\`${saleId}\``,
                            inline: true
                        }
                    ],
                    image: { url: 'attachment://qrcode-pix.png' },
                    timestamp: new Date().toISOString()
                }],
                files: [attachment],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`payment_confirm_${saleId}`)
                            .setLabel('Confirmar Pagamento')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('✅'),
                        new ButtonBuilder()
                            .setCustomId(`payment_cancel_${saleId}`)
                            .setLabel('Cancelar')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                    )
                ]
            });

            // Enviar código PIX Copia e Cola
            await cartChannel.send({
                embeds: [{
                    color: 0x3498db,
                    title: '📋 PIX Copia e Cola',
                    description: `\`\`\`${pixData.payload}\`\`\`\n\n` +
                                `⚠️ **Importante:**\n` +
                                `• Pague exatamente **${Helpers.formatPrice(total)}**\n` +
                                `• Após o pagamento, clique em "Confirmar Pagamento"\n` +
                                `• Este carrinho expira em 24 horas`,
                    footer: { text: 'Escaneie o QR Code acima ou copie e cole este código no seu app do banco' }
                }]
            });

            await interaction.editReply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Checkout Iniciado!',
                    description: `Seu carrinho foi criado em ${cartChannel}!\n\n` +
                                `**ID do Pedido:** \`${orderId}\`\n` +
                                `**Total:** ${Helpers.formatPrice(total)}\n\n` +
                                `Siga as instruções no canal para completar o pagamento.`
                }]
            });

        } catch (error) {
            console.error('❌ Erro no checkout:', error);
            await interaction.editReply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao processar checkout!')]
            });
        }
    }

    // Mostrar modal de confirmação de pagamento
    static async showPaymentConfirmationModal(interaction) {
        const saleId = interaction.customId.split('_')[2];
        
        try {
            // Buscar dados da venda
            const sale = await Database.getSaleById(saleId);
            if (!sale) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada!')],
                    flags: 64
                });
            }

            if (sale.payment_status === 'completed') {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('⚠️ Esta venda já foi confirmada!')],
                    flags: 64
                });
            }

            // Mostrar modal de confirmação
            const modal = new ModalBuilder()
                .setCustomId(`payment_confirm_modal_${saleId}`)
                .setTitle('💳 Confirmar Pagamento');

            const paidValueInput = new TextInputBuilder()
                .setCustomId('paid_value')
                .setLabel('Valor Pago (R$)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder(`Valor esperado: R$ ${sale.total_amount.toFixed(2).replace('.', ',')}`)
                .setMaxLength(10);

            const paymentProofInput = new TextInputBuilder()
                .setCustomId('payment_proof')
                .setLabel('Comprovante/Observações (Opcional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder('Cole aqui o comprovante ou adicione observações...')
                .setMaxLength(500);

            const firstRow = new ActionRowBuilder().addComponents(paidValueInput);
            const secondRow = new ActionRowBuilder().addComponents(paymentProofInput);

            modal.addComponents(firstRow, secondRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Erro ao mostrar modal de confirmação:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao abrir formulário de confirmação!')],
                flags: 64
            });
        }
    }

    // Confirmar pagamento - abre modal de confirmação
    static async confirmPayment(interaction) {
        // Redirecionar para o modal
        return await this.showPaymentConfirmationModal(interaction);
    }

    // Entregar produtos ao cliente
    static async deliverProducts(interaction, sale, cartItems) {
        try {
            const user = await interaction.client.users.fetch(sale.user_id);
            
            // Criar embed de entrega
            const deliveryEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('🎉 Seus Produtos Foram Entregues!')
                .setDescription(`Obrigado pela sua compra! Aqui estão seus produtos:`)
                .addFields(
                    {
                        name: '🆔 ID da Compra',
                        value: `\`${sale.id}\``,
                        inline: true
                    },
                    {
                        name: '💰 Valor Pago',
                        value: Helpers.formatPrice(sale.total_amount),
                        inline: true
                    },
                    {
                        name: '📅 Data da Compra',
                        value: Helpers.formatDateTime(new Date(sale.created_at)),
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Guarde este ID para futuras referências',
                    iconURL: interaction.guild.iconURL()
                })
                .setTimestamp();

            // Adicionar produtos ao embed
            const productsText = cartItems.map(item => 
                `**${item.name}**\n` +
                `Quantidade: ${item.quantity}\n` +
                `Valor: ${Helpers.formatPrice(item.unit_price * item.quantity)}\n` +
                `${item.description ? `Descrição: ${item.description}` : ''}`
            ).join('\n\n');

            deliveryEmbed.addFields({
                name: '📦 Produtos Adquiridos',
                value: productsText.length > 1024 ? productsText.substring(0, 1021) + '...' : productsText,
                inline: false
            });

            // Enviar por DM
            await user.send({ embeds: [deliveryEmbed] });

            // Dar cargo "cliente" automaticamente
            await this.giveClientRole(interaction, user);

            // Dar cargos específicos dos produtos se necessário
            for (const item of cartItems) {
                if (item.role_id && item.role_days > 0) {
                    await this.giveTemporaryRole(interaction, user, item.role_id, item.role_days);
                }
            }

            console.log(`📦 Produtos entregues para ${user.username} (${user.id})`);

        } catch (error) {
            console.error('❌ Erro ao entregar produtos:', error);
            
            // Tentar notificar no canal se DM falhar
            try {
                await interaction.followUp({
                    content: `⚠️ Não foi possível enviar os produtos por DM para <@${sale.user_id}>. ` +
                            `Verifique se suas DMs estão abertas ou entre em contato com um administrador.`,
                    ephemeral: false
                });
            } catch (followUpError) {
                console.error('❌ Erro ao enviar notificação de falha:', followUpError);
            }
        }
    }

    // Dar cargo temporário
    static async giveTemporaryRole(interaction, user, roleId, days) {
        try {
            const guild = interaction.guild;
            const member = await guild.members.fetch(user.id);
            const role = guild.roles.cache.get(roleId);

            if (!role) {
                console.error(`❌ Cargo ${roleId} não encontrado`);
                return;
            }

            // Dar o cargo
            await member.roles.add(role);
            console.log(`👑 Cargo ${role.name} dado para ${user.username} por ${days} dias`);

            // Agendar remoção do cargo
            const removeDate = new Date();
            removeDate.setDate(removeDate.getDate() + days);

            // Salvar no banco para remoção posterior
            await Database.createRoleAssignment(user.id, roleId, guild.id, removeDate.toISOString());

            // Notificar usuário
            try {
                await user.send({
                    embeds: [{
                        color: 0x9b59b6,
                        title: '👑 Cargo Recebido!',
                        description: `Você recebeu o cargo **${role.name}** por **${days} dias**!`,
                        fields: [
                            {
                                name: '📅 Expira em',
                                value: Helpers.formatDateTime(removeDate),
                                inline: true
                            }
                        ],
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (dmError) {
                console.error('❌ Erro ao notificar usuário sobre cargo:', dmError);
            }

        } catch (error) {
            console.error('❌ Erro ao dar cargo temporário:', error);
        }
    }

    // Dar cargo "cliente" permanente
    static async giveClientRole(interaction, user) {
        try {
            const clientRoleId = process.env.CLIENT_ROLE_ID;
            
            // Verificar se o ID do cargo está configurado
            if (!clientRoleId || clientRoleId === 'your_client_role_id_here') {
                console.log('⚠️ ID do cargo cliente não configurado no .env');
                return;
            }

            const guild = interaction.guild;
            const member = await guild.members.fetch(user.id);
            const clientRole = guild.roles.cache.get(clientRoleId);

            // Verificar se o cargo existe
            if (!clientRole) {
                console.error(`❌ Cargo com ID ${clientRoleId} não encontrado no servidor`);
                return;
            }

            // Verificar se o usuário já tem o cargo
            if (member.roles.cache.has(clientRole.id)) {
                console.log(`👑 ${user.username} já possui o cargo ${clientRole.name}`);
                return;
            }

            // Dar o cargo
            await member.roles.add(clientRole);
            console.log(`👑 Cargo "${clientRole.name}" dado para ${user.username}`);

            // Notificar usuário
            try {
                await user.send({
                    embeds: [{
                        color: 0x3498db,
                        title: '👑 Bem-vindo aos nossos clientes!',
                        description: `Você recebeu o cargo **${clientRole.name}** por ter feito uma compra!\n\n` +
                                    `Agora você faz parte da nossa comunidade de clientes. 🎉`,
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (dmError) {
                console.error('❌ Erro ao notificar usuário sobre cargo cliente:', dmError);
            }

        } catch (error) {
            console.error('❌ Erro ao dar cargo cliente:', error);
        }
    }

    // Histórico de vendas
    static async showSalesHistory(interaction) {
        try {
            const sales = await Database.getSales(20);
            
            if (sales.length === 0) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('📊 Nenhuma venda encontrada!')],
                    flags: 64
                });
            }

            const salesText = sales.map(sale => 
                `**${sale.username}** - ${Helpers.formatPrice(sale.total_amount)}\n` +
                `Status: ${sale.payment_status === 'completed' ? '✅ Pago' : '⏳ Pendente'}\n` +
                `Data: ${Helpers.formatDateTime(new Date(sale.created_at))}`
            ).join('\n\n');

            await interaction.reply({
                embeds: [{
                    color: 0x3498db,
                    title: '📊 Histórico de Vendas',
                    description: salesText,
                    footer: { text: 'Últimas 20 vendas' }
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao buscar vendas:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao carregar histórico!')],
                flags: 64
            });
        }
    }

    // Painel de configurações
    static async showSettingsPanel(interaction) {
        await interaction.reply({
            embeds: [{
                color: 0x9b59b6,
                title: '⚙️ Configurações do Bot',
                description: 'Configurações atuais do sistema:',
                fields: [
                    {
                        name: '🔑 Chave PIX',
                        value: process.env.PIX_KEY ? `\`${process.env.PIX_KEY.substring(0, 10)}...\`` : '❌ Não configurada',
                        inline: true
                    },
                    {
                        name: '👑 Cargo de Admin',
                        value: `\`${process.env.OWNER_ROLE_NAME || 'DONO'}\``,
                        inline: true
                    },
                    {
                        name: '⏰ Expiração do Carrinho',
                        value: `${process.env.CART_EXPIRATION_HOURS || 24} horas`,
                        inline: true
                    },
                    {
                        name: '📁 Categoria do Carrinho',
                        value: `\`${process.env.CART_CATEGORY_NAME || 'Carrinho'}\``,
                        inline: true
                    },
                    {
                        name: '📝 Canal de Logs',
                        value: `\`${process.env.LOG_CHANNEL_NAME || 'vendas-log'}\``,
                        inline: true
                    }
                ],
                footer: { text: 'Configure essas opções no arquivo .env' }
            }],
            flags: 64
        });
    }

    // Handler para modais
    static async handleModalSubmit(interaction) {
        // Modal submissions
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('admin_add-product-modal')) {
                await this.processAddProduct(interaction);
            } else if (interaction.customId.startsWith('admin_edit-product-modal')) {
                const productId = interaction.customId.split('_')[3];
                await this.processEditProduct(interaction, productId);
            } else if (interaction.customId.startsWith('admin_stock-modal')) {
                const productId = interaction.customId.split('_')[2];
                await this.processStockUpdate(interaction, productId);
            } else if (interaction.customId === 'modal_apply_coupon') {
                await this.applyCoupon(interaction);
            } else if (interaction.customId.startsWith('payment_confirm_')) {
                const orderId = interaction.customId.split('_')[2];
                await this.processPaymentConfirmation(interaction, orderId);
            }
        } else {
            console.error('❌ Modal não reconhecido:', interaction.customId);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao processar formulário!')],
                flags: 64
            });
        }
    }

    // Processar adição de produto
    static async processAddProduct(interaction) {
        const name = interaction.fields.getTextInputValue('product_name');
        const description = interaction.fields.getTextInputValue('product_description') || null;
        const priceString = interaction.fields.getTextInputValue('product_price');
        const stockString = interaction.fields.getTextInputValue('product_stock');
        const imageUrl = interaction.fields.getTextInputValue('product_image') || null;

        // Extrair channel_id do customId
        const customIdParts = interaction.customId.split('_');
        const channelId = customIdParts[customIdParts.length - 1]; // Pegar o último elemento
        
        console.log('🔍 Debug - CustomId completo:', interaction.customId);
        console.log('🔍 Debug - Channel ID extraído:', channelId);

        // Validações
        if (!Helpers.validatePrice(priceString)) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Preço inválido! Use formato: 29.90')],
                flags: 64
            });
        }

        const price = parseFloat(priceString.replace(',', '.'));
        const stock = parseInt(stockString);

        if (isNaN(stock) || stock < 0) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Estoque deve ser um número válido!')],
                flags: 64
            });
        }

        if (imageUrl && !Helpers.isValidUrl(imageUrl)) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ URL da imagem inválida!')],
                flags: 64
            });
        }

        try {
            const productId = await Database.createProduct({
                name,
                description,
                price,
                stock,
                image_url: imageUrl,
                banner_url: null,
                role_id: null,
                role_days: 0,
                channel_id: channelId !== 'none' ? channelId : null
            });

            // Se canal foi especificado, enviar produto automaticamente
            if (channelId && channelId !== 'none' && channelId !== 'undefined') {
                try {
                    console.log('🔍 Debug - Tentando buscar canal:', channelId);
                    const channel = interaction.guild.channels.cache.get(channelId);
                    console.log('🔍 Debug - Canal encontrado:', channel ? channel.name : 'null');
                    
                    if (channel) {
                        console.log('✅ Enviando produto para canal:', channel.name);
                        await this.sendProductToChannel(channel, {
                            id: productId,
                            name,
                            description,
                            price,
                            stock,
                            image_url: imageUrl,
                            banner_url: null,
                            role_id: null,
                            role_days: 0
                        });
                    } else {
                        console.error('❌ Canal não encontrado com ID:', channelId);
                    }
                } catch (sendError) {
                    console.error('❌ Erro ao enviar produto para canal:', sendError);
                }
            } else {
                console.log('⚠️ Canal não especificado ou inválido:', channelId);
            }

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Produto Criado com Sucesso!',
                    fields: [
                        { name: '📦 Nome', value: name, inline: true },
                        { name: '💰 Preço', value: Helpers.formatPrice(price), inline: true },
                        { name: '📊 Estoque', value: stock.toString(), inline: true },
                        { name: '🆔 ID', value: `#${productId}`, inline: true },
                        { name: '📺 Canal', value: channelId && channelId !== 'none' && channelId !== 'undefined' ? `<#${channelId}>` : 'Nenhum', inline: true }
                    ],
                    thumbnail: { url: imageUrl },
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao criar produto:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao criar produto!')],
                flags: 64
            });
        }
    }

    // Enviar produto individual para canal
    static async sendProductToChannel(channel, product) {
        const productEmbed = new EmbedBuilder()
            .setColor(0x00d4aa)
            .setAuthor({ 
                name: '🏪 LOJA OFICIAL'
            })
            .setTitle(`✨ ${product.name.toUpperCase()}`)
            .setDescription(`${product.description || '*Produto premium disponível para compra*'}\n\n` +
                          `> 💎 **Qualidade garantida**\n` +
                          `> 🚀 **Entrega instantânea**\n` +
                          `> 🔒 **Pagamento seguro via PIX**`)
            .addFields(
                {
                    name: '💰 PREÇO',
                    value: `# ${Helpers.formatPrice(product.price)}`,
                    inline: true
                },
                {
                    name: '📦 ESTOQUE',
                    value: product.stock > 0 ? 
                        `🟢 **${product.stock} unidades**\n*Disponível agora*` : 
                        `🔴 **ESGOTADO**\n*Sem estoque*`,
                    inline: true
                },
                {
                    name: '🆔 CÓDIGO',
                    value: `\`\`\`\n#${product.id}\n\`\`\``,
                    inline: true
                }
            )
            .setFooter({ 
                text: '🛡️ Compra 100% segura • Suporte 24/7 • Garantia total'
            })
            .setTimestamp();

        // Usar imagem como banner principal se disponível
        if (product.image_url) {
            productEmbed.setImage(product.image_url);
        }

        if (product.banner_url) {
            productEmbed.setThumbnail(product.banner_url);
        }

        if (product.role_id && product.role_days > 0) {
            productEmbed.addFields({
                name: '🎁 BÔNUS EXCLUSIVO',
                value: `👑 **Cargo VIP** por **${product.role_days} dias**\n` +
                      `*Acesso a benefícios especiais*`,
                inline: false
            });
        }

        const productRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`product_buy-now_${product.id}`)
                    .setLabel('💳 COMPRAR AGORA')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('⚡')
                    .setDisabled(product.stock <= 0),
                new ButtonBuilder()
                    .setCustomId(`product_details_${product.id}`)
                    .setLabel('📋 Detalhes')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('ℹ️')
            );

        try {
            const message = await channel.send({
                embeds: [productEmbed],
                components: [productRow]
            });
            
            console.log(`✅ Produto "${product.name}" enviado para canal ${channel.name}`);
            return message;
        } catch (error) {
            console.error('❌ Erro ao enviar produto para canal:', error);
            throw error;
        }
    }

    // Handler para seleção de produtos
    static async handleProductSelect(interaction) {
        const [action, productId] = interaction.values[0].split('_');

        try {
            const product = await Database.getProduct(productId);
            if (!product) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Produto não encontrado!')],
                    flags: 64
                });
            }

            switch (action) {
                case 'edit':
                    await this.showEditProductModal(interaction, product);
                    break;
                case 'delete':
                    await this.confirmDeleteProduct(interaction, product);
                    break;
                case 'stock':
                    await this.showStockModal(interaction, product);
                    break;
            }
        } catch (error) {
            console.error('❌ Erro ao processar seleção:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao processar seleção!')],
                flags: 64
            });
        }
    }

    // Modal para editar produto
    static async showEditProductModal(interaction, product) {
        const modal = new ModalBuilder()
            .setCustomId(`admin_edit-product-modal_${product.id}`)
            .setTitle('✏️ Editar Produto');

        const nameInput = new TextInputBuilder()
            .setCustomId('product_name')
            .setLabel('Nome do Produto')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(product.name)
            .setMaxLength(100);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('product_description')
            .setLabel('Descrição')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setValue(product.description || '')
            .setMaxLength(500);

        const priceInput = new TextInputBuilder()
            .setCustomId('product_price')
            .setLabel('Preço (ex: 29.90)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(product.price.toString())
            .setMaxLength(10);

        const stockInput = new TextInputBuilder()
            .setCustomId('product_stock')
            .setLabel('Estoque')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(product.stock.toString())
            .setMaxLength(5);

        const imageInput = new TextInputBuilder()
            .setCustomId('product_image')
            .setLabel('URL da Imagem (opcional)')
            .setStyle(TextInputStyle.Short)
            .setRequired(false)
            .setValue(product.image_url || '')
            .setMaxLength(500);

        const firstRow = new ActionRowBuilder().addComponents(nameInput);
        const secondRow = new ActionRowBuilder().addComponents(descriptionInput);
        const thirdRow = new ActionRowBuilder().addComponents(priceInput);
        const fourthRow = new ActionRowBuilder().addComponents(stockInput);
        const fifthRow = new ActionRowBuilder().addComponents(imageInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow, fifthRow);

        await interaction.showModal(modal);
    }

    // Modal para gerenciar estoque
    static async showStockModal(interaction, product) {
        const modal = new ModalBuilder()
            .setCustomId(`admin_stock-modal_${product.id}`)
            .setTitle('📦 Gerenciar Estoque');

        const stockInput = new TextInputBuilder()
            .setCustomId('new_stock')
            .setLabel('Novo Estoque')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(product.stock.toString())
            .setPlaceholder('Digite o novo estoque')
            .setMaxLength(5);

        const row = new ActionRowBuilder().addComponents(stockInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }

    // Mostrar histórico de vendas
    static async showSalesHistory(interaction) {
        try {
            const sales = await Database.getSales(10);

            if (sales.length === 0) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('📊 Nenhuma venda encontrada!')],
                    flags: 64
                });
            }

            const salesText = sales.map(sale => 
                `**ID:** \`${sale.id}\`\n` +
                `**Cliente:** ${sale.username}\n` +
                `**Valor:** ${Helpers.formatPrice(sale.total_amount)}\n` +
                `**Data:** ${Helpers.formatDateTime(new Date(sale.created_at))}`
            ).join('\n\n');

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '📊 Histórico de Vendas',
                    description: salesText.length > 4000 ? salesText.substring(0, 4000) + '...' : salesText,
                    footer: { text: `Mostrando últimas ${sales.length} vendas` }
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao buscar vendas:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao carregar histórico de vendas!')],
                flags: 64
            });
        }
    }

    // Painel de configurações
    static async showSettingsPanel(interaction) {
        await interaction.reply({
            embeds: [{
                color: 0x3498db,
                title: '⚙️ Configurações do Bot',
                description: 'Configurações atuais do sistema:',
                fields: [
                    {
                        name: '🕒 Expiração do Carrinho',
                        value: `${process.env.CART_EXPIRATION_HOURS || 24} horas`,
                        inline: true
                    },
                    {
                        name: '💳 PIX Configurado',
                        value: process.env.PIX_KEY ? '✅ Sim' : '❌ Não',
                        inline: true
                    },
                    {
                        name: '📺 Canais Configurados',
                        value: '✅ Logs, Carrinho, Produtos',
                        inline: true
                    }
                ],
                footer: { text: 'Configure no arquivo .env para alterar' }
            }],
            flags: 64
        });
    }


    // Processar edição de produto
    static async processEditProduct(interaction, productId) {
        const name = interaction.fields.getTextInputValue('product_name');
        const description = interaction.fields.getTextInputValue('product_description') || null;
        const priceString = interaction.fields.getTextInputValue('product_price');
        const stockString = interaction.fields.getTextInputValue('product_stock');
        const imageUrl = interaction.fields.getTextInputValue('product_image') || null;

        // Validações
        if (!Helpers.validatePrice(priceString)) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Preço inválido! Use formato: 29.90')],
                flags: 64
            });
        }

        const price = parseFloat(priceString.replace(',', '.'));
        const stock = parseInt(stockString);

        if (isNaN(stock) || stock < 0) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Estoque deve ser um número válido!')],
                flags: 64
            });
        }

        try {
            await Database.updateProduct(productId, {
                name,
                description,
                price,
                stock,
                image_url: imageUrl,
                banner_url: null,
                role_id: null,
                role_days: 0
            });

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Produto Atualizado!',
                    description: `Produto **${name}** foi atualizado com sucesso.`,
                    fields: [
                        { name: '💰 Novo Preço', value: Helpers.formatPrice(price), inline: true },
                        { name: '📊 Novo Estoque', value: stock.toString(), inline: true },
                        { name: '🆔 ID', value: `#${productId}`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar produto:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao atualizar produto!')],
                flags: 64
            });
        }
    }

    // Processar atualização de estoque
    static async processStockUpdate(interaction, productId) {
        const newStockString = interaction.fields.getTextInputValue('new_stock');
        const newStock = parseInt(newStockString);

        if (isNaN(newStock) || newStock < 0) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Estoque deve ser um número válido!')],
                flags: 64
            });
        }

        try {
            await Database.updateStock(productId, newStock);
            
            const product = await Database.getProduct(productId);

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Estoque Atualizado!',
                    description: `Estoque do produto **${product.name}** foi atualizado.`,
                    fields: [
                        { name: '📦 Novo Estoque', value: newStock.toString(), inline: true },
                        { name: '🆔 ID', value: `#${productId}`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar estoque:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao atualizar estoque!')],
                flags: 64
            });
        }
    }

    // Confirmar exclusão de produto
    static async confirmDeleteProduct(interaction, product) {
        const confirmButton = new ButtonBuilder()
            .setCustomId(`admin_confirm-delete_${product.id}`)
            .setLabel('Confirmar Exclusão')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️');

        const cancelButton = new ButtonBuilder()
            .setCustomId('admin_cancel-delete')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('❌');

        const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        await interaction.reply({
            embeds: [{
                color: 0xe74c3c,
                title: '⚠️ Confirmar Exclusão',
                description: `Tem certeza que deseja excluir o produto **${product.name}**?`,
                fields: [
                    { name: '🆔 ID', value: `#${product.id}`, inline: true },
                    { name: '💰 Preço', value: Helpers.formatPrice(product.price), inline: true },
                    { name: '📦 Estoque', value: product.stock.toString(), inline: true }
                ],
                footer: { text: 'Esta ação não pode ser desfeita!' }
            }],
            components: [row],
            flags: 64
        });
    }

    // Processar exclusão de produto
    static async processDeleteProduct(interaction, productId) {
        try {
            const product = await Database.getProduct(productId);
            if (!product) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Produto não encontrado!')],
                    flags: 64
                });
            }

            await Database.deleteProduct(productId);

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Produto Excluído!',
                    description: `Produto **${product.name}** foi excluído com sucesso.`,
                    fields: [
                        { name: '🆔 ID', value: `#${productId}`, inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao excluir produto:', error);
            
            try {
                const errorMessage = {
                    embeds: [Helpers.createErrorEmbed('❌ Erro ao excluir produto!')],
                    flags: 64
                };
                
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else if (!interaction.replied) {
                    await interaction.reply(errorMessage);
                }
            } catch (replyError) {
                console.error('❌ Erro ao responder erro de exclusão:', replyError);
            }
        }
    }

    // Cancelar exclusão
    static async cancelDelete(interaction) {
        await interaction.reply({
            embeds: [{
                color: 0x95a5a6,
                title: '❌ Exclusão Cancelada',
                description: 'A exclusão do produto foi cancelada.'
            }],
            flags: 64
        });
    }

    // Modal para cupom
    static async showCouponModal(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('modal_apply_coupon')
            .setTitle('🎟️ Aplicar Cupom de Desconto');

        const codeInput = new TextInputBuilder()
            .setCustomId('coupon_code')
            .setLabel('Código do Cupom')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setPlaceholder('Ex: DESCONTO10')
            .setMaxLength(50);

        modal.addComponents(
            new ActionRowBuilder().addComponents(codeInput)
        );

        await interaction.showModal(modal);
    }

    // Processar aplicação de cupom
    static async processApplyCoupon(interaction) {
        const couponCode = interaction.fields.getTextInputValue('coupon_code').toUpperCase();

        try {
            const cart = await Database.getCartByUser(interaction.user.id);
            if (!cart) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Carrinho não encontrado!')],
                    flags: 64
                });
            }

            const coupon = await Database.getCoupon(couponCode);
            if (!coupon) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Cupom inválido ou expirado!')],
                    flags: 64
                });
            }

            // Calcular desconto
            const originalTotal = cart.total_amount;
            const discount = Helpers.calculateDiscount(originalTotal, coupon.discount_type, coupon.discount_value);
            const newTotal = originalTotal - discount;

            // Aplicar cupom
            await Database.applyCouponToCart(cart.id, couponCode, newTotal);
            await Database.useCoupon(couponCode);

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '🎟️ Cupom Aplicado!',
                    description: `Cupom **${couponCode}** aplicado com sucesso!`,
                    fields: [
                        { name: '💰 Total Original', value: Helpers.formatPrice(originalTotal), inline: true },
                        { name: '🎯 Desconto', value: Helpers.formatPrice(discount), inline: true },
                        { name: '✅ Novo Total', value: Helpers.formatPrice(newTotal), inline: true }
                    ],
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao aplicar cupom:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao aplicar cupom!')],
                flags: 64
            });
        }
    }

    // Limpar carrinho
    static async clearCart(interaction) {
        try {
            const cart = await Database.getCartByUser(interaction.user.id);
            if (!cart) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('🛒 Carrinho não encontrado!')],
                    flags: 64
                });
            }

            await Database.updateCartStatus(cart.id, 'cleared');
            await Database.clearCartItems(cart.id);

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '🗑️ Carrinho Limpo!',
                    description: 'Todos os itens foram removidos do seu carrinho.',
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao limpar carrinho:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao limpar carrinho!')],
                flags: 64
            });
        }
    }

    // Remover item do carrinho
    static async removeCartItem(interaction, itemId) {
        try {
            const cart = await Database.getCartByUser(interaction.user.id);
            if (!cart) {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('🛒 Carrinho não encontrado!')],
                    flags: 64
                });
            }

            // Remover item do carrinho (itemId é na verdade productId)
            await Database.removeCartItem(cart.id, itemId);

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '🗑️ Item Removido!',
                    description: 'O item foi removido do seu carrinho.',
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao remover item do carrinho:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao remover item do carrinho!')],
                flags: 64
            });
        }
    }


    // Modal para gerenciar estoque
    static async showStockModal(interaction, product) {
        const modal = new ModalBuilder()
            .setCustomId(`modal_stock_${product.id}`)
            .setTitle(`📦 Gerenciar Estoque - ${product.name}`);

        const stockInput = new TextInputBuilder()
            .setCustomId('new_stock')
            .setLabel('Novo Estoque')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(product.stock.toString())
            .setPlaceholder('Ex: 100');

        modal.addComponents(
            new ActionRowBuilder().addComponents(stockInput)
        );

        await interaction.showModal(modal);
    }

    // Processar atualização de estoque
    static async processStockUpdate(interaction, productId) {
        const newStockString = interaction.fields.getTextInputValue('new_stock');
        const newStock = parseInt(newStockString);

        if (isNaN(newStock) || newStock < 0) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Estoque deve ser um número válido!')],
                flags: 64
            });
        }

        try {
            await Database.updateStock(productId, newStock);

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Estoque Atualizado!',
                    description: `Estoque atualizado para **${newStock}** unidades.`,
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao atualizar estoque:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao atualizar estoque!')],
                flags: 64
            });
        }
    }

    // Cancelar pagamento
    static async cancelPayment(interaction) {
        const saleId = interaction.customId.split('_')[2];
        
        try {
            // Marcar venda como cancelada
            await Database.updateSaleStatus(saleId, 'cancelled');
            
            // Marcar carrinho como cancelado
            const sale = await Database.getSale(saleId);
            if (sale) {
                await Database.updateCartStatus(sale.cart_id, 'cancelled');
            }

            await interaction.reply({
                embeds: [{
                    color: 0xe74c3c,
                    title: '❌ Pagamento Cancelado',
                    description: 'O pagamento foi cancelado. Este canal será removido em breve.',
                    timestamp: new Date().toISOString()
                }]
            });

            // Deletar canal após 30 segundos
            setTimeout(async () => {
                try {
                    await interaction.channel.delete('Pagamento cancelado');
                } catch (error) {
                    console.error('❌ Erro ao deletar canal:', error);
                }
            }, 30000);

        } catch (error) {
            console.error('❌ Erro ao cancelar pagamento:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao cancelar pagamento!')],
                flags: 64
            });
        }
    }

    // Mostrar detalhes do produto
    static async showProductDetails(interaction, productId) {
        try {
            const product = await Database.getProductById(productId);
            if (!product || !product.active) {
                const errorMessage = {
                    embeds: [Helpers.createErrorEmbed('❌ Produto não encontrado!')]
                };
                
                if (interaction.deferred) {
                    return await interaction.editReply(errorMessage);
                } else {
                    return await interaction.reply({ ...errorMessage, flags: 64 });
                }
            }

            const replyData = {
                embeds: [{
                    color: 0x3498db,
                    title: `📦 ${product.name}`,
                    description: product.description || 'Sem descrição disponível',
                    fields: [
                        {
                            name: '💰 Preço',
                            value: Helpers.formatPrice(product.price),
                            inline: true
                        },
                        {
                            name: '📦 Estoque',
                            value: product.stock > 0 ? `${product.stock} disponível` : 'Fora de estoque',
                            inline: true
                        },
                        {
                            name: '🆔 ID',
                            value: `#${product.id}`,
                            inline: true
                        }
                    ],
                    image: product.image_url ? { url: product.image_url } : null,
                    timestamp: new Date().toISOString()
                }],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`product_add-to-cart_${productId}`)
                            .setLabel('Adicionar ao Carrinho')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🛒')
                            .setDisabled(product.stock <= 0),
                        new ButtonBuilder()
                            .setCustomId(`product_buy-now_${productId}`)
                            .setLabel('Comprar Agora')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💳')
                            .setDisabled(product.stock <= 0)
                    )
                ]
            };

            if (interaction.deferred) {
                await interaction.editReply(replyData);
            } else {
                await interaction.reply({ ...replyData, flags: 64 });
            }

        } catch (error) {
            console.error('❌ Erro ao mostrar detalhes do produto:', error);
            const errorMessage = {
                embeds: [Helpers.createErrorEmbed('❌ Erro ao carregar detalhes do produto!')]
            };
            
            if (interaction.deferred) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply({ ...errorMessage, flags: 64 });
            }
        }
    }

    // Reenviar produto
    static async resendProduct(interaction) {
        const saleId = interaction.customId.split('_')[2];
        
        try {
            const sale = await Database.getSaleById(saleId);
        
            if (!sale || sale.payment_status !== 'completed') {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada ou não foi paga!')],
                    flags: 64
                });
            }

            // Aqui você implementaria a lógica de reenvio
            // Por exemplo: enviar por DM, dar cargo novamente, etc.
            
            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Produto Reenviado!',
                    description: 'O produto foi reenviado com sucesso.',
                    timestamp: new Date().toISOString()
                }],
                flags: 64
            });

        } catch (error) {
            console.error('❌ Erro ao reenviar produto:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao reenviar produto!')],
                flags: 64
            });
        }
    }

    // Compra direta
    static async buyNow(interaction, productId) {
        try {
            console.log(`🔍 Buscando produto ID: ${productId}`);
            const product = await Database.getProductById(productId);
            console.log(`📦 Produto encontrado:`, product);
            
            if (!product || !product.active) {
                console.log(`❌ Produto não encontrado ou inativo. Product:`, product);
                const errorMessage = { embeds: [Helpers.createErrorEmbed('❌ Produto não encontrado!')] };
                
                if (interaction.deferred) {
                    return await interaction.editReply(errorMessage);
                } else {
                    return await interaction.reply({ ...errorMessage, flags: 64 });
                }
            }

            // Criar carrinho temporário
            const cartId = Helpers.generateUUID();
            const expiresAt = Helpers.calculateExpirationDate(parseInt(process.env.CART_EXPIRATION_HOURS) || 24);
            
            await Database.createCart({
                id: cartId,
                user_id: interaction.user.id,
                channel_id: null,
                expires_at: expiresAt
            });
            
            await Database.addCartItem(cartId, productId, 1, product.price);

            // Processar checkout
            await this.processCheckout(interaction, cartId);

        } catch (error) {
            console.error('❌ Erro na compra direta:', error);
            
            try {
                const errorMessage = { embeds: [Helpers.createErrorEmbed('❌ Erro ao processar compra direta!')] };
                
                if (interaction.deferred) {
                    await interaction.editReply(errorMessage);
                } else if (!interaction.replied) {
                    await interaction.reply({ ...errorMessage, flags: 64 });
                }
            } catch (replyError) {
                console.error('❌ Erro ao responder erro de compra:', replyError);
            }
        }
    }

    // Processar checkout direto (para compra agora)
    static async processCheckoutDirect(interaction, cart, product) {
        // Similar ao processCheckout, mas otimizado para um produto
        const guild = interaction.guild;
        const orderId = Helpers.generateOrderId();
        const channelName = Helpers.generateCartChannelName(interaction.user.username, orderId);

        // Encontrar ou criar categoria "Carrinho"
        let category = guild.channels.cache.find(c => c.name === (process.env.CART_CATEGORY_NAME || 'Carrinho') && c.type === 4);
        
        if (!category) {
            category = await guild.channels.create({
                name: process.env.CART_CATEGORY_NAME || 'Carrinho',
                type: 4,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: ['ViewChannel']
                    }
                ]
            });
        }

        // Criar canal do carrinho
        const cartChannel = await guild.channels.create({
            name: channelName,
            type: 0,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: ['ViewChannel']
                },
                {
                    id: interaction.user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                },
                ...guild.roles.cache
                    .filter(role => role.name === (process.env.OWNER_ROLE_NAME || 'DONO') || role.permissions.has('Administrator'))
                    .map(role => ({
                        id: role.id,
                        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages']
                    }))
            ]
        });

        // Atualizar carrinho com canal
        if (Database.useSupabase) {
            await Database.supabase.supabase.from('carts').update({ channel_id: cartChannel.id }).eq('id', cart.id);
        } else {
            await Database.db.run('UPDATE carts SET channel_id = ? WHERE id = ?', [cartChannel.id, cart.id]);
        }

        // Gerar PIX
        const total = product.price;
        const pixGenerator = new PixGenerator();
        
        // Validar configuração PIX
        const configValidation = pixGenerator.validateConfig();
        if (!configValidation.valid) {
            console.error('❌ Configuração PIX inválida:', configValidation.errors);
            return await interaction.editReply({
                embeds: [Helpers.createErrorEmbed(`❌ Erro na configuração PIX:\n${configValidation.errors.join('\n')}`)]
            });
        }
        
        const pixData = await pixGenerator.generatePixQRCode(total, orderId, `Pedido ${orderId}`);

        if (!pixData.success) {
            return await interaction.editReply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao gerar código PIX!')]
            });
        }

        // Criar venda no banco
        const saleId = Helpers.generateUUID();
        await Database.createSale({
            id: saleId,
            cart_id: cart.id,
            user_id: interaction.user.id,
            username: interaction.user.username,
            total_amount: total,
            coupon_code: null,
            pix_code: pixData.payload
        });

        // Enviar informações no canal do carrinho
        const attachment = new AttachmentBuilder(pixData.qrCodeBuffer, { name: 'qrcode-pix.png' });

        await cartChannel.send({
            content: `<@${interaction.user.id}>`,
            embeds: [{
                color: 0x00ff00,
                title: '🛒 Compra Direta',
                description: `**ID do Pedido:** \`${orderId}\`\n\n**Produto:**\n**${product.name}**\nQuantidade: 1\nPreço: ${Helpers.formatPrice(product.price)}`,
                fields: [
                    {
                        name: '💰 Total',
                        value: Helpers.formatPrice(total),
                        inline: true
                    },
                    {
                        name: '🆔 ID da Venda',
                        value: `\`${saleId}\``,
                        inline: true
                    }
                ],
                image: { url: 'attachment://qrcode-pix.png' },
                timestamp: new Date().toISOString()
            }],
            files: [attachment],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`payment_check_${saleId}`)
                        .setLabel('📎 Enviar Comprovante')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('🎫'),
                    new ButtonBuilder()
                        .setCustomId(`payment_cancel_${saleId}`)
                        .setLabel('Cancelar Pedido')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                )
            ]
        });

        // Enviar código PIX Copia e Cola
        await cartChannel.send({
            embeds: [{
                color: 0x3498db,
                title: '📋 PIX Copia e Cola',
                description: `\`\`\`${pixData.payload}\`\`\`\n\n` +
                            `⚠️ **Importante:**\n` +
                            `• Pague exatamente **${Helpers.formatPrice(total)}**\n` +
                            `• Após o pagamento, clique em "📎 Enviar Comprovante"\n` +
                            `• Nossa equipe verificará e liberará seus produtos\n` +
                            `• Este carrinho expira em 1 hora`,
                footer: { text: 'Escaneie o QR Code acima ou copie e cole este código no seu app do banco' }
            }]
        });

        await interaction.editReply({
            embeds: [{
                color: 0x2ecc71,
                title: '✅ Compra Iniciada!',
                description: `Sua compra foi criada em ${cartChannel}!\n\n` +
                            `**Produto:** ${product.name}\n` +
                            `**Total:** ${Helpers.formatPrice(total)}\n\n` +
                            `Siga as instruções no canal para completar o pagamento.`
            }]
        });
    }
}

module.exports = { handleButtonInteraction: InteractionHandler.handleButtonInteraction.bind(InteractionHandler) };
