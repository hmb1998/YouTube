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

  // دۆزینەوە و پاککردنەوەی لینکی یوتیوب
  const urlMatch = message.content.match(/https?:\/\/[^\s]+/);
  let rawUrl = urlMatch ? urlMatch[0] : null;

  if (!rawUrl) return message.reply("❌ تکایە لینکی یوتیوب بنووسە.");

  let url;
  try {
    // لابردنی پاشگری زیاتری لینک وەکو ?si=... بۆ ئەوەی هەڵە نەدات
    const parsedObj = new URL(rawUrl);
    if (parsedObj.hostname.includes("youtu.be")) {
      url = `https://www.youtube.com/watch?v=${parsedObj.pathname.slice(1)}`;
    } else {
      url = `https://www.youtube.com/watch?v=${parsedObj.searchParams.get("v")}`;
    }
  } catch {
    url = rawUrl; // ئەگەر هەر کێشەیەک هەبوو هەر خۆی بەکاردەهێنێت
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

    const stream = await play.stream(url);
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
    await replyMsg.edit(`❌ هەڵە لە لێدانی گۆرانی: ${err.message || "نەتوانرا ڤیدیۆیەکی پاک بدۆزرێتەوە"}`);
  }
});

client.login(process.env.TOKEN);
