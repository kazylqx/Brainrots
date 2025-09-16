-- Script para corrigir diferenças no schema do Supabase
-- Execute no SQL Editor do Supabase Dashboard

-- 1. Adicionar campo products_data na tabela sales
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS products_data jsonb;

-- 2. Atualizar constraint de payment_status para incluir 'cancelled'
ALTER TABLE public.sales 
DROP CONSTRAINT IF EXISTS sales_payment_status_check;

ALTER TABLE public.sales 
ADD CONSTRAINT sales_payment_status_check 
CHECK (payment_status IN ('pending', 'completed', 'failed', 'cancelled'));

-- 3. Atualizar constraint de status nos carts para incluir 'cancelled'
ALTER TABLE public.carts 
DROP CONSTRAINT IF EXISTS carts_status_check;

ALTER TABLE public.carts 
ADD CONSTRAINT carts_status_check 
CHECK (status IN ('active', 'completed', 'expired', 'cancelled'));

-- 4. Criar tabela settings se não existir
CREATE TABLE IF NOT EXISTS public.settings (
    key text PRIMARY KEY,
    value text NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

-- 5. Criar tabela role_assignments se não existir
CREATE TABLE IF NOT EXISTS public.role_assignments (
    id integer NOT NULL DEFAULT nextval('role_assignments_id_seq'::regclass),
    user_id text NOT NULL,
    role_id text NOT NULL,
    guild_id text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT role_assignments_pkey PRIMARY KEY (id)
);

-- 6. Criar tabela tickets se não existir
CREATE TABLE IF NOT EXISTS public.tickets (
    id text NOT NULL,
    sale_id text NOT NULL,
    user_id text NOT NULL,
    channel_id text NOT NULL,
    status text DEFAULT 'open'::text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamp without time zone,
    CONSTRAINT tickets_pkey PRIMARY KEY (id),
    CONSTRAINT tickets_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id)
);

-- 7. Adicionar índices para performance
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_products_channel ON public.products(channel_id);
CREATE INDEX IF NOT EXISTS idx_carts_user ON public.carts(user_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON public.carts(status);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_status ON public.sales(payment_status);
CREATE INDEX IF NOT EXISTS idx_role_assignments_user ON public.role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_expires ON public.role_assignments(expires_at);
CREATE INDEX IF NOT EXISTS idx_tickets_sale ON public.tickets(sale_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_product_messages_product ON public.product_messages(product_id);

-- 8. Criar sequences se não existirem
CREATE SEQUENCE IF NOT EXISTS public.role_assignments_id_seq;
ALTER SEQUENCE public.role_assignments_id_seq OWNED BY public.role_assignments.id;
