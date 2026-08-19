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
  console.log("✅ Bot is ready and running!");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith("!play")) return;

  const channel = message.member?.voice?.channel;
  if (!channel) return message.reply("❌ تکایە سەرەتا بچۆ ناو ڤۆیس چەنڵ.");

  const args = message.content.split(" ");
  const url = args[1];
  if (!url) return message.reply("❌ تکایە لینکی یوتیوب دوای !play بنووسە.");

  const replyMsg = await message.reply("🎵 خەریکە گۆرانییەکە دەنێردرێت...");

  try {
    const stream = await play.stream(url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

    const connection = joinVoiceChannel({ 
      channelId: channel.id, 
      guildId: channel.guild.id, 
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true 
    });

    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    player.once(AudioPlayerStatus.Idle, () => {
      try { connection.destroy(); } catch {}
    });

    await replyMsg.edit("🎵 ئێستا گۆرانییەکە دەستی پێکرد!");
  } catch (err) {
    console.error("LOG ERROR:", err);
    await replyMsg.edit(`❌ هەڵەیەک ڕوویدا: ${err.message || "نەتوانرا لێبدرێت"}`);
  }
});

client.login(process.env.TOKEN);
