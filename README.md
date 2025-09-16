# 🤖 DoubeBot - Discord Sales Bot

Bot completo para vendas no Discord com sistema de carrinho, PIX e painel administrativo.

## 🚀 Funcionalidades

### 📦 Sistema de Vendas
- ✅ Catálogo de produtos com embeds bonitos
- 🛒 Carrinho de compras individual
- 💳 Pagamento via PIX (QR Code + Copia e Cola)
- 🎟️ Sistema de cupons de desconto
- 📊 Logs detalhados de vendas

### ⚙️ Painel Administrativo
- ➕ Adicionar produtos
- ✏️ Editar produtos existentes
- ❌ Excluir produtos
- 📦 Gerenciar estoque
- 📈 Visualizar vendas e histórico
- 🔧 Configurações do bot

### 🔐 Segurança
- 🛡️ Acesso restrito ao cargo "DONO"
- 🔒 Canais de carrinho privados
- 🆔 IDs únicos para pedidos (UUID)
- ⏰ Expiração automática de carrinhos

## 📋 Instalação

1. **Clone o repositório**
```bash
git clone <repository-url>
cd doubebot
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o arquivo .env**
```bash
cp .env.example .env
```
Edite o arquivo `.env` com suas configurações:
- `DISCORD_TOKEN`: Token do seu bot Discord
- `CLIENT_ID`: ID da aplicação Discord
- `GUILD_ID`: ID do seu servidor Discord
- `PIX_KEY`: Sua chave PIX
- `PIX_NAME`: Nome do recebedor
- `PIX_CITY`: Cidade do recebedor

4. **Execute o bot**
```bash
npm start
```

## 🏗️ Estrutura do Projeto

```
doubebot/
├── index.js              # Arquivo principal
├── commands/             # Comandos slash
├── events/               # Eventos do Discord
├── utils/                # Funções auxiliares
├── database.sqlite       # Banco de dados
├── package.json          # Dependências
└── .env                  # Configurações
```

## 🎯 Como Usar

### Para Administradores (Cargo DONO)
1. Use `/painel` para acessar o painel administrativo
2. Adicione produtos através do painel
3. Configure as categorias e canais necessários
4. Monitore as vendas através dos logs

### Para Clientes
1. Reaja aos embeds de produtos para iniciar uma compra
2. Use os botões para adicionar ao carrinho
3. Finalize a compra no canal privado criado
4. Pague via PIX usando o QR Code ou Copia e Cola

## 🛠️ Tecnologias Utilizadas

- **Node.js** - Runtime JavaScript
- **discord.js v14** - Biblioteca para Discord
- **SQLite3** - Banco de dados local
- **QRCode** - Geração de QR Codes PIX
- **UUID** - Geração de IDs únicos

## 📞 Suporte

Para suporte, entre em contato através do Discord ou abra uma issue no repositório.

---
Desenvolvido com ❤️ para facilitar vendas no Discord
