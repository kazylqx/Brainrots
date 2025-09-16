const { v4: uuidv4 } = require('uuid');

class Helpers {
    // Gerar UUID único
    static generateUUID() {
        return uuidv4();
    }

    // Gerar ID de pedido único
    static generateOrderId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${timestamp}-${random}`.toUpperCase();
    }

    // Formatar data e hora
    static formatDateTime(date = new Date()) {
        return new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Sao_Paulo'
        }).format(date);
    }

    // Calcular data de expiração
    static calculateExpirationDate(hours = 24) {
        const expiration = new Date();
        expiration.setHours(expiration.getHours() + hours);
        return expiration;
    }

    // Verificar se usuário tem permissão (cargo DONO)
    static hasOwnerPermission(member) {
        // Verificar se member existe e tem roles
        if (!member || !member.roles || !member.roles.cache) {
            return false;
        }

        const ownerRoleId = process.env.OWNER_ROLE_ID;
        
        // Se ID não estiver configurado, usar fallback por nome
        if (!ownerRoleId || ownerRoleId === 'your_owner_role_id_here') {
            const ownerRoleName = 'DONO';
            return member.roles.cache.some(role => role.name === ownerRoleName) || 
                   member.permissions.has('Administrator');
        }
        
        return member.roles.cache.has(ownerRoleId) || 
               member.permissions.has('Administrator');
    }

    // Truncar texto
    static truncateText(text, maxLength = 100) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    // Validar URL
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Escapar caracteres especiais do Discord
    static escapeDiscordMarkdown(text) {
        if (!text) return '';
        return text.replace(/[*_`~|\\]/g, '\\$&');
    }

    // Formatar número com separadores
    static formatNumber(number) {
        return new Intl.NumberFormat('pt-BR').format(number);
    }

    // Calcular desconto
    static calculateDiscount(amount, discountType, discountValue) {
        if (discountType === 'percentage') {
            return amount * (discountValue / 100);
        } else if (discountType === 'fixed') {
            return Math.min(discountValue, amount);
        }
        return 0;
    }

    // Validar estoque
    static validateStock(currentStock, requestedQuantity) {
        return currentStock >= requestedQuantity;
    }

    // Gerar nome de canal do carrinho
    static generateCartChannelName(username, orderId) {
        // Remover caracteres especiais do username
        const cleanUsername = username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return `🛒│carrinho-${cleanUsername}-${orderId}`;
    }

    // Converter tempo em string legível
    static timeToString(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) {
            return `${days} dia${days > 1 ? 's' : ''}`;
        } else if (hours > 0) {
            return `${hours} hora${hours > 1 ? 's' : ''}`;
        } else if (minutes > 0) {
            return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
        } else {
            return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
        }
    }

    // Validar entrada de preço
    static validatePrice(priceString) {
        const price = parseFloat(priceString.replace(',', '.'));
        return !isNaN(price) && price > 0 && price <= 999999.99;
    }

    // Formatar preço para exibição
    static formatPrice(price) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(price);
    }

    // Gerar cores aleatórias para embeds
    static getRandomColor() {
        const colors = [
            0x3498db, // Azul
            0x9b59b6, // Roxo
            0xe91e63, // Rosa
            0xf39c12, // Laranja
            0x2ecc71, // Verde
            0xe74c3c, // Vermelho
            0x1abc9c, // Turquesa
            0x34495e  // Cinza escuro
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    // Validar ID do Discord
    static isValidDiscordId(id) {
        return /^\d{17,19}$/.test(id);
    }

    // Limpar cache de canais expirados
    static async cleanupExpiredCarts(guild, database) {
        try {
            const expiredCarts = await database.db.all(`
                SELECT * FROM carts 
                WHERE status = 'active' AND expires_at < datetime('now')
            `);

            for (const cart of expiredCarts) {
                // Marcar carrinho como expirado
                await database.updateCartStatus(cart.id, 'expired');

                // Tentar deletar canal se existir
                if (cart.channel_id) {
                    try {
                        const channel = guild.channels.cache.get(cart.channel_id);
                        if (channel) {
                            await channel.delete('Carrinho expirado');
                        }
                    } catch (error) {
                        console.error(`❌ Erro ao deletar canal ${cart.channel_id}:`, error);
                    }
                }
            }

            if (expiredCarts.length > 0) {
                console.log(`🧹 ${expiredCarts.length} carrinho(s) expirado(s) limpo(s)`);
            }
        } catch (error) {
            console.error('❌ Erro ao limpar carrinhos expirados:', error);
        }
    }

    // Verificar se canal é de carrinho
    static isCartChannel(channelName) {
        return channelName.startsWith('🛒│carrinho-');
    }

    // Extrair informações do nome do canal do carrinho
    static parseCartChannelName(channelName) {
        const match = channelName.match(/🛒│carrinho-(.+)-(.+)/);
        if (match) {
            return {
                username: match[1],
                orderId: match[2]
            };
        }
        return null;
    }

    // Gerar embed de erro
    static createErrorEmbed(message, title = '❌ Erro') {
        return {
            color: 0xe74c3c,
            title,
            description: message,
            timestamp: new Date().toISOString()
        };
    }

    // Gerar embed de sucesso
    static createSuccessEmbed(message, title = '✅ Sucesso') {
        return {
            color: 0x2ecc71,
            title,
            description: message,
            timestamp: new Date().toISOString()
        };
    }

    // Gerar embed de aviso
    static createWarningEmbed(message, title = '⚠️ Aviso') {
        return {
            color: 0xf39c12,
            title,
            description: message,
            timestamp: new Date().toISOString()
        };
    }

    // Gerar embed de informação
    static createInfoEmbed(message, title = 'ℹ️ Informação') {
        return {
            color: 0x3498db,
            title,
            description: message,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = Helpers;
