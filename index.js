require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { DisTube } = require("distube");
const { SpotifyPlugin } = require("@distube/spotify");
const { YtDlpPlugin } = require("@distube/yt-dlp");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const distube = new DisTube(client, {
  leaveOnStop: true,
  emitNewSongOnly: true,
  plugins: [new SpotifyPlugin(), new YtDlpPlugin()],
});

client.once("ready", () => {
  console.log("✅ Bot is online and ready to play music!");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith("!")) return;
  
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) return message.reply("❌ تکایە بچۆ ناو ڤۆیس چەنڵ.");
    
    const song = args.join(" ");
    if (!song) return message.reply("❌ تکایە ناوی گۆرانی یان لینکی یوتیوب بنووسە.");
    
    distube.play(voiceChannel, song, {
      member: message.member,
      textChannel: message.channel,
      message,
    });
  }
});

distube.on("playSong", (queue, song) =>
  queue.textChannel.send(`🎵 ئێستا ئەم گۆرانییە لێدەدرێت: ${song.name}`)
);

client.login(process.env.TOKEN);
