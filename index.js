const { Client, GatewayIntentBits } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const { joinVoiceChannel, createAudioResource, createAudioPlayer, AudioPlayerStatus } = require('@discordjs/voice');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });

// لێرە کووکییەکەت لە سێکریتەوە وەردەگرێت
const agent = ytdl.createAgent(JSON.parse(process.env.COOKIE || "{}"));

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('!play')) {
        const args = message.content.split(' ');
        const url = args[1];

        if (!url) return message.reply('تکایە لینکێک بنێرە!');

        const channel = message.member.voice.channel;
        if (!channel) return message.reply('تکایە بچۆ ناو چەنلێکی ڤۆیس!');

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        connection.subscribe(player);

        try {
            // بەکارهێنانی کووکییەکە بۆ دابەزاندنی گۆرانییەکە
            const stream = ytdl(url, { agent, filter: 'audioonly' });
            const resource = createAudioResource(stream);
            player.play(resource);
            message.reply('گۆرانییەکە دەستی پێکرد!');
        } catch (error) {
            console.error(error);
            message.reply('کێشەیەک ڕوویدا لە لێدانی گۆرانییەکە.');
        }
    }
});

client.login(process.env.TOKEN);
