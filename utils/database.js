const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const SupabaseDatabase = require('./supabase');

class Database {
    constructor() {
        this.db = null;
        this.supabase = null;
        this.useSupabase = false;
    }

    // Inicializar banco de dados
    async init() {
        // Tentar Supabase primeiro (para produção)
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            try {
                this.supabase = new SupabaseDatabase();
                const connected = await this.supabase.init();
                if (connected) {
                    this.useSupabase = true;
                    console.log('✅ Usando Supabase para persistência');
                    return;
                }
            } catch (error) {
                console.log('⚠️ Falha ao conectar Supabase, usando SQLite local');
            }
        }

        // Fallback para SQLite local
        const dbPath = path.join(__dirname, '..', 'database.sqlite');
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ Erro ao conectar com o banco de dados:', err.message);
            } else {
                console.log('✅ Conectado ao banco de dados SQLite');
                this.createTables();
            }
        });
    }

    // Criar tabelas necessárias
    createTables() {
        // Tabela de produtos
        this.db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                stock INTEGER DEFAULT 0,
                image_url TEXT,
                banner_url TEXT,
                role_id TEXT,
                role_days INTEGER DEFAULT 0,
                channel_id TEXT,
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de cupons
        this.db.run(`
            CREATE TABLE IF NOT EXISTS coupons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE NOT NULL,
                discount_type TEXT NOT NULL, -- 'percentage' ou 'fixed'
                discount_value REAL NOT NULL,
                max_uses INTEGER DEFAULT -1, -- -1 = ilimitado
                current_uses INTEGER DEFAULT 0,
                active BOOLEAN DEFAULT 1,
                expires_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de pedidos
        this.db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                amount REAL NOT NULL,
                status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'completed', 'cancelled', 'expired'
                payment_method TEXT DEFAULT 'pix',
                payment_data TEXT, -- JSON com dados do pagamento
                expires_at DATETIME,
                paid_at DATETIME,
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `);

        // Tabela de carrinhos
        this.db.run(`
            CREATE TABLE IF NOT EXISTS carts (
                id TEXT PRIMARY KEY, -- UUID
                user_id TEXT NOT NULL,
                channel_id TEXT,
                status TEXT DEFAULT 'active', -- 'active', 'completed', 'expired'
                coupon_code TEXT,
                total_amount REAL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME
            )
        `);

        // Tabela de itens do carrinho
        this.db.run(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cart_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                unit_price REAL NOT NULL,
                FOREIGN KEY (cart_id) REFERENCES carts (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `);

        // Tabela de vendas
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sales (
                id TEXT PRIMARY KEY, -- UUID
                cart_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                total_amount REAL NOT NULL,
                coupon_code TEXT,
                payment_status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
                payment_data TEXT, -- JSON com dados do pagamento
                pix_code TEXT,
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cart_id) REFERENCES carts (id)
            )
        `);

        // Tabela de configurações
        this.db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de atribuições de cargos temporários
        this.db.run(`
            CREATE TABLE IF NOT EXISTS role_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                role_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                expires_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de tickets
        this.db.run(`
            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                sale_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                status TEXT DEFAULT 'open', -- 'open', 'completed', 'closed'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME,
                FOREIGN KEY (sale_id) REFERENCES sales (id)
            )
        `);

        // Tabela de mensagens de produtos (para atualizar embeds)
        this.db.run(`
            CREATE TABLE IF NOT EXISTS product_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                channel_id TEXT NOT NULL,
                message_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `);

        console.log('✅ Tabelas do banco de dados criadas/verificadas');
    }

    // Métodos para produtos
    async createProduct(productData) {
        if (this.useSupabase) {
            return await this.supabase.createProduct(productData);
        }
        
        return new Promise((resolve, reject) => {
            const { name, description, price, stock, image_url, banner_url, role_id, role_days, channel_id } = productData;
            
            this.db.run(`
                INSERT INTO products (name, description, price, stock, image_url, banner_url, role_id, role_days, channel_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [name, description, price, stock, image_url, banner_url, role_id, role_days, channel_id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getProducts(activeOnly = true) {
        if (this.useSupabase) {
            return await this.supabase.getProducts(activeOnly);
        }
        
        return new Promise((resolve, reject) => {
            const query = activeOnly ? 
                'SELECT * FROM products WHERE active = 1 ORDER BY created_at DESC' :
                'SELECT * FROM products ORDER BY created_at DESC';
            
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getProduct(id) {
        if (this.useSupabase) {
            return await this.supabase.getProduct(id);
        }
        
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM products WHERE id = ?', [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async deleteProduct(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async updateProduct(id, productData) {
        return new Promise((resolve, reject) => {
            const { name, description, price, stock, image_url, banner_url, role_id, role_days } = productData;
            
            this.db.run(`
                UPDATE products 
                SET name = ?, description = ?, price = ?, stock = ?, image_url = ?, banner_url = ?, role_id = ?, role_days = ?
                WHERE id = ?
            `, [name, description, price, stock, image_url, banner_url, role_id, role_days, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async deleteProduct(id) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE products SET active = 0 WHERE id = ?', [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async updateStock(id, newStock) {
        if (this.useSupabase) {
            return await this.supabase.updateStock(id, newStock);
        }
        
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Métodos para cupons
    async createCoupon(couponData) {
        return new Promise((resolve, reject) => {
            const { code, discount_type, discount_value, max_uses, expires_at } = couponData;
            
            this.db.run(`
                INSERT INTO coupons (code, discount_type, discount_value, max_uses, expires_at)
                VALUES (?, ?, ?, ?, ?)
            `, [code, discount_type, discount_value, max_uses, expires_at], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getCoupon(code) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM coupons 
                WHERE code = ? AND active = 1 
                AND (expires_at IS NULL OR expires_at > datetime('now'))
                AND (max_uses = -1 OR current_uses < max_uses)
            `, [code], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async useCoupon(code) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE coupons SET current_uses = current_uses + 1 WHERE code = ?', [code], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Métodos para pedidos
    async createOrder(orderData) {
        return new Promise((resolve, reject) => {
            const { id, user_id, username, product_id, product_name, amount, expires_at } = orderData;
            
            this.db.run(`
                INSERT INTO orders (id, user_id, username, product_id, product_name, amount, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [id, user_id, username, product_id, product_name, amount, expires_at], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(id);
                }
            });
        });
    }

    async getOrder(orderId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updateOrderStatus(orderId, status, paymentData = null) {
        return new Promise((resolve, reject) => {
            const now = new Date().toISOString();
            let query = 'UPDATE orders SET status = ?';
            let params = [status];

            if (status === 'paid') {
                query += ', paid_at = ?, payment_data = ?';
                params.push(now, paymentData);
            } else if (status === 'completed') {
                query += ', completed_at = ?';
                params.push(now);
            }

            query += ' WHERE id = ?';
            params.push(orderId);

            this.db.run(query, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getOrdersByUser(userId, limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM orders 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [userId, limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Métodos para carrinho
    async createCart(cartData) {
        return new Promise((resolve, reject) => {
            const { id, user_id, channel_id, expires_at } = cartData;
            
            this.db.run(`
                INSERT INTO carts (id, user_id, channel_id, expires_at)
                VALUES (?, ?, ?, ?)
            `, [id, user_id, channel_id, expires_at], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(id);
                }
            });
        });
    }

    async getCart(cartId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM carts WHERE id = ?', [cartId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getCartByUser(userId) {
        return new Promise((resolve, reject) => {
            this.db.get(`
                SELECT * FROM carts 
                WHERE user_id = ? AND status = 'active'
                ORDER BY created_at DESC LIMIT 1
            `, [userId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async addCartItem(cartId, productId, quantity, unitPrice) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO cart_items (cart_id, product_id, quantity, unit_price)
                VALUES (?, ?, ?, ?)
            `, [cartId, productId, quantity, unitPrice], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getCartItems(cartId) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT ci.*, p.name, p.description, p.image_url, p.role_id, p.role_days
                FROM cart_items ci
                JOIN products p ON ci.product_id = p.id
                WHERE ci.cart_id = ?
            `, [cartId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateCartTotal(cartId, totalAmount) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE carts SET total_amount = ? WHERE id = ?', [totalAmount, cartId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async updateCartStatus(cartId, status) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE carts SET status = ? WHERE id = ?', [status, cartId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Métodos para vendas
    async createSale(saleData) {
        return new Promise((resolve, reject) => {
            const { id, cart_id, user_id, username, total_amount, coupon_code, pix_code } = saleData;
            
            this.db.run(`
                INSERT INTO sales (id, cart_id, user_id, username, total_amount, coupon_code, pix_code)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [id, cart_id, user_id, username, total_amount, coupon_code, pix_code], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(id);
                }
            });
        });
    }

    async completeSale(saleId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE sales 
                SET payment_status = 'completed', completed_at = datetime('now')
                WHERE id = ?
            `, [saleId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getSales(limit = 50) {
        return new Promise((resolve, reject) => {
            this.db.all(`
                SELECT * FROM sales 
                ORDER BY created_at DESC 
                LIMIT ?
            `, [limit], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async getSaleById(saleId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM sales WHERE id = ?', [saleId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updateSaleStatus(saleId, status) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE sales SET status = ? WHERE id = ?', [status, saleId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async updateProductStock(productId, newStock) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, productId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async decreaseProductStock(productId, quantity) {
        return new Promise((resolve, reject) => {
            this.db.run('UPDATE products SET stock = stock - ? WHERE id = ?', [quantity, productId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Métodos para mensagens de produtos
    async saveProductMessage(productId, channelId, messageId) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT INTO product_messages (product_id, channel_id, message_id)
                VALUES (?, ?, ?)
            `, [productId, channelId, messageId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    async getProductMessages(productId) {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM product_messages WHERE product_id = ?', [productId], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async deleteProductMessage(productId, messageId) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM product_messages WHERE product_id = ? AND message_id = ?', [productId, messageId], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    // Métodos para configurações
    async setSetting(key, value) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                INSERT OR REPLACE INTO settings (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
            `, [key, value], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    async getSetting(key) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT value FROM settings WHERE key = ?', [key], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? row.value : null);
                }
            });
        });
    }

    // Fechar conexão
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('❌ Erro ao fechar banco de dados:', err.message);
                } else {
                    console.log('✅ Conexão com banco de dados fechada');
                }
            });
        }
    }
}

module.exports = new Database();
