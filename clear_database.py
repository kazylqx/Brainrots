#!/usr/bin/env python3
"""
Script para limpar COMPLETAMENTE o banco de dados Supabase
⚠️ CUIDADO: Isso vai apagar TODOS os dados!
"""

import os
from supabase import create_client
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

def clear_all_tables():
    # Conectar ao Supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Configure SUPABASE_URL e SUPABASE_ANON_KEY no .env")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Lista de tabelas para limpar (na ordem correta devido às foreign keys)
    tables = [
        'cart_items',      # Primeiro os itens do carrinho
        'carts',           # Depois os carrinhos
        'sales',           # Vendas
        'messages',        # Mensagens
        'products'         # Por último os produtos
    ]
    
    print("🗑️ Limpando banco de dados...")
    print("=" * 50)
    
    total_deleted = 0
    
    for table in tables:
        try:
            # Contar registros antes
            count_response = supabase.table(table).select('id', count='exact').execute()
            count = len(count_response.data) if count_response.data else 0
            
            if count > 0:
                print(f"📊 {table}: {count} registros")
                
                # Deletar todos os registros
                delete_response = supabase.table(table).delete().neq('id', 0).execute()
                
                print(f"✅ {table}: {count} registros removidos")
                total_deleted += count
            else:
                print(f"✅ {table}: já vazia")
                
        except Exception as e:
            print(f"❌ Erro ao limpar {table}: {e}")
    
    print("=" * 50)
    print(f"🧹 Limpeza concluída!")
    print(f"   Total de registros removidos: {total_deleted}")
    print("   Banco de dados completamente limpo!")

def clear_specific_table(table_name):
    # Conectar ao Supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Configure SUPABASE_URL e SUPABASE_ANON_KEY no .env")
        return
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Se for produtos, limpar dependências primeiro
    if table_name == 'products':
        print("🔗 Limpando dependências dos produtos primeiro...")
        
        # Limpar cart_items que referenciam produtos
        try:
            cart_items_response = supabase.table('cart_items').select('id', count='exact').execute()
            cart_items_count = len(cart_items_response.data) if cart_items_response.data else 0
            
            if cart_items_count > 0:
                print(f"📊 cart_items: {cart_items_count} registros")
                supabase.table('cart_items').delete().neq('id', 0).execute()
                print(f"✅ cart_items: {cart_items_count} registros removidos")
        except Exception as e:
            print(f"❌ Erro ao limpar cart_items: {e}")
    
    try:
        # Contar registros
        count_response = supabase.table(table_name).select('id', count='exact').execute()
        count = len(count_response.data) if count_response.data else 0
        
        if count > 0:
            print(f"📊 {table_name}: {count} registros encontrados")
            
            # Deletar todos
            supabase.table(table_name).delete().neq('id', 0).execute()
            
            print(f"✅ {table_name}: {count} registros removidos")
        else:
            print(f"✅ {table_name}: já está vazia")
            
    except Exception as e:
        print(f"❌ Erro ao limpar {table_name}: {e}")

if __name__ == '__main__':
    print("💀 LIMPADOR DE BANCO DE DADOS")
    print("=" * 50)
    print("⚠️  ATENÇÃO: Isso vai apagar TODOS os dados!")
    print("⚠️  Esta ação é IRREVERSÍVEL!")
    print("=" * 50)
    
    print("\nOpções:")
    print("1. Limpar TUDO (todas as tabelas)")
    print("2. Limpar apenas produtos")
    print("3. Limpar apenas carrinhos")
    print("4. Limpar apenas vendas")
    print("5. Limpar apenas mensagens")
    print("0. Cancelar")
    
    choice = input("\nEscolha uma opção (0-5): ").strip()
    
    if choice == '0':
        print("❌ Operação cancelada")
        exit()
    
    # Confirmação final
    confirm = input(f"\n⚠️ TEM CERTEZA? Digite 'APAGAR TUDO' para confirmar: ")
    
    if confirm != 'APAGAR TUDO':
        print("❌ Confirmação incorreta. Operação cancelada.")
        exit()
    
    if choice == '1':
        clear_all_tables()
    elif choice == '2':
        clear_specific_table('products')
    elif choice == '3':
        clear_specific_table('carts')
        clear_specific_table('cart_items')
    elif choice == '4':
        clear_specific_table('sales')
    elif choice == '5':
        clear_specific_table('messages')
    else:
        print("❌ Opção inválida")
