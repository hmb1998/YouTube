const { Client, GatewayIntentBits } = require('discord.js');
const ytdl = require('@distube/ytdl-core');
const { joinVoiceChannel, createAudioResource, createAudioPlayer } = require('@discordjs/voice');

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

        const cookieData = process.env.COOKIE;
        let agent = undefined;
        if (cookieData) {
            try {
                agent = ytdl.createAgent(JSON.parse(cookieData));
            } catch (e) {}
        }

        const stream = ytdl(url, { agent: agent, quality: 'highestaudio', filter: 'audioonly' });
        const resource = createAudioResource(stream);
        
        player.play(resource);
        await replyMsg.edit(`🎵 ئێستا گۆرانییەکە لێدەدرێت!`);
    } catch (error) {
        console.error("LOG ERROR:", error);
        await replyMsg.edit('❌ کێشەیەک ڕوویدا، دڵنیا ببەوە لەوەی لینکەکە ڕاستە.');
    }
});

client.login(process.env.TOKEN);
