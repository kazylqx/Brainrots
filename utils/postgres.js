const { Pool } = require('pg');

class PostgresDatabase {
    constructor() {
        this.pool = null;
    }

    // Inicializar conexão PostgreSQL
    async init() {
        try {
            // Usar DATABASE_URL do Render ou configuração local
            const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
            
            if (!connectionString) {
                console.log('⚠️ DATABASE_URL não encontrada, usando SQLite local');
                return false;
            }

            this.pool = new Pool({
                connectionString: connectionString,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            // Testar conexão
            const client = await this.pool.connect();
            console.log('✅ Conectado ao banco PostgreSQL');
            client.release();

            await this.createTables();
            return true;

        } catch (error) {
            console.error('❌ Erro ao conectar com PostgreSQL:', error.message);
            return false;
        }
    }

    // Criar tabelas PostgreSQL
    async createTables() {
        const client = await this.pool.connect();
        
        try {
            // Tabela de produtos
            await client.query(`
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
                )
            `);

            // Tabela de cupons
            await client.query(`
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
                )
            `);

            // Tabela de carrinhos
            await client.query(`
                CREATE TABLE IF NOT EXISTS carts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    channel_id TEXT,
                    status TEXT DEFAULT 'active',
                    coupon_code TEXT,
                    total_amount DECIMAL(10,2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP
                )
            `);

            // Tabela de itens do carrinho
            await client.query(`
                CREATE TABLE IF NOT EXISTS cart_items (
                    id SERIAL PRIMARY KEY,
                    cart_id TEXT NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL,
                    unit_price DECIMAL(10,2) NOT NULL,
                    FOREIGN KEY (cart_id) REFERENCES carts (id),
                    FOREIGN KEY (product_id) REFERENCES products (id)
                )
            `);

            // Tabela de vendas
            await client.query(`
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
                )
            `);

            // Tabela de mensagens de produtos
            await client.query(`
                CREATE TABLE IF NOT EXISTS product_messages (
                    id SERIAL PRIMARY KEY,
                    product_id INTEGER NOT NULL,
                    channel_id TEXT NOT NULL,
                    message_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (product_id) REFERENCES products (id)
                )
            `);

            console.log('✅ Tabelas PostgreSQL criadas/verificadas');

        } catch (error) {
            console.error('❌ Erro ao criar tabelas PostgreSQL:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Métodos para produtos
    async createProduct(productData) {
        const client = await this.pool.connect();
        try {
            const { name, description, price, stock, image_url, banner_url, role_id, role_days, channel_id } = productData;
            
            const result = await client.query(`
                INSERT INTO products (name, description, price, stock, image_url, banner_url, role_id, role_days, channel_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            `, [name, description, price, stock, image_url, banner_url, role_id, role_days, channel_id]);
            
            return result.rows[0].id;
        } finally {
            client.release();
        }
    }

    async getProducts(activeOnly = true) {
        const client = await this.pool.connect();
        try {
            const query = activeOnly ? 
                'SELECT * FROM products WHERE active = true ORDER BY created_at DESC' :
                'SELECT * FROM products ORDER BY created_at DESC';
            
            const result = await client.query(query);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getProduct(id) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM products WHERE id = $1', [id]);
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async updateProduct(id, productData) {
        const client = await this.pool.connect();
        try {
            const { name, description, price, stock, image_url, banner_url, role_id, role_days } = productData;
            
            const result = await client.query(`
                UPDATE products 
                SET name = $1, description = $2, price = $3, stock = $4, image_url = $5, banner_url = $6, role_id = $7, role_days = $8
                WHERE id = $9
            `, [name, description, price, stock, image_url, banner_url, role_id, role_days, id]);
            
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    async deleteProduct(id) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('UPDATE products SET active = false WHERE id = $1', [id]);
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    async updateStock(id, newStock) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('UPDATE products SET stock = $1 WHERE id = $2', [newStock, id]);
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    // Métodos para carrinho
    async createCart(cartData) {
        const client = await this.pool.connect();
        try {
            const { id, user_id, channel_id, expires_at } = cartData;
            
            await client.query(`
                INSERT INTO carts (id, user_id, channel_id, expires_at)
                VALUES ($1, $2, $3, $4)
            `, [id, user_id, channel_id, expires_at]);
            
            return id;
        } finally {
            client.release();
        }
    }

    async getCart(cartId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM carts WHERE id = $1', [cartId]);
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async getCartByUser(userId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM carts 
                WHERE user_id = $1 AND status = 'active'
                ORDER BY created_at DESC LIMIT 1
            `, [userId]);
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async addCartItem(cartId, productId, quantity, unitPrice) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO cart_items (cart_id, product_id, quantity, unit_price)
                VALUES ($1, $2, $3, $4)
                RETURNING id
            `, [cartId, productId, quantity, unitPrice]);
            
            return result.rows[0].id;
        } finally {
            client.release();
        }
    }

    async getCartItems(cartId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT ci.*, p.name, p.description, p.image_url, p.role_id, p.role_days
                FROM cart_items ci
                JOIN products p ON ci.product_id = p.id
                WHERE ci.cart_id = $1
            `, [cartId]);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async updateCartTotal(cartId, totalAmount) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('UPDATE carts SET total_amount = $1 WHERE id = $2', [totalAmount, cartId]);
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    async updateCartStatus(cartId, status) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('UPDATE carts SET status = $1 WHERE id = $2', [status, cartId]);
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    // Métodos para vendas
    async createSale(saleData) {
        const client = await this.pool.connect();
        try {
            const { id, cart_id, user_id, username, total_amount, coupon_code, pix_code } = saleData;
            
            await client.query(`
                INSERT INTO sales (id, cart_id, user_id, username, total_amount, coupon_code, pix_code)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [id, cart_id, user_id, username, total_amount, coupon_code, pix_code]);
            
            return id;
        } finally {
            client.release();
        }
    }

    async getSaleById(saleId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM sales WHERE id = $1', [saleId]);
            return result.rows[0] || null;
        } finally {
            client.release();
        }
    }

    async updateSaleStatus(saleId, status) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('UPDATE sales SET payment_status = $1 WHERE id = $2', [status, saleId]);
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    async completeSale(saleId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                UPDATE sales 
                SET payment_status = 'completed', completed_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `, [saleId]);
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    async getSales(limit = 50) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                SELECT * FROM sales 
                ORDER BY created_at DESC 
                LIMIT $1
            `, [limit]);
            return result.rows;
        } finally {
            client.release();
        }
    }

    // Métodos para mensagens de produtos
    async saveProductMessage(productId, channelId, messageId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
                INSERT INTO product_messages (product_id, channel_id, message_id)
                VALUES ($1, $2, $3)
                RETURNING id
            `, [productId, channelId, messageId]);
            
            return result.rows[0].id;
        } finally {
            client.release();
        }
    }

    async getProductMessages(productId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM product_messages WHERE product_id = $1', [productId]);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async deleteProductMessage(productId, messageId) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('DELETE FROM product_messages WHERE product_id = $1 AND message_id = $2', [productId, messageId]);
            return result.rowCount;
        } finally {
            client.release();
        }
    }

    // Fechar conexão
    async close() {
        if (this.pool) {
            await this.pool.end();
            console.log('✅ Conexão PostgreSQL fechada');
        }
    }
}

module.exports = PostgresDatabase;
