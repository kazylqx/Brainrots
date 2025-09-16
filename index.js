require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const Database = require('./utils/database');

// Criar instância do
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Coleções para comandos e eventos
client.commands = new Collection();

// Inicializar banco de dados
Database.init();

// Carregar comandos
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Comando carregado: ${command.data.name}`);
        } else {
            console.log(`⚠️ Comando em ${filePath} está faltando "data" ou "execute"`);
        }
    }
}

// Carregar eventos
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`✅ Evento carregado: ${event.name}`);
    }
}

// Registrar comandos slash
async function deployCommands() {
    const commands = [];
    
    if (fs.existsSync(commandsPath)) {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            if (command.data) {
                commands.push(command.data.toJSON());
            }
        }
    }
    
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);
    
    try {
        console.log(`🔄 Registrando ${commands.length} comandos slash...`);
        
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands }
        );
        
        console.log(`✅ ${data.length} comandos slash registrados com sucesso!`);
    } catch (error) {
        console.error('❌ Erro ao registrar comandos:', error);
    }
}

// Evento quando o bot fica online
client.once('ready', async () => {
    console.log(`🤖 ${client.user.tag} está online!`);
    console.log(`📊 Conectado em ${client.guilds.cache.size} servidor(es)`);
    
    // Registrar comandos
    await deployCommands();
    
    // Definir status do bot
    client.user.setActivity('🛒 Vendas | /painel', { type: 'WATCHING' });
});

// Handler para interações (comandos slash, botões, etc) - removido para evitar duplicação

// Handler para erros não capturados
process.on('unhandledRejection', error => {
    console.error('❌ Erro não tratado:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Exceção não capturada:', error);
    process.exit(1);
});

// Fazer login no Discord
client.login(process.env.DISCORD_TOKEN);
