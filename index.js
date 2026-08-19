require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

client.once("ready", () => {
  console.log("✅ Bot is ready and running perfectly!");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith("!play")) return;

  let channel = message.member?.voice?.channel;
  if (!channel) {
    channel = message.guild.channels.cache.find(ch => ch.type === 2);
  }

  if (!channel) return message.reply("❌ هیچ ڤۆیس چەنڵێک نەدۆزرایەوە.");

  const args = message.content.split(" ");
  const url = args[1];

  if (!url || !url.startsWith("http")) {
    return message.reply("❌ تکایە فەرمانەکە بەم شێوەیە بنووسە: `!play [لینک]`");
  }

  const replyMsg = await message.reply("🎵 خەریکە گۆرانییەکە دەست پێدەکات...");

  try {
    const connection = joinVoiceChannel({ 
      channelId: channel.id, 
      guildId: channel.guild.id, 
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    const stream = ytdl(url, { quality: 'highestaudio', agent: undefined });
    const resource = createAudioResource(stream);
    const player = createAudioPlayer();
    
    player.play(resource);
    connection.subscribe(player);

    player.once(AudioPlayerStatus.Idle, () => {
      try { connection.destroy(); } catch {}
    });

    await replyMsg.edit(`🎵 ئێستا گۆرانییەکە لە ڤۆیسی (**${channel.name}**) لێدەدرێت!`);
  } catch (err) {
    console.error("LOG ERROR:", err);
    await replyMsg.edit(`❌ یوتیوب داواکارییەکەی ڕەتکردەوە. تکایە لینکێکی تر تاقی بکەرەوە.`);
  }
});

client.login(process.env.TOKEN);
