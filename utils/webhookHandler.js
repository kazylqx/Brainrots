const express = require('express');
const Database = require('./database');
const Helpers = require('./helpers');
const { WebhookClient } = require('discord.js');

class WebhookHandler {
    constructor(client) {
        this.client = client;
        this.app = express();
        this.port = process.env.WEBHOOK_PORT || 3000;
        
        // Webhook do Discord para notificações
        this.discordWebhook = new WebhookClient({
            url: 'https://discord.com/api/webhooks/1412274899954827435/4TaeRax17HwQZcTaEflWD5bC3SQ0tMY0_Ky3DeO1ICNu4g827ahgELtfXFL1l3a2ZtmA'
        });
        
        this.setupRoutes();
    }

    setupRoutes() {
        // Middleware para parsing JSON
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Endpoint para confirmação de pagamento PIX
        this.app.post('/payment/confirm', async (req, res) => {
            try {
                const { saleId, amount, transactionId, pixKey, timestamp } = req.body;
                
                console.log('🔔 Webhook de pagamento recebido:', req.body);
                
                // Validar dados obrigatórios
                if (!saleId || !amount) {
                    return res.status(400).json({
                        success: false,
                        error: 'saleId e amount são obrigatórios'
                    });
                }

                // Processar pagamento
                const result = await this.processPaymentConfirmation(saleId, {
                    amount: parseFloat(amount),
                    transactionId: transactionId || `WEBHOOK_${Date.now()}`,
                    pixKey: pixKey,
                    timestamp: timestamp || new Date().toISOString(),
                    method: 'webhook'
                });

                res.json(result);

            } catch (error) {
                console.error('❌ Erro no webhook de pagamento:', error);
                res.status(500).json({
                    success: false,
                    error: 'Erro interno do servidor'
                });
            }
        });

        // Endpoint para teste
        this.app.get('/test', (req, res) => {
            res.json({
                success: true,
                message: 'Webhook handler funcionando!',
                timestamp: new Date().toISOString()
            });
        });

        // Endpoint para simular pagamento (apenas para testes)
        this.app.post('/payment/simulate', async (req, res) => {
            try {
                const { saleId } = req.body;
                
                if (!saleId) {
                    return res.status(400).json({
                        success: false,
                        error: 'saleId é obrigatório'
                    });
                }

                // Buscar venda
                const sale = await Database.db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
                if (!sale) {
                    return res.status(404).json({
                        success: false,
                        error: 'Venda não encontrada'
                    });
                }

                // Simular confirmação de pagamento
                const result = await this.processPaymentConfirmation(saleId, {
                    amount: sale.total_amount,
                    transactionId: `SIMULATE_${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    method: 'simulation'
                });

                res.json(result);

            } catch (error) {
                console.error('❌ Erro na simulação:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    async processPaymentConfirmation(saleId, paymentData) {
        try {
            // Buscar venda
            const sale = await Database.db.get('SELECT * FROM sales WHERE id = ?', [saleId]);
            if (!sale) {
                throw new Error('Venda não encontrada');
            }

            if (sale.payment_status === 'completed') {
                return {
                    success: false,
                    error: 'Pagamento já foi processado'
                };
            }

            // Verificar valor (tolerância de 1 centavo)
            const expectedAmount = parseFloat(sale.total_amount);
            const paidAmount = parseFloat(paymentData.amount);
            const tolerance = 0.01;

            if (Math.abs(paidAmount - expectedAmount) > tolerance) {
                return {
                    success: false,
                    error: `Valor incorreto. Esperado: ${expectedAmount}, Recebido: ${paidAmount}`
                };
            }

            // Atualizar status da venda
            const paymentInfo = JSON.stringify({
                ...paymentData,
                confirmed_by: 'webhook',
                confirmed_at: new Date().toISOString()
            });

            await Database.db.run(
                'UPDATE sales SET payment_status = ?, payment_data = ?, completed_at = datetime("now") WHERE id = ?',
                ['completed', paymentInfo, saleId]
            );

            // Processar entrega
            await this.processProductDelivery(sale);

            // Notificar via Discord webhook
            await this.notifyPaymentSuccess(sale, paymentData);

            console.log(`✅ Pagamento processado automaticamente via webhook: ${saleId}`);

            return {
                success: true,
                message: 'Pagamento confirmado e produtos entregues',
                saleId: saleId,
                amount: expectedAmount
            };

        } catch (error) {
            console.error(`❌ Erro ao processar pagamento ${saleId}:`, error);
            throw error;
        }
    }

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

            // Notificar no canal do carrinho
            await this.notifyInCartChannel(sale, cart);

            // Log da venda
            const Logger = require('./logger');
            await Logger.logSale({
                saleId: sale.id,
                userId: sale.user_id,
                username: sale.username,
                amount: sale.total_amount,
                status: 'completed',
                method: 'webhook'
            });

        } catch (error) {
            console.error('❌ Erro na entrega:', error);
        }
    }

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
                    title: '🎉 Produto Entregue Automaticamente!',
                    description: `Seu pagamento PIX foi confirmado automaticamente!\n\n` +
                               `**Produto:** ${product.name}\n` +
                               `**Quantidade:** ${quantity}\n` +
                               `**Venda:** \`#${sale.id}\`\n\n` +
                               `${product.description || 'Aproveite seu produto!'}`,
                    fields: [
                        {
                            name: '⚡ Entrega Instantânea',
                            value: 'Produto entregue automaticamente após confirmação do pagamento!',
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
                    footer: { text: 'Sistema Automático via Webhook' }
                }]
            });

        } catch (dmError) {
            console.error('❌ Erro ao enviar DM:', dmError);
        }
    }

    async notifyInCartChannel(sale, cart) {
        try {
            if (!cart.channel_id) return;

            const channel = await this.client.channels.fetch(cart.channel_id);
            if (!channel) return;

            await channel.send({
                content: `<@${sale.user_id}>`,
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Pagamento Confirmado Automaticamente!',
                    description: `Seu pagamento PIX foi confirmado via webhook!\n\n` +
                               `**Valor:** ${Helpers.formatPrice(sale.total_amount)}\n` +
                               `**Venda:** \`#${sale.id}\`\n\n` +
                               `🎉 **Produtos entregues!** Verifique suas mensagens privadas.`,
                    fields: [
                        {
                            name: '⚡ Sistema Automático',
                            value: 'Pagamento processado instantaneamente via webhook!',
                            inline: false
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Este canal será removido em 2 minutos' }
                }]
            });

            // Remover canal após 2 minutos
            setTimeout(async () => {
                try {
                    await channel.delete('Venda concluída automaticamente');
                } catch (error) {
                    console.error('❌ Erro ao deletar canal:', error);
                }
            }, 2 * 60 * 1000);

        } catch (error) {
            console.error('❌ Erro ao notificar no canal:', error);
        }
    }

    async notifyPaymentSuccess(sale, paymentData) {
        try {
            await this.discordWebhook.send({
                embeds: [{
                    color: 0x2ecc71,
                    title: '💰 Pagamento Confirmado via Webhook',
                    description: `Nova venda processada automaticamente!`,
                    fields: [
                        {
                            name: '🆔 ID da Venda',
                            value: `\`${sale.id}\``,
                            inline: true
                        },
                        {
                            name: '👤 Cliente',
                            value: sale.username,
                            inline: true
                        },
                        {
                            name: '💰 Valor',
                            value: Helpers.formatPrice(sale.total_amount),
                            inline: true
                        },
                        {
                            name: '🔗 Transação',
                            value: paymentData.transactionId || 'N/A',
                            inline: true
                        },
                        {
                            name: '⏰ Horário',
                            value: new Date().toLocaleString('pt-BR'),
                            inline: true
                        },
                        {
                            name: '🎯 Status',
                            value: '✅ Entregue Automaticamente',
                            inline: true
                        }
                    ],
                    timestamp: new Date().toISOString(),
                    footer: { text: 'Sistema Automático de Vendas' }
                }]
            });
        } catch (error) {
            console.error('❌ Erro ao enviar webhook Discord:', error);
        }
    }

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
                await member.roles.add(clientRole, 'Compra confirmada via webhook');
            }

        } catch (error) {
            console.error('❌ Erro ao dar cargo cliente:', error);
        }
    }

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

    start() {
        this.app.listen(this.port, () => {
            console.log(`🌐 Webhook server rodando na porta ${this.port}`);
            console.log(`📡 Endpoint de pagamento: http://localhost:${this.port}/payment/confirm`);
            console.log(`🧪 Endpoint de teste: http://localhost:${this.port}/test`);
            console.log(`🎯 Simulação: http://localhost:${this.port}/payment/simulate`);
        });
    }

    stop() {
        if (this.server) {
            this.server.close();
            console.log('⏹️ Webhook server parado');
        }
    }
}

module.exports = WebhookHandler;
