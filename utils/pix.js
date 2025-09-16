const QRCode = require('qrcode');

class PixGenerator {
    constructor() {
        this.pixKey = process.env.PIX_KEY;
        this.pixName = process.env.PIX_NAME;
        this.pixCity = process.env.PIX_CITY;
    }

    // Gerar payload PIX conforme padrão do Banco Central
    generatePixPayload(amount, txId, description = '') {
        // Função para calcular CRC16 CCITT
        function crc16(data) {
            let crc = 0xFFFF;
            for (let i = 0; i < data.length; i++) {
                crc ^= data.charCodeAt(i) << 8;
                for (let j = 0; j < 8; j++) {
                    if (crc & 0x8000) {
                        crc = (crc << 1) ^ 0x1021;
                    } else {
                        crc = crc << 1;
                    }
                    crc &= 0xFFFF;
                }
            }
            return crc.toString(16).toUpperCase().padStart(4, '0');
        }

        // Função para formatar campo PIX
        function formatField(id, value) {
            const length = value.length.toString().padStart(2, '0');
            return `${id}${length}${value}`;
        }

        // Validar e limpar dados
        const cleanPixKey = this.pixKey.replace(/[^0-9]/g, ''); // Apenas números para CPF
        const cleanName = this.pixName.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().substring(0, 25);
        const cleanCity = this.pixCity.replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().substring(0, 15);
        const cleanDescription = description.replace(/[^A-Za-z0-9 ]/g, '').substring(0, 72);
        const cleanTxId = txId.replace(/[^A-Za-z0-9]/g, '').substring(0, 25);

        // Montar payload
        let payload = '';
        
        // Payload Format Indicator
        payload += formatField('00', '01');
        
        // Point of Initiation Method (12 = QR dinâmico para melhor compatibilidade)
        payload += formatField('01', '12');
        
        // Merchant Account Information
        let merchantInfo = '';
        merchantInfo += formatField('00', 'BR.GOV.BCB.PIX'); // GUI
        merchantInfo += formatField('01', cleanPixKey); // Chave PIX
        
        if (cleanDescription) {
            merchantInfo += formatField('02', cleanDescription); // Descrição
        }
        
        payload += formatField('26', merchantInfo);
        
        // Merchant Category Code
        payload += formatField('52', '0000');
        
        // Transaction Currency (986 = BRL)
        payload += formatField('53', '986');
        
        // Transaction Amount
        if (amount && amount > 0) {
            payload += formatField('54', amount.toFixed(2));
        }
        
        // Country Code
        payload += formatField('58', 'BR');
        
        // Merchant Name
        payload += formatField('59', cleanName);
        
        // Merchant City
        payload += formatField('60', cleanCity);
        
        // Additional Data Field Template
        if (cleanTxId) {
            let additionalData = formatField('05', cleanTxId); // Reference Label
            payload += formatField('62', additionalData);
        }
        
        // CRC16
        payload += '6304';
        const crcValue = crc16(payload);
        payload += crcValue;
        
        return payload;
    }

    // Gerar QR Code PIX
    async generatePixQRCode(amount, orderId, description = '') {
        try {
            const payload = this.generatePixPayload(amount, orderId, description);
            const qrCodeBuffer = await QRCode.toBuffer(payload, {
                type: 'png',
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            
            return {
                payload,
                qrCodeBuffer,
                success: true
            };
        } catch (error) {
            console.error('❌ Erro ao gerar QR Code PIX:', error);
            return {
                payload: null,
                qrCodeBuffer: null,
                success: false,
                error: error.message
            };
        }
    }

    // Gerar código PIX Copia e Cola
    generatePixCopyPaste(amount, orderId, description = '') {
        return this.generatePixPayload(amount, orderId, description);
    }

    // Validar chave PIX
    static validatePixKey(key) {
        if (!key) return false;
        
        // CPF (11 dígitos)
        if (/^\d{11}$/.test(key)) return true;
        
        // CNPJ (14 dígitos)
        if (/^\d{14}$/.test(key)) return true;
        
        // Email
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return true;
        
        // Telefone (+5511999999999)
        if (/^\+55\d{10,11}$/.test(key)) return true;
        
        // Chave aleatória (UUID)
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return true;
        
        return false;
    }

    // Validar configurações PIX
    validateConfig() {
        const errors = [];
        
        if (!this.pixKey) {
            errors.push('PIX_KEY não configurada');
        } else if (!PixGenerator.validatePixKey(this.pixKey)) {
            errors.push('PIX_KEY inválida');
        }
        
        if (!this.pixName || this.pixName.trim().length === 0) {
            errors.push('PIX_NAME não configurado');
        }
        
        if (!this.pixCity || this.pixCity.trim().length === 0) {
            errors.push('PIX_CITY não configurada');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Formatar valor monetário
    static formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    // Validar valor monetário
    static validateAmount(amount) {
        const numAmount = parseFloat(amount);
        return !isNaN(numAmount) && numAmount > 0 && numAmount <= 999999.99;
    }
}

module.exports = PixGenerator;
