require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const play = require("play-dl");

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

    // بەکارهێنانی سێتینگێکی تایبەت بۆ تێپەڕاندنی قەدەغەکردنی یوتیوب
    let stream;
    try {
      stream = await play.stream(url, { discordPlayerCompatibility: true });
    } catch {
      // ئەگەر سەرەتا نەبوو، بە ڕێگەی تش ئای پی تاقی دەکاتەوە
      const info = await play.video_info(url);
      stream = await play.stream_from_info(info, { discordPlayerCompatibility: true });
    }

    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    const player = createAudioPlayer();
    
    player.play(resource);
    connection.subscribe(player);

    player.once(AudioPlayerStatus.Idle, () => {
      try { connection.destroy(); } catch {}
    });

    await replyMsg.edit(`🎵 ئێستا گۆرانییەکە لە ڤۆیسی (**${channel.name}**) لێدەدرێت!`);
  } catch (err) {
    console.error("LOG ERROR:", err);
    await replyMsg.edit(`❌ یوتیوب ڕێگری لە سێرڤەرەکە کرد (Error 429). تکایە کەمێکی تر هەوڵ بدەوە.`);
  }
});

client.login(process.env.TOKEN);
