#!/usr/bin/env python3
"""
Script simples para remover produtos duplicados do Supabase
"""

import os
from supabase import create_client
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

def remove_duplicates():
    # Conectar ao Supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Configure SUPABASE_URL e SUPABASE_ANON_KEY no .env")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Buscar todos os produtos
    response = supabase.table('products').select('*').order('created_at', desc=False).execute()
    products = response.data
    
    print(f"📦 Encontrados {len(products)} produtos no total")
    
    # Agrupar por nome e preço
    groups = {}
    for product in products:
        key = f"{product['name'].strip().lower()}_{product['price']}"
        if key not in groups:
            groups[key] = []
        groups[key].append(product)
    
    # Encontrar duplicatas
    duplicates = {k: v for k, v in groups.items() if len(v) > 1}
    
    if not duplicates:
        print("✅ Nenhuma duplicata encontrada!")
        return
    
    print(f"🔍 Encontrados {len(duplicates)} grupos de produtos duplicados")
    
    removed_count = 0
    
    for key, products_group in duplicates.items():
        print(f"\n📦 {products_group[0]['name']} (R$ {products_group[0]['price']:.2f})")
        print(f"   Duplicatas: {len(products_group)}")
        
        # Ordenar por data de criação (manter o mais recente)
        products_group.sort(key=lambda x: x['created_at'], reverse=True)
        
        # Manter o primeiro (mais recente)
        keep = products_group[0]
        remove_list = products_group[1:]
        
        print(f"   ✅ Mantendo: ID {keep['id']} (criado: {keep['created_at'][:10]})")
        
        # Somar estoque total
        total_stock = sum(p.get('stock', 0) for p in products_group)
        if total_stock != keep.get('stock', 0):
            print(f"   📊 Atualizando estoque: {keep.get('stock', 0)} → {total_stock}")
            supabase.table('products').update({'stock': total_stock}).eq('id', keep['id']).execute()
        
        # Remover duplicatas
        for product in remove_list:
            print(f"   🗑️ Removendo: ID {product['id']} (criado: {product['created_at'][:10]})")
            supabase.table('products').delete().eq('id', product['id']).execute()
            removed_count += 1
    
    print(f"\n✅ Desduplicação concluída!")
    print(f"   - Produtos removidos: {removed_count}")
    print(f"   - Grupos únicos mantidos: {len(duplicates)}")

if __name__ == '__main__':
    print("🧹 Removedor de Produtos Duplicados")
    print("=" * 40)
    
    confirm = input("⚠️ Isso vai REMOVER PERMANENTEMENTE as duplicatas. Continuar? (s/N): ")
    
    if confirm.lower() in ['s', 'sim', 'y', 'yes']:
        remove_duplicates()
    else:
        print("❌ Operação cancelada")
