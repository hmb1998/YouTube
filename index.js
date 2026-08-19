const { Client, GatewayIntentBits } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const { joinVoiceChannel, createAudioResource, createAudioPlayer } = require('@discordjs/voice');
const http = require('http');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildVoiceStates
    ] 
});

client.once('ready', () => {
    console.log('✅ Bot is ready and running perfectly!');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!play')) return;

    const args = message.content.split(' ');
    const url = args[1];

    if (!url) return message.reply('❌ تکایە لینکێکی یوتیوب بنێرە!');

    const channel = message.member?.voice?.channel;
    if (!channel) return message.reply('❌ تکایە سەرەتا بچۆ ناو چەنلێکی ڤۆیس!');

    const replyMsg = await message.reply('🎵 خەریکە گۆرانییەکە دەست پێدەکات...');

    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        const stream = ytdl(url, { filter: 'audioonly', highWaterMark: 1 << 25 });
        const resource = createAudioResource(stream);
        
        player.play(resource);
        await replyMsg.edit(`🎵 ئێستا گۆرانییەکە لێدەدرێت!`);
    } catch (error) {
        console.error("LOG ERROR:", error);
        await replyMsg.edit('❌ کێشەیەک ڕوویدا، دڵنیا ببەوە لەوەی لینکەکە ڕاستە.');
    }
});

// سێرڤەری وێب بۆ پۆرت 8080 تا Fly.io ڕیستارتی نەکاتەوە
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`HTTP Server is listening on port ${PORT}`);
});

client.login(process.env.TOKEN);
