const { Client, GatewayIntentBits } = require('discord.js');
const play = require('play-dl');
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

        // پشکنین و هێنانی زانیاری گۆرانی بە شێوازێکی پارێزراو
        let streamData = await play.stream(url, { discordPlayerCompatibility: true });
        const resource = createAudioResource(streamData.stream, {
            inputType: streamData.type
        });
        
        player.play(resource);
        await replyMsg.edit(`🎵 ئێستا گۆرانییەکە لێدەدرێت!`);
    } catch (error) {
        console.error("LOG ERROR:", error);
        await replyMsg.edit('❌ کێشەیەک ڕوویدا، یوتیوب داوای پشکنینی بۆت دەکات یان لینکەکە هەڵەیە.');
    }
});

// سێرڤەری وێب بۆ پۆرت 8080 تا Fly.io هەمیشە بە زیندویی بهێڵێتەوە
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`HTTP Server is listening on port ${PORT}`);
});

client.login(process.env.TOKEN);
