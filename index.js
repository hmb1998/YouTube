const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioResource, createAudioPlayer, StreamType } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const http = require('http');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] 
});

client.once('ready', () => console.log('✅ Bot is ready!'));

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!play')) return;

    const url = message.content.split(' ')[1];
    if (!url || !ytdl.validateURL(url)) return message.reply('❌ لینکەکە هەڵەیە!');

    const channel = message.member?.voice?.channel;
    if (!channel) return message.reply('❌ سەرەتا بچۆ ناو ڤۆیس!');

    const player = createAudioPlayer();
    const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
    connection.subscribe(player);

    try {
        const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio', highWaterMark: 1 << 25 });
        const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
        player.play(resource);
        message.reply('🎵 گۆرانییەکە دەستی پێکرد!');
    } catch (e) {
        console.error(e);
        message.reply('❌ کێشەیەک ڕوویدا لە لێدانی گۆرانییەکە.');
    }
});

// سێرڤەری وێب بۆ ئەوەی Fly.io بۆتەکەت نەوەستێنێت
http.createServer((req, res) => res.end('OK')).listen(process.env.PORT || 8080);

client.login(process.env.TOKEN);
