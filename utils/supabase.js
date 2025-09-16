const { createClient } = require('@supabase/supabase-js');

class SupabaseDatabase {
    constructor() {
        this.supabase = null;
    }

    // Inicializar conexão Supabase
    async init() {
        try {
            const supabaseUrl = process.env.SUPABASE_URL;
            const supabaseKey = process.env.SUPABASE_ANON_KEY;
            
            if (!supabaseUrl || !supabaseKey) {
                console.log('⚠️ SUPABASE_URL ou SUPABASE_ANON_KEY não encontradas');
                return false;
            }

            this.supabase = createClient(supabaseUrl, supabaseKey);
            
            // Testar conexão
            const { data, error } = await this.supabase.from('products').select('count').limit(1);
            if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist (normal)
                throw error;
            }

            console.log('✅ Conectado ao Supabase');
            await this.createTables();
            return true;

        } catch (error) {
            console.error('❌ Erro ao conectar com Supabase:', error.message);
            return false;
        }
    }

    // Criar tabelas no Supabase (via SQL)
    async createTables() {
        try {
            // Executar SQL para criar tabelas
            const { error } = await this.supabase.rpc('create_bot_tables');
            
            if (error && !error.message.includes('already exists')) {
                console.log('⚠️ Tabelas podem não existir ainda. Execute o SQL manualmente no Supabase Dashboard.');
            }

            console.log('✅ Tabelas Supabase verificadas');

        } catch (error) {
            console.log('⚠️ Execute o SQL de criação das tabelas manualmente no Supabase Dashboard');
        }
    }

    // Métodos para produtos
    async createProduct(productData) {
        const { name, description, price, stock, image_url, banner_url, role_id, role_days, channel_id } = productData;
        
        const { data, error } = await this.supabase
            .from('products')
            .insert([{
                name,
                description,
                price,
                stock,
                image_url,
                banner_url,
                role_id,
                role_days: role_days || 0,
                channel_id,
                active: true
            }])
            .select()
            .single();

        if (error) throw error;
        return data.id;
    }

    async getProducts(activeOnly = true) {
        let query = this.supabase.from('products').select('*');
        
        if (activeOnly) {
            query = query.eq('active', true);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    }

    async getProduct(id) {
        const { data, error } = await this.supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    // Alias para compatibilidade
    async getProductById(id) {
        return await this.getProduct(id);
    }

    async updateProduct(id, productData) {
        const { name, description, price, stock, image_url, banner_url, role_id, role_days } = productData;
        
        const { data, error } = await this.supabase
            .from('products')
            .update({
                name,
                description,
                price,
                stock,
                image_url,
                banner_url,
                role_id,
                role_days
            })
            .eq('id', id);

        if (error) throw error;
        return 1; // Simular rowCount
    }

    async deleteProduct(id) {
        const { data, error } = await this.supabase
            .from('products')
            .update({ active: false })
            .eq('id', id);

        if (error) throw error;
        return 1;
    }

    async updateStock(id, newStock) {
        const { data, error } = await this.supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', id);

        if (error) throw error;
        return 1;
    }

    // Métodos para carrinho
    async createCart(cartData) {
        const { id, user_id, channel_id, expires_at } = cartData;
        
        const { data, error } = await this.supabase
            .from('carts')
            .insert([{
                id,
                user_id,
                channel_id,
                expires_at,
                status: 'active',
                total_amount: 0
            }]);

        if (error) throw error;
        return id;
    }

    async getCart(cartId) {
        const { data, error } = await this.supabase
            .from('carts')
            .select('*')
            .eq('id', cartId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async getCartByUser(userId) {
        const { data, error } = await this.supabase
            .from('carts')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async addCartItem(cartId, productId, quantity, unitPrice) {
        const { data, error } = await this.supabase
            .from('cart_items')
            .insert([{
                cart_id: cartId,
                product_id: productId,
                quantity,
                unit_price: unitPrice
            }])
            .select()
            .single();

        if (error) throw error;
        return data.id;
    }

    async getCartItems(cartId) {
        const { data, error } = await this.supabase
            .from('cart_items')
            .select(`
                *,
                products (
                    name,
                    description,
                    image_url,
                    role_id,
                    role_days
                )
            `)
            .eq('cart_id', cartId);

        if (error) throw error;
        
        // Transformar para compatibilidade com SQLite
        return (data || []).map(item => ({
            ...item,
            name: item.products?.name,
            description: item.products?.description,
            image_url: item.products?.image_url,
            role_id: item.products?.role_id,
            role_days: item.products?.role_days
        }));
    }

    async updateCartTotal(cartId, totalAmount) {
        const { data, error } = await this.supabase
            .from('carts')
            .update({ total_amount: totalAmount })
            .eq('id', cartId);

        if (error) throw error;
        return 1;
    }

    async updateCartStatus(cartId, status) {
        const { data, error } = await this.supabase
            .from('carts')
            .update({ status })
            .eq('id', cartId);

        if (error) throw error;
        return 1;
    }

    // Métodos para vendas
    async createSale(saleData) {
        const { id, cart_id, user_id, username, total_amount, coupon_code, pix_code } = saleData;
        
        const { data, error } = await this.supabase
            .from('sales')
            .insert([{
                id,
                cart_id,
                user_id,
                username,
                total_amount,
                coupon_code,
                pix_code,
                payment_status: 'pending'
            }]);

        if (error) throw error;
        return id;
    }

    async getSaleById(saleId) {
        const { data, error } = await this.supabase
            .from('sales')
            .select('*')
            .eq('id', saleId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    async updateSaleStatus(saleId, status) {
        const { data, error } = await this.supabase
            .from('sales')
            .update({ payment_status: status })
            .eq('id', saleId);

        if (error) throw error;
        return 1;
    }

    async completeSale(saleId) {
        const { data, error } = await this.supabase
            .from('sales')
            .update({ 
                payment_status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', saleId);

        if (error) throw error;
        return 1;
    }

    async getSales(limit = 50) {
        const { data, error } = await this.supabase
            .from('sales')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    }

    // Métodos para mensagens de produtos
    async saveProductMessage(productId, channelId, messageId) {
        const { data, error } = await this.supabase
            .from('product_messages')
            .insert([{
                product_id: productId,
                channel_id: channelId,
                message_id: messageId
            }])
            .select()
            .single();

        if (error) throw error;
        return data.id;
    }

    async getProductMessages(productId) {
        const { data, error } = await this.supabase
            .from('product_messages')
            .select('*')
            .eq('product_id', productId);

        if (error) throw error;
        return data || [];
    }

    async deleteProductMessage(productId, messageId) {
        const { data, error } = await this.supabase
            .from('product_messages')
            .delete()
            .eq('product_id', productId)
            .eq('message_id', messageId);

        if (error) throw error;
        return 1;
    }
}

module.exports = SupabaseDatabase;
