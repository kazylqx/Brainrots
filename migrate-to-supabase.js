require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Script para migrar dados do SQLite para Supabase
async function migrateToSupabase() {
    console.log('🔄 Iniciando migração SQLite → Supabase...');

    // Verificar variáveis de ambiente
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
        console.error('❌ SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias!');
        process.exit(1);
    }

    // Conectar ao SQLite
    const dbPath = path.join(__dirname, 'database.sqlite');
    const sqlite = new sqlite3.Database(dbPath);

    // Conectar ao Supabase
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    try {
        // 1. Migrar produtos
        console.log('📦 Migrando produtos...');
        const products = await new Promise((resolve, reject) => {
            sqlite.all('SELECT * FROM products WHERE active = 1', [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });

        console.log(`📦 Encontrados ${products.length} produtos no SQLite`);

        for (const product of products) {
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    stock: product.stock,
                    image_url: product.image_url,
                    banner_url: product.banner_url,
                    role_id: product.role_id,
                    role_days: product.role_days || 0,
                    channel_id: product.channel_id,
                    active: true
                }]);

            if (error) {
                console.error(`❌ Erro ao migrar produto "${product.name}":`, error.message);
            } else {
                console.log(`✅ Produto migrado: ${product.name}`);
            }
        }

        // 2. Migrar cupons (se existirem)
        console.log('🎫 Migrando cupons...');
        const coupons = await new Promise((resolve, reject) => {
            sqlite.all('SELECT * FROM coupons WHERE active = 1', [], (err, rows) => {
                if (err) {
                    console.log('⚠️ Tabela de cupons não encontrada, pulando...');
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            });
        });

        for (const coupon of coupons) {
            const { data, error } = await supabase
                .from('coupons')
                .insert([{
                    code: coupon.code,
                    discount_type: coupon.discount_type,
                    discount_value: coupon.discount_value,
                    max_uses: coupon.max_uses,
                    current_uses: coupon.current_uses,
                    active: true,
                    expires_at: coupon.expires_at
                }]);

            if (error) {
                console.error(`❌ Erro ao migrar cupom "${coupon.code}":`, error.message);
            } else {
                console.log(`✅ Cupom migrado: ${coupon.code}`);
            }
        }

        console.log('✅ Migração concluída com sucesso!');
        console.log('📝 Próximos passos:');
        console.log('1. Configure SUPABASE_URL e SUPABASE_ANON_KEY no Render');
        console.log('2. Execute o SQL das tabelas no Supabase Dashboard');
        console.log('3. Faça o redeploy do bot');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
    } finally {
        sqlite.close();
    }
}

// SQL para criar tabelas no Supabase
const SUPABASE_SQL = `
-- Tabela de produtos
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER DEFAULT 0,
    image_url TEXT,
    banner_url TEXT,
    role_id TEXT,
    role_days INTEGER DEFAULT 0,
    channel_id TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de cupons
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    max_uses INTEGER DEFAULT -1,
    current_uses INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de carrinhos
CREATE TABLE IF NOT EXISTS carts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel_id TEXT,
    status TEXT DEFAULT 'active',
    coupon_code TEXT,
    total_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Tabela de itens do carrinho
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    cart_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (cart_id) REFERENCES carts (id),
    FOREIGN KEY (product_id) REFERENCES products (id)
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    coupon_code TEXT,
    payment_status TEXT DEFAULT 'pending',
    payment_data TEXT,
    pix_code TEXT,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cart_id) REFERENCES carts (id)
);

-- Tabela de mensagens de produtos
CREATE TABLE IF NOT EXISTS product_messages (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products (id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
CREATE INDEX IF NOT EXISTS idx_product_messages_product_id ON product_messages(product_id);
`;

console.log('📋 SQL para executar no Supabase Dashboard:');
console.log('=' .repeat(50));
console.log(SUPABASE_SQL);
console.log('=' .repeat(50));

// Executar migração se chamado diretamente
if (require.main === module) {
    migrateToSupabase();
}

module.exports = { migrateToSupabase, SUPABASE_SQL };
