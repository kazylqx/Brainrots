#!/usr/bin/env python3
"""
Product Manager for DoubeBot Supabase Database
Gerenciador de Produtos para o banco Supabase do DoubeBot

Este script permite gerenciar todos os produtos no banco Supabase:
- Listar produtos
- Adicionar novos produtos
- Editar produtos existentes
- Deletar produtos
- Operações em lote
- Exportar/Importar dados

Autor: Cascade AI
Data: 2025-01-16
"""

import os
import json
import csv
from datetime import datetime
from typing import List, Dict, Optional, Any
from supabase import create_client, Client
from dotenv import load_dotenv
import argparse
import sys

# Carregar variáveis de ambiente
load_dotenv()

class ProductManager:
    def __init__(self):
        """Inicializar conexão com Supabase"""
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("❌ SUPABASE_URL e SUPABASE_ANON_KEY devem estar configuradas no .env")
        
        try:
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
            print("✅ Conectado ao Supabase com sucesso!")
        except Exception as e:
            raise ConnectionError(f"❌ Erro ao conectar com Supabase: {e}")
    
    def list_products(self, active_only: bool = True, limit: int = None) -> List[Dict]:
        """Listar todos os produtos"""
        try:
            query = self.supabase.table('products').select('*')
            
            if active_only:
                query = query.eq('active', True)
            
            query = query.order('created_at', desc=True)
            
            if limit:
                query = query.limit(limit)
            
            response = query.execute()
            return response.data
        except Exception as e:
            print(f"❌ Erro ao listar produtos: {e}")
            return []
    
    def get_product(self, product_id: int) -> Optional[Dict]:
        """Buscar produto por ID"""
        try:
            response = self.supabase.table('products').select('*').eq('id', product_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"❌ Erro ao buscar produto {product_id}: {e}")
            return None
    
    def create_product(self, product_data: Dict) -> Optional[Dict]:
        """Criar novo produto"""
        try:
            # Validar dados obrigatórios
            required_fields = ['name', 'price']
            for field in required_fields:
                if field not in product_data:
                    raise ValueError(f"Campo obrigatório '{field}' não fornecido")
            
            # Definir valores padrão
            defaults = {
                'description': None,
                'stock': 0,
                'image_url': None,
                'banner_url': None,
                'role_id': None,
                'role_days': 0,
                'channel_id': None,
                'active': True
            }
            
            # Mesclar com valores padrão
            final_data = {**defaults, **product_data}
            
            response = self.supabase.table('products').insert(final_data).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"❌ Erro ao criar produto: {e}")
            return None
    
    def update_product(self, product_id: int, updates: Dict) -> bool:
        """Atualizar produto existente"""
        try:
            # Remover campos que não devem ser atualizados
            forbidden_fields = ['id', 'created_at']
            clean_updates = {k: v for k, v in updates.items() if k not in forbidden_fields}
            
            response = self.supabase.table('products').update(clean_updates).eq('id', product_id).execute()
            return len(response.data) > 0
        except Exception as e:
            print(f"❌ Erro ao atualizar produto {product_id}: {e}")
            return False
    
    def delete_product(self, product_id: int, soft_delete: bool = True) -> bool:
        """Deletar produto (soft delete por padrão)"""
        try:
            if soft_delete:
                # Soft delete - apenas marcar como inativo
                response = self.supabase.table('products').update({'active': False}).eq('id', product_id).execute()
            else:
                # Hard delete - remover completamente
                response = self.supabase.table('products').delete().eq('id', product_id).execute()
            
            return len(response.data) > 0
        except Exception as e:
            print(f"❌ Erro ao deletar produto {product_id}: {e}")
            return False
    
    def update_stock(self, product_id: int, new_stock: int) -> bool:
        """Atualizar estoque de um produto"""
        try:
            response = self.supabase.table('products').update({'stock': new_stock}).eq('id', product_id).execute()
            return len(response.data) > 0
        except Exception as e:
            print(f"❌ Erro ao atualizar estoque do produto {product_id}: {e}")
            return False
    
    def bulk_update_stock(self, stock_updates: Dict[int, int]) -> Dict[str, int]:
        """Atualizar estoque de múltiplos produtos"""
        results = {'success': 0, 'failed': 0}
        
        for product_id, new_stock in stock_updates.items():
            if self.update_stock(product_id, new_stock):
                results['success'] += 1
                print(f"✅ Produto {product_id}: estoque atualizado para {new_stock}")
            else:
                results['failed'] += 1
                print(f"❌ Produto {product_id}: falha ao atualizar estoque")
        
        return results
    
    def export_products(self, filename: str = None, format: str = 'json') -> str:
        """Exportar produtos para arquivo"""
        if not filename:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"products_export_{timestamp}.{format}"
        
        products = self.list_products(active_only=False)
        
        try:
            if format.lower() == 'json':
                with open(filename, 'w', encoding='utf-8') as f:
                    json.dump(products, f, indent=2, ensure_ascii=False, default=str)
            
            elif format.lower() == 'csv':
                if products:
                    with open(filename, 'w', newline='', encoding='utf-8') as f:
                        writer = csv.DictWriter(f, fieldnames=products[0].keys())
                        writer.writeheader()
                        writer.writerows(products)
            
            print(f"✅ {len(products)} produtos exportados para {filename}")
            return filename
        except Exception as e:
            print(f"❌ Erro ao exportar produtos: {e}")
            return ""
    
    def import_products(self, filename: str, format: str = 'json', update_existing: bool = False) -> Dict[str, int]:
        """Importar produtos de arquivo"""
        results = {'created': 0, 'updated': 0, 'failed': 0}
        
        try:
            if format.lower() == 'json':
                with open(filename, 'r', encoding='utf-8') as f:
                    products = json.load(f)
            
            elif format.lower() == 'csv':
                products = []
                with open(filename, 'r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    products = list(reader)
            
            for product_data in products:
                # Remover ID se existir (para criação)
                product_id = product_data.pop('id', None)
                
                if product_id and update_existing:
                    # Tentar atualizar produto existente
                    if self.update_product(product_id, product_data):
                        results['updated'] += 1
                        print(f"✅ Produto {product_id} atualizado")
                    else:
                        results['failed'] += 1
                        print(f"❌ Falha ao atualizar produto {product_id}")
                else:
                    # Criar novo produto
                    new_product = self.create_product(product_data)
                    if new_product:
                        results['created'] += 1
                        print(f"✅ Produto '{product_data.get('name')}' criado com ID {new_product['id']}")
                    else:
                        results['failed'] += 1
                        print(f"❌ Falha ao criar produto '{product_data.get('name')}'")
            
            return results
        except Exception as e:
            print(f"❌ Erro ao importar produtos: {e}")
            return results
    
    def search_products(self, query: str, field: str = 'name') -> List[Dict]:
        """Buscar produtos por texto"""
        try:
            response = self.supabase.table('products').select('*').ilike(field, f'%{query}%').execute()
            return response.data
        except Exception as e:
            print(f"❌ Erro ao buscar produtos: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Obter estatísticas dos produtos"""
        try:
            all_products = self.list_products(active_only=False)
            active_products = [p for p in all_products if p.get('active', True)]
            
            total_stock = sum(p.get('stock', 0) for p in active_products)
            total_value = sum(p.get('price', 0) * p.get('stock', 0) for p in active_products)
            
            out_of_stock = len([p for p in active_products if p.get('stock', 0) == 0])
            
            return {
                'total_products': len(all_products),
                'active_products': len(active_products),
                'inactive_products': len(all_products) - len(active_products),
                'total_stock': total_stock,
                'total_inventory_value': total_value,
                'out_of_stock_count': out_of_stock,
                'average_price': sum(p.get('price', 0) for p in active_products) / len(active_products) if active_products else 0
            }
        except Exception as e:
            print(f"❌ Erro ao obter estatísticas: {e}")
            return {}
    
    def find_duplicates(self) -> Dict[str, List[Dict]]:
        """Encontrar produtos duplicados baseado no nome e preço"""
        try:
            all_products = self.list_products(active_only=False)
            duplicates = {}
            
            for product in all_products:
                # Criar chave única baseada no nome e preço
                key = f"{product['name'].strip().lower()}_{product['price']}"
                
                if key not in duplicates:
                    duplicates[key] = []
                duplicates[key].append(product)
            
            # Filtrar apenas grupos com mais de 1 produto
            return {k: v for k, v in duplicates.items() if len(v) > 1}
        except Exception as e:
            print(f"❌ Erro ao encontrar duplicatas: {e}")
            return {}
    
    def remove_duplicates(self, keep_strategy: str = 'newest', dry_run: bool = True) -> Dict[str, int]:
        """
        Remover produtos duplicados
        
        Args:
            keep_strategy: 'newest' (manter o mais recente), 'oldest' (manter o mais antigo), 'highest_id' (maior ID)
            dry_run: Se True, apenas simula a remoção sem executar
        """
        results = {'kept': 0, 'removed': 0, 'failed': 0}
        
        try:
            duplicates = self.find_duplicates()
            
            if not duplicates:
                print("✅ Nenhuma duplicata encontrada!")
                return results
            
            print(f"🔍 Encontradas {len(duplicates)} grupos de produtos duplicados")
            
            for key, products in duplicates.items():
                print(f"\n📦 Grupo: {products[0]['name']} (R$ {products[0]['price']:.2f})")
                print(f"   Duplicatas encontradas: {len(products)}")
                
                # Ordenar produtos baseado na estratégia
                if keep_strategy == 'newest':
                    products.sort(key=lambda x: x['created_at'], reverse=True)
                elif keep_strategy == 'oldest':
                    products.sort(key=lambda x: x['created_at'])
                elif keep_strategy == 'highest_id':
                    products.sort(key=lambda x: x['id'], reverse=True)
                
                # Manter o primeiro da lista ordenada
                keep_product = products[0]
                remove_products = products[1:]
                
                print(f"   ✅ Mantendo: ID {keep_product['id']} (criado em {keep_product['created_at'][:10]})")
                
                for product in remove_products:
                    print(f"   🗑️ Removendo: ID {product['id']} (criado em {product['created_at'][:10]})")
                    
                    if not dry_run:
                        if self.delete_product(product['id'], soft_delete=False):
                            results['removed'] += 1
                        else:
                            results['failed'] += 1
                            print(f"      ❌ Falha ao remover ID {product['id']}")
                    else:
                        results['removed'] += 1
                
                results['kept'] += 1
            
            if dry_run:
                print(f"\n🔍 SIMULAÇÃO CONCLUÍDA:")
                print(f"   - Produtos que seriam mantidos: {results['kept']}")
                print(f"   - Produtos que seriam removidos: {results['removed']}")
                print(f"\n⚠️ Para executar a remoção real, use: --execute")
            else:
                print(f"\n✅ DESDUPLICAÇÃO CONCLUÍDA:")
                print(f"   - Produtos mantidos: {results['kept']}")
                print(f"   - Produtos removidos: {results['removed']}")
                print(f"   - Falhas: {results['failed']}")
            
            return results
        except Exception as e:
            print(f"❌ Erro durante desduplicação: {e}")
            return results
    
    def merge_duplicate_stock(self, dry_run: bool = True) -> Dict[str, int]:
        """
        Mesclar estoque de produtos duplicados antes de remover duplicatas
        """
        results = {'merged': 0, 'failed': 0}
        
        try:
            duplicates = self.find_duplicates()
            
            if not duplicates:
                print("✅ Nenhuma duplicata encontrada para mesclar!")
                return results
            
            for key, products in duplicates.items():
                # Calcular estoque total
                total_stock = sum(p.get('stock', 0) for p in products)
                
                # Encontrar produto mais recente para manter
                newest_product = max(products, key=lambda x: x['created_at'])
                
                print(f"📦 {newest_product['name']}: mesclando estoque de {len(products)} duplicatas")
                print(f"   Estoque total: {total_stock} unidades")
                
                if not dry_run and total_stock != newest_product.get('stock', 0):
                    if self.update_stock(newest_product['id'], total_stock):
                        results['merged'] += 1
                        print(f"   ✅ Estoque atualizado para {total_stock}")
                    else:
                        results['failed'] += 1
                        print(f"   ❌ Falha ao atualizar estoque")
                else:
                    results['merged'] += 1
            
            return results
        except Exception as e:
            print(f"❌ Erro ao mesclar estoque: {e}")
            return results

def print_product_table(products: List[Dict]):
    """Imprimir produtos em formato de tabela"""
    if not products:
        print("📦 Nenhum produto encontrado")
        return
    
    print(f"\n📦 {len(products)} produto(s) encontrado(s):")
    print("-" * 120)
    print(f"{'ID':<5} {'Nome':<30} {'Preço':<12} {'Estoque':<8} {'Ativo':<6} {'Criado':<12}")
    print("-" * 120)
    
    for product in products:
        created = datetime.fromisoformat(product['created_at'].replace('Z', '+00:00')).strftime('%d/%m/%Y')
        active_status = "✅" if product.get('active', True) else "❌"
        
        print(f"{product['id']:<5} {product['name'][:29]:<30} R$ {product['price']:<8.2f} {product.get('stock', 0):<8} {active_status:<6} {created:<12}")

def print_stats(stats: Dict[str, Any]):
    """Imprimir estatísticas"""
    print("\n📊 ESTATÍSTICAS DOS PRODUTOS")
    print("=" * 50)
    print(f"📦 Total de produtos: {stats.get('total_products', 0)}")
    print(f"✅ Produtos ativos: {stats.get('active_products', 0)}")
    print(f"❌ Produtos inativos: {stats.get('inactive_products', 0)}")
    print(f"📊 Estoque total: {stats.get('total_stock', 0)} unidades")
    print(f"💰 Valor do inventário: R$ {stats.get('total_inventory_value', 0):.2f}")
    print(f"🚫 Produtos sem estoque: {stats.get('out_of_stock_count', 0)}")
    print(f"💵 Preço médio: R$ {stats.get('average_price', 0):.2f}")

def main():
    """Função principal com interface de linha de comando"""
    parser = argparse.ArgumentParser(description='Gerenciador de Produtos Supabase')
    subparsers = parser.add_subparsers(dest='command', help='Comandos disponíveis')
    
    # Comando: listar
    list_parser = subparsers.add_parser('list', help='Listar produtos')
    list_parser.add_argument('--all', action='store_true', help='Incluir produtos inativos')
    list_parser.add_argument('--limit', type=int, help='Limitar número de resultados')
    
    # Comando: buscar
    search_parser = subparsers.add_parser('search', help='Buscar produtos')
    search_parser.add_argument('query', help='Texto para buscar')
    search_parser.add_argument('--field', default='name', help='Campo para buscar (padrão: name)')
    
    # Comando: criar
    create_parser = subparsers.add_parser('create', help='Criar produto')
    create_parser.add_argument('--name', required=True, help='Nome do produto')
    create_parser.add_argument('--price', type=float, required=True, help='Preço do produto')
    create_parser.add_argument('--description', help='Descrição do produto')
    create_parser.add_argument('--stock', type=int, default=0, help='Estoque inicial')
    create_parser.add_argument('--image-url', help='URL da imagem')
    
    # Comando: atualizar
    update_parser = subparsers.add_parser('update', help='Atualizar produto')
    update_parser.add_argument('id', type=int, help='ID do produto')
    update_parser.add_argument('--name', help='Novo nome')
    update_parser.add_argument('--price', type=float, help='Novo preço')
    update_parser.add_argument('--description', help='Nova descrição')
    update_parser.add_argument('--stock', type=int, help='Novo estoque')
    update_parser.add_argument('--image-url', help='Nova URL da imagem')
    update_parser.add_argument('--active', type=bool, help='Status ativo (true/false)')
    
    # Comando: deletar
    delete_parser = subparsers.add_parser('delete', help='Deletar produto')
    delete_parser.add_argument('id', type=int, help='ID do produto')
    delete_parser.add_argument('--hard', action='store_true', help='Deletar permanentemente')
    
    # Comando: estoque
    stock_parser = subparsers.add_parser('stock', help='Atualizar estoque')
    stock_parser.add_argument('id', type=int, help='ID do produto')
    stock_parser.add_argument('quantity', type=int, help='Nova quantidade')
    
    # Comando: exportar
    export_parser = subparsers.add_parser('export', help='Exportar produtos')
    export_parser.add_argument('--filename', help='Nome do arquivo')
    export_parser.add_argument('--format', choices=['json', 'csv'], default='json', help='Formato do arquivo')
    
    # Comando: importar
    import_parser = subparsers.add_parser('import', help='Importar produtos')
    import_parser.add_argument('filename', help='Arquivo para importar')
    import_parser.add_argument('--format', choices=['json', 'csv'], default='json', help='Formato do arquivo')
    import_parser.add_argument('--update', action='store_true', help='Atualizar produtos existentes')
    
    # Comando: estatísticas
    subparsers.add_parser('stats', help='Mostrar estatísticas')
    
    # Comando: duplicatas
    duplicates_parser = subparsers.add_parser('duplicates', help='Gerenciar produtos duplicados')
    duplicates_parser.add_argument('action', choices=['find', 'remove', 'merge'], help='Ação para duplicatas')
    duplicates_parser.add_argument('--strategy', choices=['newest', 'oldest', 'highest_id'], default='newest', help='Estratégia para manter produto')
    duplicates_parser.add_argument('--execute', action='store_true', help='Executar remoção (sem isso é apenas simulação)')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        pm = ProductManager()
        
        if args.command == 'list':
            products = pm.list_products(active_only=not args.all, limit=args.limit)
            print_product_table(products)
        
        elif args.command == 'search':
            products = pm.search_products(args.query, args.field)
            print_product_table(products)
        
        elif args.command == 'create':
            product_data = {
                'name': args.name,
                'price': args.price,
                'description': args.description,
                'stock': args.stock,
                'image_url': args.image_url
            }
            # Remover valores None
            product_data = {k: v for k, v in product_data.items() if v is not None}
            
            product = pm.create_product(product_data)
            if product:
                print(f"✅ Produto '{args.name}' criado com ID {product['id']}")
            else:
                print("❌ Falha ao criar produto")
        
        elif args.command == 'update':
            updates = {}
            if args.name: updates['name'] = args.name
            if args.price: updates['price'] = args.price
            if args.description: updates['description'] = args.description
            if args.stock is not None: updates['stock'] = args.stock
            if args.image_url: updates['image_url'] = args.image_url
            if args.active is not None: updates['active'] = args.active
            
            if pm.update_product(args.id, updates):
                print(f"✅ Produto {args.id} atualizado com sucesso")
            else:
                print(f"❌ Falha ao atualizar produto {args.id}")
        
        elif args.command == 'delete':
            if pm.delete_product(args.id, soft_delete=not args.hard):
                action = "removido permanentemente" if args.hard else "desativado"
                print(f"✅ Produto {args.id} {action} com sucesso")
            else:
                print(f"❌ Falha ao deletar produto {args.id}")
        
        elif args.command == 'stock':
            if pm.update_stock(args.id, args.quantity):
                print(f"✅ Estoque do produto {args.id} atualizado para {args.quantity}")
            else:
                print(f"❌ Falha ao atualizar estoque do produto {args.id}")
        
        elif args.command == 'export':
            filename = pm.export_products(args.filename, args.format)
            if filename:
                print(f"✅ Produtos exportados para {filename}")
        
        elif args.command == 'import':
            results = pm.import_products(args.filename, args.format, args.update)
            print(f"✅ Importação concluída:")
            print(f"   - Criados: {results['created']}")
            print(f"   - Atualizados: {results['updated']}")
            print(f"   - Falharam: {results['failed']}")
        
        elif args.command == 'stats':
            stats = pm.get_stats()
            print_stats(stats)
        
        elif args.command == 'duplicates':
            if args.action == 'find':
                duplicates = pm.find_duplicates()
                if duplicates:
                    print(f"🔍 Encontrados {len(duplicates)} grupos de produtos duplicados:")
                    for key, products in duplicates.items():
                        print(f"\n📦 {products[0]['name']} (R$ {products[0]['price']:.2f}) - {len(products)} duplicatas:")
                        for product in products:
                            print(f"   ID {product['id']} - Criado: {product['created_at'][:10]} - Estoque: {product.get('stock', 0)}")
                else:
                    print("✅ Nenhuma duplicata encontrada!")
            
            elif args.action == 'merge':
                results = pm.merge_duplicate_stock(dry_run=not args.execute)
                if not args.execute:
                    print("\n⚠️ SIMULAÇÃO - Use --execute para aplicar as mudanças")
            
            elif args.action == 'remove':
                results = pm.remove_duplicates(keep_strategy=args.strategy, dry_run=not args.execute)
                if not args.execute:
                    print("\n⚠️ SIMULAÇÃO - Use --execute para aplicar as mudanças")
    
    except Exception as e:
        print(f"❌ Erro: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
