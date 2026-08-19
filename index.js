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

  // هەوڵ دەدات ڤۆیس چەنڵی ئەو کەسە بدۆزێتەوە کە فەرمانەکەی لێداوە
  let channel = message.member?.voice?.channel;

  // ئەگەر خۆت لە ڤۆیس نەبوویت، دەچێتە یەکەم ڤۆیس چەنڵی بەردەست لە سێرڤەرەکەدا بە زۆر!
  if (!channel) {
    channel = message.guild.channels.cache.find(ch => ch.type === 2); // 2 = GuildVoice
  }

  if (!channel) return message.reply("❌ هیچ ڤۆیس چەنڵێک لەم سێرڤەرەدا نییە تا بۆتەکە بچێتە ناوი.");

  const urlMatch = message.content.match(/https?:\/\/[^\s]+/);
  const url = urlMatch ? urlMatch[0] : null;

  if (!url) return message.reply("❌ تکایە لینکی یوتیوب بنووسە دوای !play.");

  const replyMsg = await message.reply("🎵 خەریکە دەچێتە ناو ڤۆیس و گۆرانییەکە لێدەدات...");

  try {
    // پەیوەندیکردن بە ڤۆیس چەنڵەکە بە شێوەیەکی فەرمی و بەهێز
    const connection = joinVoiceChannel({ 
      channelId: channel.id, 
      guildId: channel.guild.id, 
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    const stream = await play.stream(url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    player.once(AudioPlayerStatus.Idle, () => {
      try { connection.destroy(); } catch {}
    });

    await replyMsg.edit(`🎵 ئێستا گۆرانییەکە لە ڤۆیسی (**${channel.name}**) دەستی پێکرد!`);
  } catch (err) {
    console.error("LOG ERROR:", err);
    await replyMsg.edit(`❌ هەڵەیەک ڕوویدا: ${err.message || "نەتوانرا لێبدرێت"}`);
  }
});

client.login(process.env.TOKEN);
