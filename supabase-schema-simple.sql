-- Schema Simplificado para Supabase - DoubeBot
-- Execute uma tabela por vez se houver problemas de conexão

-- 1. Tabela de produtos (execute primeiro)
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de carrinhos
CREATE TABLE carts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    channel_id TEXT,
    status TEXT DEFAULT 'active',
    coupon_code TEXT,
    total_amount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 3. Tabela de itens do carrinho
CREATE TABLE cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id TEXT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

-- 4. Tabela de vendas
CREATE TABLE sales (
    id TEXT PRIMARY KEY,
    cart_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    coupon_code TEXT,
    payment_status TEXT DEFAULT 'pending',
    payment_data TEXT,
    pix_code TEXT,
    products_data TEXT,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de mensagens de produtos
CREATE TABLE product_messages (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL,
    channel_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Tabela de configurações
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabela de cupons
CREATE TABLE coupons (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    max_uses INTEGER DEFAULT -1,
    current_uses INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
