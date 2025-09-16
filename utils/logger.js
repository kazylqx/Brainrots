const { EmbedBuilder } = require('discord.js');
const Helpers = require('./helpers');

class SalesLogger {
    // Registrar venda no canal de logs
    static async logSale(guild, saleData) {
        try {
            // Encontrar canal de logs
            const logChannelId = process.env.LOG_CHANNEL_ID;
            let logChannel;
            
            // Se ID estiver configurado, usar ID
            if (logChannelId && logChannelId !== 'your_log_channel_id_here') {
                logChannel = guild.channels.cache.get(logChannelId);
            } else {
                // Fallback: buscar por nome
                const logChannelName = 'vendas-log';
                logChannel = guild.channels.cache.find(c => c.name === logChannelName && c.type === 0);
            }
            
            // Criar canal se não existir
            if (!logChannel) {
                const channelName = logChannelId ? 'vendas-log' : logChannelName;
                logChannel = await guild.channels.create({
                    name: channelName,
                    type: 0, // Text channel
                    topic: 'Registro automático de vendas do bot',
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: ['SendMessages'],
                            allow: ['ViewChannel', 'ReadMessageHistory']
                        },
                        // Apenas administradores podem enviar mensagens
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
            }

            // Buscar dados dos produtos do carrinho
            const Database = require('./database');
            const cartItems = await Database.getCartItems(saleData.cart_id);
            
            const productsText = cartItems.map(item => 
                `**${item.name}**\n` +
                `🆔: ${item.product_id}\n` +
                `💵: ${Helpers.formatPrice(item.unit_price)}\n` +
                `🛒: ${item.quantity}\n` +
                `💰: ${Helpers.formatPrice(item.quantity * item.unit_price)}\n` +
                `🛂: ${item.role_id || 'N/A'}\n` +
                `🗓️: ${item.role_days || 0} dias\n` +
                `🇳: [${item.name}](${item.image_url || 'N/A'})`
            ).join('\n\n');

            const logEmbed = new EmbedBuilder()
                .setColor(saleData.payment_status === 'completed' ? 0x2ecc71 : 0xf39c12)
                .setTitle('📋 Registro de Venda')
                .setDescription(`**Registro de venda:** \`${saleData.id}\``)
                .addFields(
                    {
                        name: '👤 Comprador',
                        value: `**Nome:** ${saleData.username}\n**ID:** ${saleData.user_id}`,
                        inline: true
                    },
                    {
                        name: '💰 Valores',
                        value: `**Total:** ${Helpers.formatPrice(saleData.total_amount)}\n**Cupom:** ${saleData.coupon_code || 'N/A'}`,
                        inline: true
                    },
                    {
                        name: '📊 Status',
                        value: `**Status:** ${saleData.payment_status === 'completed' ? '✅ CONCLUÍDA' : '⏳ PENDENTE'}\n**Entrega:** Direct Message`,
                        inline: true
                    },
                    {
                        name: '🛍️ Produtos',
                        value: productsText.length > 1024 ? productsText.substring(0, 1021) + '...' : productsText,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `🪙 Valor total: ${Helpers.formatPrice(saleData.total_amount)}`,
                    iconURL: guild.iconURL()
                })
                .setTimestamp();

            await logChannel.send({ embeds: [logEmbed] });
            console.log(`📝 Venda ${saleData.id} registrada no canal de logs`);

        } catch (error) {
            console.error('❌ Erro ao registrar venda no log:', error);
        }
    }

    // Atualizar log de venda quando status muda
    static async updateSaleLog(guild, saleId, newStatus) {
        try {
            const logChannelId = process.env.LOG_CHANNEL_ID;
            let logChannel;
            
            // Se ID estiver configurado, usar ID
            if (logChannelId && logChannelId !== 'your_log_channel_id_here') {
                logChannel = guild.channels.cache.get(logChannelId);
            } else {
                // Fallback: buscar por nome
                const logChannelName = 'vendas-log';
                logChannel = guild.channels.cache.find(c => c.name === logChannelName && c.type === 0);
            }
            
            if (!logChannel) return;

            // Buscar mensagens recentes que contenham o ID da venda
            const messages = await logChannel.messages.fetch({ limit: 50 });
            const saleMessage = messages.find(msg => 
                msg.embeds.length > 0 && 
                msg.embeds[0].description && 
                msg.embeds[0].description.includes(saleId)
            );

            if (saleMessage && saleMessage.embeds[0]) {
                const embed = EmbedBuilder.from(saleMessage.embeds[0]);
                
                // Atualizar cor e status
                embed.setColor(newStatus === 'completed' ? 0x2ecc71 : 0xe74c3c);
                
                // Atualizar campo de status
                const statusField = embed.data.fields.find(field => field.name === '📊 Status');
                if (statusField) {
                    const statusText = newStatus === 'completed' ? '✅ CONCLUÍDA' : 
                                     newStatus === 'cancelled' ? '❌ CANCELADA' : '⏳ PENDENTE';
                    statusField.value = `**Status:** ${statusText}\n**Entrega:** Direct Message`;
                }

                await saleMessage.edit({ embeds: [embed] });
                console.log(`📝 Log da venda ${saleId} atualizado para ${newStatus}`);
            }

        } catch (error) {
            console.error('❌ Erro ao atualizar log de venda:', error);
        }
    }

    // Registrar ação administrativa
    static async logAdminAction(guild, adminUser, action, details) {
        try {
            const actionEmbed = new EmbedBuilder()
                .setColor(0x3498db)
                .setTitle('🔧 Ação Administrativa')
                .setDescription(`**Administrador:** ${adminUser.username} (${adminUser.id})`)
                .addFields(
                    {
                        name: '⚡ Ação',
                        value: action,
                        inline: true
                    },
                    {
                        name: '📝 Detalhes',
                        value: details,
                        inline: false
                    }
                )
                .setThumbnail(adminUser.displayAvatarURL())
                .setTimestamp();

            await logChannel.send({ embeds: [actionEmbed] });

        } catch (error) {
            console.error('❌ Erro ao registrar ação administrativa:', error);
        }
    }

    // Registrar erro do sistema
    static async logSystemError(guild, error, context) {
        try {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle('⚠️ Erro do Sistema')
                .setDescription(`**Contexto:** ${context}`)
                .addFields(
                    {
                        name: '❌ Erro',
                        value: `\`\`\`${error.message}\`\`\``,
                        inline: false
                    }
                )
                .setTimestamp();

            await logChannel.send({ embeds: [errorEmbed] });

        } catch (logError) {
            console.error('❌ Erro ao registrar erro no log:', logError);
        }
    }

    // Gerar relatório de vendas
    static async generateSalesReport(guild, period = 'daily') {
        try {
            const Database = require('./database');
            
            // Calcular período
            const now = new Date();
            let startDate;
            
            switch (period) {
                case 'daily':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'weekly':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'monthly':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                default:
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            }

            // Buscar vendas do período
            const sales = await Database.db.all(`
                SELECT * FROM sales 
                WHERE created_at >= ? AND payment_status = 'completed'
                ORDER BY created_at DESC
            `, [startDate.toISOString()]);

            if (sales.length === 0) {
                return {
                    embed: Helpers.createInfoEmbed(`📊 Nenhuma venda encontrada no período (${period})`),
                    hasData: false
                };
            }

            // Calcular estatísticas
            const totalRevenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
            const averageTicket = totalRevenue / sales.length;
            
            // Produtos mais vendidos
            const productStats = {};
            for (const sale of sales) {
                const cartItems = await Database.getCartItems(sale.cart_id);
                for (const item of cartItems) {
                    if (!productStats[item.name]) {
                        productStats[item.name] = { quantity: 0, revenue: 0 };
                    }
                    productStats[item.name].quantity += item.quantity;
                    productStats[item.name].revenue += item.quantity * item.unit_price;
                }
            }

            const topProducts = Object.entries(productStats)
                .sort((a, b) => b[1].quantity - a[1].quantity)
                .slice(0, 5)
                .map(([name, stats]) => `**${name}**: ${stats.quantity} vendas - ${Helpers.formatPrice(stats.revenue)}`)
                .join('\n');

            const reportEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle(`📊 Relatório de Vendas - ${period.charAt(0).toUpperCase() + period.slice(1)}`)
                .setDescription(`Período: ${Helpers.formatDateTime(startDate)} até ${Helpers.formatDateTime(now)}`)
                .addFields(
                    {
                        name: '💰 Receita Total',
                        value: Helpers.formatPrice(totalRevenue),
                        inline: true
                    },
                    {
                        name: '🛒 Total de Vendas',
                        value: sales.length.toString(),
                        inline: true
                    },
                    {
                        name: '📈 Ticket Médio',
                        value: Helpers.formatPrice(averageTicket),
                        inline: true
                    },
                    {
                        name: '🏆 Produtos Mais Vendidos',
                        value: topProducts || 'Nenhum produto vendido',
                        inline: false
                    }
                )
                .setFooter({ text: 'Relatório gerado automaticamente' })
                .setTimestamp();

            return {
                embed: reportEmbed,
                hasData: true,
                stats: {
                    totalRevenue,
                    totalSales: sales.length,
                    averageTicket,
                    topProducts: productStats
                }
            };

        } catch (error) {
            console.error('❌ Erro ao gerar relatório:', error);
            return {
                embed: Helpers.createErrorEmbed('❌ Erro ao gerar relatório de vendas'),
                hasData: false
            };
        }
    }
}

module.exports = SalesLogger;
