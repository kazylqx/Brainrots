require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');
const Database = require('./utils/database');

// Criar instância do Discord client
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

// Criar servidor Express para health check (necessário para Render)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    const memUsage = process.memoryUsage();
    res.json({ 
        status: 'online', 
        bot: client.user?.tag || 'Initializing...',
        uptime: process.uptime(),
        memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
        },
        guilds: client.guilds?.cache.size || 0,
        ping: client.ws.ping || 0,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    const isHealthy = client.isReady() && client.ws.ping < 1000;
    res.status(isHealthy ? 200 : 503).json({ 
        status: isHealthy ? 'healthy' : 'unhealthy', 
        uptime: process.uptime(),
        ping: client.ws.ping || 0,
        ready: client.isReady()
    });
});

app.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

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
    
    // Inicializar banco de dados
    Database.init();
    
    // Registrar comandos
    await deployCommands();
    
    // Definir status do bot
    client.user.setActivity('🛒 Vendas | /painel', { type: 'WATCHING' });
    
    // Monitoramento de memória a cada 5 minutos
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        
        console.log(`📊 Memória: ${memUsedMB}MB | Ping: ${client.ws.ping}ms | Uptime: ${Math.round(process.uptime() / 60)}min`);
        
        // Limpeza de cache a cada 15 minutos
        if (process.uptime() % (15 * 60) < 300) { // A cada 15min ±5min
            console.log('🧹 Limpando caches...');
            
            // Limpar cache de canais antigos
            client.channels.cache.sweep(channel => !channel.guild);
            
            // Limpar cache de usuários antigos (manter apenas os necessários)
            client.users.cache.sweep(user => user.id !== client.user.id);
            
            // Forçar garbage collection se disponível
            if (global.gc) {
                global.gc();
                console.log('🗑️ Garbage collection executado');
            }
        }
        
        // Alerta se memória muito alta (>400MB)
        if (memUsedMB > 400) {
            console.warn(`⚠️ ALERTA: Uso de memória alto: ${memUsedMB}MB`);
            
            // Limpeza agressiva
            client.channels.cache.clear();
            client.users.cache.clear();
            
            if (global.gc) {
                global.gc();
            }
        }
        
        // Auto-restart se memória crítica (>500MB)
        if (memUsedMB > 500) {
            console.error(`🚨 CRÍTICO: Memória muito alta (${memUsedMB}MB), reiniciando...`);
            process.exit(1);
        }
    }, 5 * 60 * 1000); // 5 minutos
    
    // Keep-alive para manter conexões ativas
    setInterval(async () => {
        try {
            // Ping simples no banco para manter conexão ativa
            const Database = require('./utils/database');
            await Database.getProducts(); // Operação leve para manter conexão
            
            // Verificar se ainda temos acesso aos canais
            const guild = client.guilds.cache.first();
            if (guild) {
                guild.channels.cache.size; // Acesso simples ao cache
            }
            
        } catch (error) {
            console.warn('⚠️ Erro no keep-alive:', error.message);
        }
    }, 2 * 60 * 1000); // A cada 2 minutos
    
    // Auto-restart preventivo a cada 2 horas
    setTimeout(() => {
        console.log('🔄 Auto-restart preventivo após 2 horas de funcionamento');
        process.exit(0);
    }, 2 * 60 * 60 * 1000); // 2 horas
});

// Handler para erros não capturados
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promise rejeitada não tratada:', reason);
    console.error('Promise:', promise);
});

process.on('uncaughtException', error => {
    console.error('❌ Exceção não capturada:', error);
    console.error('Stack:', error.stack);
    
    // Tentar fazer cleanup antes de sair
    try {
        if (client.isReady()) {
            client.destroy();
        }
    } catch (cleanupError) {
        console.error('❌ Erro no cleanup:', cleanupError);
    }
    
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM recebido, fazendo shutdown graceful...');
    
    try {
        if (client.isReady()) {
            client.destroy();
        }
    } catch (error) {
        console.error('❌ Erro no shutdown:', error);
    }
    
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📴 SIGINT recebido, fazendo shutdown graceful...');
    
    try {
        if (client.isReady()) {
            client.destroy();
        }
    } catch (error) {
        console.error('❌ Erro no shutdown:', error);
    }
    
    process.exit(0);
});

// Monitorar event loop lag
let lastCheck = Date.now();
const lagInterval = setInterval(() => {
    const now = Date.now();
    const lag = now - lastCheck - 1000; // Esperado: 1000ms
    lastCheck = now;
    
    if (lag > 100) {
        console.warn(`⚠️ Event loop lag: ${lag}ms`);
        
        // Se lag muito alto, forçar limpeza
        if (lag > 500) {
            console.error(`🚨 Event loop crítico (${lag}ms), limpando recursos...`);
            
            // Limpeza agressiva
            if (client.channels) client.channels.cache.clear();
            if (client.users) client.users.cache.clear();
            if (client.guilds) {
                client.guilds.cache.forEach(guild => {
                    if (guild.members) guild.members.cache.clear();
                    if (guild.channels) guild.channels.cache.clear();
                });
            }
            
            if (global.gc) {
                global.gc();
                console.log('🗑️ Garbage collection forçado por lag');
            }
        }
    }
}, 1000);

// Heartbeat mais robusto
let heartbeatFailures = 0;
const heartbeatInterval = setInterval(() => {
    try {
        const isReady = client.isReady();
        const ping = client.ws.ping;
        
        if (!isReady || ping > 2000 || ping === -1) {
            heartbeatFailures++;
            console.error(`💔 Bot não responsivo (${heartbeatFailures}/3) - Ping: ${ping}ms, Ready: ${isReady}`);
            
            // Após 3 falhas consecutivas, reiniciar
            if (heartbeatFailures >= 3) {
                console.error('🚨 CRÍTICO: Bot não responsivo por muito tempo, reiniciando...');
                process.exit(1);
            }
        } else {
            // Reset contador se tudo ok
            if (heartbeatFailures > 0) {
                console.log(`✅ Bot recuperou responsividade`);
                heartbeatFailures = 0;
            }
        }
    } catch (error) {
        console.error('❌ Erro no heartbeat:', error);
        heartbeatFailures++;
    }
}, 30 * 1000); // A cada 30 segundos

// Monitorar conexão WebSocket
client.on('shardDisconnect', (event, id) => {
    console.warn(`🔌 Shard ${id} desconectado:`, event);
});

client.on('shardReconnecting', (id) => {
    console.log(`🔄 Shard ${id} reconectando...`);
});

client.on('shardResume', (id, replayedEvents) => {
    console.log(`✅ Shard ${id} reconectado (${replayedEvents} eventos)`);
});

client.on('error', (error) => {
    console.error('❌ Erro do cliente Discord:', error);
});

client.on('warn', (warning) => {
    console.warn('⚠️ Aviso do Discord:', warning);
});

// Fazer login no Discord
client.login(process.env.DISCORD_TOKEN);
