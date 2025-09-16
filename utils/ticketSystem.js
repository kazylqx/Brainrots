const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const Database = require('./database');
const Helpers = require('./helpers');

class TicketSystem {
    constructor(client) {
        this.client = client;
    }

    // Criar ticket de comprovante de pagamento
    async createPaymentTicket(interaction, saleId) {
        try {
            const sale = await Database.db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
            if (!sale) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada!')],
                    ephemeral: true
                });
            }

            if (sale.payment_status === 'completed') {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('⚠️ Esta venda já foi processada!')],
                    ephemeral: true
                });
            }

            const guild = interaction.guild;
            
            // Encontrar ou criar categoria "Tickets"
            let ticketCategory = guild.channels.cache.find(c => c.name === 'Tickets' && c.type === ChannelType.GuildCategory);
            
            if (!ticketCategory) {
                ticketCategory = await guild.channels.create({
                    name: 'Tickets',
                    type: ChannelType.GuildCategory,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.ViewChannel]
                        }
                    ]
                });
            }

            // Criar canal do ticket
            const ticketChannel = await guild.channels.create({
                name: `ticket-${sale.username}-${saleId.slice(-6)}`,
                type: ChannelType.GuildText,
                parent: ticketCategory.id,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: interaction.user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.AttachFiles
                        ]
                    },
                    // Adicionar permissão para administradores
                    ...guild.roles.cache
                        .filter(role => {
                            const ownerRoleId = process.env.OWNER_ROLE_ID;
                            if (ownerRoleId && ownerRoleId !== 'your_owner_role_id_here') {
                                return role.id === ownerRoleId || role.permissions.has(PermissionFlagsBits.Administrator);
                            } else {
                                return role.name === 'DONO' || role.permissions.has(PermissionFlagsBits.Administrator);
                            }
                        })
                        .map(role => ({
                            id: role.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ReadMessageHistory,
                                PermissionFlagsBits.ManageMessages
                            ]
                        }))
                ]
            });

            // Salvar ticket no banco
            await Database.db.run(`
                INSERT INTO tickets (id, sale_id, user_id, channel_id, status, created_at)
                VALUES (?, ?, ?, ?, 'open', datetime('now'))
            `, [Helpers.generateUUID(), saleId, sale.user_id, ticketChannel.id]);

            // Enviar mensagem inicial no ticket
            await ticketChannel.send({
                content: `<@${sale.user_id}>`,
                embeds: [{
                    color: 0x3498db,
                    title: '🎫 Ticket de Comprovante de Pagamento',
                    description: `Olá ${sale.username}! Este ticket foi criado para você enviar o comprovante do seu pagamento PIX.\n\n` +
                               `**Informações da Compra:**\n` +
                               `• **ID da Venda:** \`${saleId}\`\n` +
                               `• **Valor:** ${Helpers.formatPrice(sale.total_amount)}\n` +
                               `• **Data:** ${new Date(sale.created_at).toLocaleString('pt-BR')}\n\n` +
                               `📎 **Como proceder:**\n` +
                               `1. Envie uma **foto ou print** do comprovante PIX\n` +
                               `2. Aguarde a verificação da nossa equipe\n` +
                               `3. Após confirmação, você receberá seus produtos automaticamente`,
                    fields: [
                        {
                            name: '💰 Valor a Pagar',
                            value: Helpers.formatPrice(sale.total_amount),
                            inline: true
                        },
                        {
                            name: '🔑 Chave PIX',
                            value: process.env.PIX_KEY || 'Não configurada',
                            inline: true
                        },
                        {
                            name: '👤 Favorecido',
                            value: process.env.PIX_NAME || 'Não configurado',
                            inline: true
                        }
                    ],
                    footer: { text: 'Envie o comprovante neste canal para confirmar seu pagamento' },
                    timestamp: new Date().toISOString()
                }],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`ticket_confirm_${saleId}`)
                            .setLabel('✅ Confirmar Pagamento')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('💰'),
                        new ButtonBuilder()
                            .setCustomId(`ticket_close_${saleId}`)
                            .setLabel('🔒 Fechar Ticket')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('❌')
                    )
                ]
            });

            // Responder ao usuário
            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '🎫 Ticket Criado!',
                    description: `Seu ticket foi criado em ${ticketChannel}!\n\n` +
                               `Envie o comprovante do seu pagamento PIX no canal do ticket para que nossa equipe possa verificar e liberar seus produtos.`,
                    footer: { text: 'Clique no canal acima para acessar seu ticket' }
                }],
                ephemeral: true
            });

            return ticketChannel;

        } catch (error) {
            console.error('❌ Erro ao criar ticket:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao criar ticket de pagamento!')],
                ephemeral: true
            });
        }
    }

    // Confirmar pagamento via ticket
    async confirmPaymentFromTicket(interaction, saleId) {
        try {
            // Verificar se é admin
            if (!Helpers.hasOwnerPermission(interaction.member)) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Apenas administradores podem confirmar pagamentos!')],
                    ephemeral: true
                });
            }

            const sale = await Database.db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
            if (!sale) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Venda não encontrada!')],
                    ephemeral: true
                });
            }

            if (sale.payment_status === 'completed') {
                return await interaction.reply({
                    embeds: [Helpers.createWarningEmbed('⚠️ Esta venda já foi processada!')],
                    ephemeral: true
                });
            }

            // Atualizar status da venda
            const paymentData = JSON.stringify({
                confirmed_by: interaction.user.id,
                confirmed_at: new Date().toISOString(),
                method: 'manual_ticket',
                admin: interaction.user.username
            });

            await Database.db.run(
                'UPDATE sales SET payment_status = ?, payment_data = ?, completed_at = datetime("now") WHERE id = ?',
                ['completed', paymentData, saleId]
            );

            // Processar entrega
            await this.processProductDelivery(sale);

            // Atualizar ticket
            await Database.db.run('UPDATE tickets SET status = ? WHERE sale_id = ?', ['completed', saleId]);

            // Notificar confirmação no ticket
            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Pagamento Confirmado!',
                    description: `Pagamento confirmado por ${interaction.user.username}!\n\n` +
                               `**Venda:** \`${saleId}\`\n` +
                               `**Valor:** ${Helpers.formatPrice(sale.total_amount)}\n\n` +
                               `🎉 **Produtos entregues!** O cliente recebeu os produtos via DM.`,
                    fields: [
                        {
                            name: '👤 Confirmado por',
                            value: interaction.user.username,
                            inline: true
                        },
                        {
                            name: '⏰ Horário',
                            value: new Date().toLocaleString('pt-BR'),
                            inline: true
                        }
                    ],
                    footer: { text: 'Este ticket será fechado automaticamente em 5 minutos' },
                    timestamp: new Date().toISOString()
                }]
            });

            // Notificar cliente
            try {
                const user = await this.client.users.fetch(sale.user_id);
                await user.send({
                    embeds: [{
                        color: 0x2ecc71,
                        title: '✅ Pagamento Confirmado!',
                        description: `Seu pagamento foi confirmado pela nossa equipe!\n\n` +
                                   `**Venda:** \`${saleId}\`\n` +
                                   `**Valor:** ${Helpers.formatPrice(sale.total_amount)}\n\n` +
                                   `🎉 Seus produtos foram entregues! Verifique suas mensagens.`,
                        timestamp: new Date().toISOString()
                    }]
                });
            } catch (dmError) {
                console.error('❌ Erro ao enviar DM de confirmação:', dmError);
            }

            // Fechar ticket após 5 minutos
            setTimeout(async () => {
                try {
                    await interaction.channel.delete('Pagamento confirmado - ticket fechado automaticamente');
                } catch (error) {
                    console.error('❌ Erro ao fechar ticket:', error);
                }
            }, 5 * 60 * 1000);

            // Log da venda
            const Logger = require('./logger');
            await Logger.logSale({
                saleId: saleId,
                userId: sale.user_id,
                username: sale.username,
                amount: sale.total_amount,
                status: 'completed',
                method: 'manual_ticket',
                admin: interaction.user.username
            });

        } catch (error) {
            console.error('❌ Erro ao confirmar pagamento:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao confirmar pagamento!')],
                ephemeral: true
            });
        }
    }

    // Fechar ticket
    async closeTicket(interaction, saleId) {
        try {
            // Verificar se é o dono do ticket ou admin
            const ticket = await Database.db.get('SELECT * FROM tickets WHERE sale_id = ?', [saleId]);
            
            if (!ticket) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Ticket não encontrado!')],
                    ephemeral: true
                });
            }

            const isOwner = ticket.user_id === interaction.user.id;
            const isAdmin = Helpers.hasOwnerPermission(interaction.member);

            if (!isOwner && !isAdmin) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Você não tem permissão para fechar este ticket!')],
                    ephemeral: true
                });
            }

            // Atualizar status do ticket
            await Database.db.run('UPDATE tickets SET status = ? WHERE sale_id = ?', ['closed', saleId]);

            // Cancelar venda se ainda estiver pendente
            const sale = await Database.db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
            if (sale && sale.payment_status === 'pending') {
                await Database.db.run('UPDATE sales SET payment_status = ? WHERE id = ?', ['cancelled', saleId]);
            }

            await interaction.reply({
                embeds: [{
                    color: 0x95a5a6,
                    title: '🔒 Ticket Fechado',
                    description: `Ticket fechado por ${interaction.user.username}.\n\n` +
                               `Este canal será removido em 30 segundos.`,
                    timestamp: new Date().toISOString()
                }]
            });

            // Deletar canal após 30 segundos
            setTimeout(async () => {
                try {
                    await interaction.channel.delete('Ticket fechado');
                } catch (error) {
                    console.error('❌ Erro ao deletar canal do ticket:', error);
                }
            }, 30000);

        } catch (error) {
            console.error('❌ Erro ao fechar ticket:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao fechar ticket!')],
                ephemeral: true
            });
        }
    }

    // Processar entrega dos produtos
    async processProductDelivery(sale) {
        try {
            // Buscar informações do carrinho e produtos
            const cart = await Database.getCart(sale.cart_id);
            const cartItems = await Database.getCartItems(sale.cart_id);

            // Processar entrega de cada produto
            for (const item of cartItems) {
                const product = await Database.getProduct(item.product_id);
                
                // Reduzir estoque
                await Database.updateStock(item.product_id, product.stock - item.quantity);
                
                // Entregar produto
                await this.deliverProduct(sale, product, item.quantity);
            }

            // Atualizar status do carrinho
            await Database.updateCartStatus(sale.cart_id, 'completed');

            // Fechar canal do carrinho se existir
            if (cart.channel_id) {
                try {
                    const cartChannel = await this.client.channels.fetch(cart.channel_id);
                    if (cartChannel) {
                        await cartChannel.send({
                            embeds: [{
                                color: 0x2ecc71,
                                title: '✅ Pagamento Confirmado!',
                                description: `Pagamento confirmado via ticket!\n\n` +
                                           `**Produtos entregues com sucesso!**\n` +
                                           `Este canal será removido em 1 minuto.`,
                                timestamp: new Date().toISOString()
                            }]
                        });

                        setTimeout(async () => {
                            try {
                                await cartChannel.delete('Venda concluída');
                            } catch (error) {
                                console.error('❌ Erro ao deletar canal do carrinho:', error);
                            }
                        }, 60000);
                    }
                } catch (error) {
                    console.error('❌ Erro ao acessar canal do carrinho:', error);
                }
            }

        } catch (error) {
            console.error('❌ Erro na entrega:', error);
        }
    }

    // Entregar produto via DM
    async deliverProduct(sale, product, quantity) {
        try {
            const user = await this.client.users.fetch(sale.user_id);

            // Dar cargo cliente permanente
            await this.giveClientRole(sale, user);

            // Dar cargo temporário se configurado
            if (product.role_id && product.role_days > 0) {
                await this.giveTemporaryRole(sale, user, product.role_id, product.role_days);
            }

            // Enviar produto via DM
            await user.send({
                embeds: [{
                    color: 0x2ecc71,
                    title: '🎉 Produto Entregue!',
                    description: `Seu pagamento foi confirmado pela nossa equipe!\n\n` +
                               `**Produto:** ${product.name}\n` +
                               `**Quantidade:** ${quantity}\n` +
                               `**Venda:** \`#${sale.id}\`\n\n` +
                               `${product.description || 'Aproveite seu produto!'}`,
                    fields: [
                        {
                            name: '✅ Confirmação Manual',
                            value: 'Pagamento verificado e aprovado pela nossa equipe',
                            inline: false
                        },
                        {
                            name: '📞 Suporte',
                            value: 'Entre em contato caso tenha alguma dúvida',
                            inline: false
                        }
                    ],
                    image: product.image_url ? { url: product.image_url } : null,
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Obrigado pela sua compra!' }
                }]
            });

        } catch (dmError) {
            console.error('❌ Erro ao enviar DM:', dmError);
        }
    }

    // Dar cargo cliente permanente
    async giveClientRole(sale, user) {
        try {
            const guild = this.client.guilds.cache.first();
            if (!guild) return;

            const member = await guild.members.fetch(sale.user_id);
            if (!member) return;

            let clientRole = guild.roles.cache.find(role => role.name === 'Cliente');
            
            if (!clientRole) {
                clientRole = await guild.roles.create({
                    name: 'Cliente',
                    color: 0x2ecc71,
                    reason: 'Cargo automático para clientes'
                });
            }

            if (!member.roles.cache.has(clientRole.id)) {
                await member.roles.add(clientRole, 'Compra confirmada via ticket');
            }

        } catch (error) {
            console.error('❌ Erro ao dar cargo cliente:', error);
        }
    }

    // Dar cargo temporário
    async giveTemporaryRole(sale, user, roleId, days) {
        try {
            const guild = this.client.guilds.cache.first();
            if (!guild) return;

            const member = await guild.members.fetch(sale.user_id);
            const role = guild.roles.cache.get(roleId);
            
            if (!member || !role) return;

            await member.roles.add(role, `Cargo temporário - ${days} dias`);

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + days);

            await Database.db.run(`
                INSERT INTO role_assignments (user_id, role_id, guild_id, expires_at)
                VALUES (?, ?, ?, ?)
            `, [sale.user_id, roleId, guild.id, expiresAt.toISOString()]);

        } catch (error) {
            console.error('❌ Erro ao dar cargo temporário:', error);
        }
    }
}

module.exports = TicketSystem;
