const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioResource, createAudioPlayer, StreamType } = require('@discordjs/voice');
const { spawn } = require('child_process');
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
    console.log('✅ Bot is ready and running with yt-dlp & path-fixed cookies!');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!play')) return;

    const args = message.content.split(' ');
    const url = args[1];

    if (!url) return message.reply('❌ تکایە لینکێکی یوتیوب بنێرە!');

    const channel = message.member?.voice?.channel;
    if (!channel) return message.reply('❌ سەرەتا بچۆ ناو چەنلێکی ڤۆیس!');

    const replyMsg = await message.reply('🎵 خەریکە گۆرانییەکە دەست پێدەکات...');

    try {
        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        // ئاماژەدان بە ڕێڕەوی تەواوی فایلەکە لەناو سێرڤەرەکەدا
        const ytProcess = spawn('yt-dlp', [
            '--cookies', '/app/cookies.txt',
            '-x',
            '--audio-format', 'opus',
            '-o', '-',
            url
        ]);

        const resource = createAudioResource(ytProcess.stdout, {
            inputType: StreamType.Opus
        });

        player.play(resource);
        await replyMsg.edit('🎵 ئێستا گۆرانییەکە لێدەدرێت!');

        ytProcess.stderr.on('data', (data) => {
            console.error(`yt-dlp error: ${data}`);
        });

    } catch (error) {
        console.error("LOG ERROR:", error);
        await replyMsg.edit('❌ کێشەیەک ڕووی دا لە لێدانی گۆرانییەکە.');
    }
});

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`HTTP Server is listening on port ${PORT}`);
});

client.login(process.env.TOKEN);
