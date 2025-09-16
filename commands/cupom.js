const { SlashCommandBuilder } = require('discord.js');
const Database = require('../utils/database');
const Helpers = require('../utils/helpers');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cupom')
        .setDescription('🎟️ Gerenciar cupons de desconto (apenas para DONO)')
        .addSubcommand(subcommand =>
            subcommand
                .setName('criar')
                .setDescription('Criar um novo cupom de desconto')
                .addStringOption(option =>
                    option.setName('codigo')
                        .setDescription('Código do cupom')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('tipo')
                        .setDescription('Tipo de desconto')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Porcentagem (%)', value: 'percentage' },
                            { name: 'Valor fixo (R$)', value: 'fixed' }
                        ))
                .addNumberOption(option =>
                    option.setName('valor')
                        .setDescription('Valor do desconto')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('usos')
                        .setDescription('Número máximo de usos (-1 para ilimitado)')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('expira')
                        .setDescription('Data de expiração (DD/MM/AAAA)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('listar')
                .setDescription('Listar todos os cupons'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deletar')
                .setDescription('Deletar um cupom')
                .addStringOption(option =>
                    option.setName('codigo')
                        .setDescription('Código do cupom para deletar')
                        .setRequired(true))),

    async execute(interaction) {
        // Verificar permissões
        if (!Helpers.hasOwnerPermission(interaction.member)) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Você não tem permissão para gerenciar cupons!')],
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'criar':
                    await this.createCoupon(interaction);
                    break;
                case 'listar':
                    await this.listCoupons(interaction);
                    break;
                case 'deletar':
                    await this.deleteCoupon(interaction);
                    break;
            }
        } catch (error) {
            console.error('❌ Erro no comando cupom:', error);
            await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Erro ao processar comando de cupom!')],
                ephemeral: true
            });
        }
    },

    async createCoupon(interaction) {
        const code = interaction.options.getString('codigo').toUpperCase();
        const type = interaction.options.getString('tipo');
        const value = interaction.options.getNumber('valor');
        const maxUses = interaction.options.getInteger('usos') || -1;
        const expirationString = interaction.options.getString('expira');

        // Validações
        if (type === 'percentage' && (value <= 0 || value > 100)) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Porcentagem deve ser entre 1 e 100!')],
                ephemeral: true
            });
        }

        if (type === 'fixed' && value <= 0) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Valor fixo deve ser maior que 0!')],
                ephemeral: true
            });
        }

        let expiresAt = null;
        if (expirationString) {
            const dateMatch = expirationString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (!dateMatch) {
                return await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Formato de data inválido! Use DD/MM/AAAA')],
                    ephemeral: true
                });
            }
            
            const [, day, month, year] = dateMatch;
            expiresAt = new Date(year, month - 1, day, 23, 59, 59).toISOString();
        }

        try {
            await Database.createCoupon({
                code,
                discount_type: type,
                discount_value: value,
                max_uses: maxUses,
                expires_at: expiresAt
            });

            const discountText = type === 'percentage' ? `${value}%` : Helpers.formatPrice(value);
            const usesText = maxUses === -1 ? 'Ilimitado' : `${maxUses} usos`;
            const expirationText = expiresAt ? Helpers.formatDateTime(new Date(expiresAt)) : 'Nunca';

            await interaction.reply({
                embeds: [{
                    color: 0x2ecc71,
                    title: '✅ Cupom Criado com Sucesso!',
                    fields: [
                        { name: '🎟️ Código', value: `\`${code}\``, inline: true },
                        { name: '💰 Desconto', value: discountText, inline: true },
                        { name: '🔢 Usos', value: usesText, inline: true },
                        { name: '📅 Expira em', value: expirationText, inline: false }
                    ],
                    timestamp: new Date().toISOString()
                }],
                ephemeral: true
            });

        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                await interaction.reply({
                    embeds: [Helpers.createErrorEmbed('❌ Já existe um cupom com este código!')],
                    ephemeral: true
                });
            } else {
                throw error;
            }
        }
    },

    async listCoupons(interaction) {
        const coupons = await Database.db.all(`
            SELECT * FROM coupons 
            WHERE active = 1 
            ORDER BY created_at DESC
        `);

        if (coupons.length === 0) {
            return await interaction.reply({
                embeds: [Helpers.createWarningEmbed('📋 Nenhum cupom ativo encontrado!')],
                ephemeral: true
            });
        }

        const couponsList = coupons.map(coupon => {
            const discountText = coupon.discount_type === 'percentage' ? 
                `${coupon.discount_value}%` : 
                Helpers.formatPrice(coupon.discount_value);
            
            const usesText = coupon.max_uses === -1 ? 
                'Ilimitado' : 
                `${coupon.current_uses}/${coupon.max_uses}`;
            
            const expirationText = coupon.expires_at ? 
                Helpers.formatDateTime(new Date(coupon.expires_at)) : 
                'Nunca';

            return `**\`${coupon.code}\`**\n` +
                   `💰 Desconto: ${discountText}\n` +
                   `🔢 Usos: ${usesText}\n` +
                   `📅 Expira: ${expirationText}`;
        }).join('\n\n');

        await interaction.reply({
            embeds: [{
                color: 0x3498db,
                title: '🎟️ Cupons Ativos',
                description: couponsList,
                footer: { text: `Total: ${coupons.length} cupom(ns)` }
            }],
            ephemeral: true
        });
    },

    async deleteCoupon(interaction) {
        const code = interaction.options.getString('codigo').toUpperCase();

        const result = await Database.db.run(
            'UPDATE coupons SET active = 0 WHERE code = ? AND active = 1',
            [code]
        );

        if (result.changes === 0) {
            return await interaction.reply({
                embeds: [Helpers.createErrorEmbed('❌ Cupom não encontrado!')],
                ephemeral: true
            });
        }

        await interaction.reply({
            embeds: [{
                color: 0x2ecc71,
                title: '✅ Cupom Deletado!',
                description: `O cupom \`${code}\` foi desativado com sucesso.`,
                timestamp: new Date().toISOString()
            }],
            ephemeral: true
        });
    }
};
