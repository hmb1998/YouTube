require("dotenv").config();
require("opusscript");

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  REST,
  Routes,
  PermissionsBitField
} = require("discord.js");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnectionStatus,
  entersState
} = require("@discordjs/voice");

const { spawn } = require("child_process");
const play = require("play-dl");

const TOKEN = process.env.TOKEN;
const YOUTUBE_COOKIE = process.env.YOUTUBE_COOKIE;

if (!TOKEN) {
  console.error("❌ TOKEN is missing in Railway Variables.");
  process.exit(1);
}

// چاککردنی دانانی کووکی بۆ play-dl
if (YOUTUBE_COOKIE) {
  try {
    if (typeof play.cookie?.set === "function") {
      play.cookie.set(YOUTUBE_COOKIE);
      console.log("🍪 YouTube Cookie loaded successfully via cookie.set!");
    } else if (typeof play.setCookies === "function") {
      play.setCookies(YOUTUBE_COOKIE);
      console.log("🍪 YouTube Cookie loaded successfully via setCookies!");
    }
  } catch (err) {
    console.error("⚠️ Failed to set YouTube cookie:", err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const guildPlayers = new Map();

function getYouTubeVideoId(input) {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      return url.pathname.slice(1).split("/")[0] || null;
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] || null;
      if (url.pathname.startsWith("/live/")) return url.pathname.split("/")[2] || null;
    }
  } catch {}

  return null;
}

function isYouTubeUrl(input) {
  try {
    const url = new URL(input);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com");
  } catch {
    return false;
  }
}

function stopGuild(guildId) {
  const current = guildPlayers.get(guildId);
  if (!current) return;

  try { current.player.stop(); } catch {}
  try { current.ffmpeg?.kill("SIGKILL"); } catch {}
  try { current.connection.destroy(); } catch {}
  guildPlayers.delete(guildId);
}

async function playYouTube(interaction, voiceChannel, link) {
  const guildId = interaction.guild.id;

  const me = interaction.guild.members.me;
  const perms = voiceChannel.permissionsFor(me);

  if (!perms?.has(PermissionsBitField.Flags.ViewChannel)) throw new Error("BOT_NO_VIEW_CHANNEL");
  if (!perms?.has(PermissionsBitField.Flags.Connect)) throw new Error("BOT_NO_CONNECT");
  if (!perms?.has(PermissionsBitField.Flags.Speak)) throw new Error("BOT_NO_SPEAK");

  if (me?.voice?.channelId && me.voice.channelId !== voiceChannel.id) {
    throw new Error("BOT_IN_OTHER_VOICE");
  }

  stopGuild(guildId);

  const streamData = await play.stream(link);
  const info = await play.video_basic_info(link);
  const videoDetails = info.video_details;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play }
  });

  const ffmpegPath = require("ffmpeg-static");
  const ffmpeg = spawn(ffmpegPath, [
    "-hide_banner",
    "-loglevel", "error",
    "-i", "pipe:0",
    "-vn",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "pipe:1"
  ], { stdio: ["pipe", "pipe", "pipe"] });

  streamData.stream.pipe(ffmpeg.stdin);

  const resource = createAudioResource(ffmpeg.stdout, {
    inputType: StreamType.Raw,
    inlineVolume: false
  });

  player.play(resource);
  connection.subscribe(player);

  const state = { player, connection, ffmpeg };
  guildPlayers.set(guildId, state);

  ffmpeg.stderr.on("data", data => {
    const text = data.toString().trim();
    if (text) console.error("FFmpeg:", text);
  });

  ffmpeg.on("error", error => {
    console.error("❌ FFmpeg error:", error);
  });

  ffmpeg.on("close", code => {
    if (code !== 0) console.error(`❌ FFmpeg exited with code ${code}`);
  });

  player.once(AudioPlayerStatus.Idle, () => {
    if (guildPlayers.get(guildId)?.player === player) {
      try { connection.destroy(); } catch {}
      guildPlayers.delete(guildId);
    }
  });

  player.on("error", error => {
    console.error("❌ Discord audio player error:", error);
    if (guildPlayers.get(guildId)?.player === player) {
      try { ffmpeg.kill("SIGKILL"); } catch {}
      try { connection.destroy(); } catch {}
      guildPlayers.delete(guildId);
    }
  });

  return {
    title: videoDetails.title || "YouTube",
    thumbnail: videoDetails.thumbnails?.[0]?.url || null
  };
}

const youtubeCommand = new SlashCommandBuilder()
  .setName("youtube")
  .setDescription("Play a YouTube song in your voice channel")
  .addStringOption(option =>
    option
      .setName("link")
      .setDescription("YouTube song/video link")
      .setRequired(true)
  );

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const command = youtubeCommand.toJSON();

  console.log(`🔧 Found ${client.guilds.cache.size} server(s). Registering /youtube...`);

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: [command] }
      );
      console.log(`✅ /youtube registered in: ${guild.name} (${guild.id})`);
    } catch (error) {
      console.error(`❌ Failed to register /youtube in ${guild.name}:`, error);
    }
  }

  console.log("🎵 YouTube music bot is ready!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "youtube") return;

  const link = interaction.options.getString("link", true).trim();
  const videoId = getYouTubeVideoId(link);

  if (!isYouTubeUrl(link) || !videoId) {
    return interaction.reply({
      content: "❌ تکایە لینکی دروستی YouTube بنێرە، وەک: https://www.youtube.com/watch?v=...",
      ephemeral: true
    });
  }

  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.reply({
      content: "❌ سەرەتا بچۆ ناو Voice Channel، پاشان /youtube بەکاربهێنە.",
      ephemeral: true
    });
  }

  await interaction.deferReply();

  try {
    const data = await playYouTube(interaction, voiceChannel, link);

    const embed = new EmbedBuilder()
      .setTitle("🎵 ئێستا دەخوێنرێت")
      .setDescription(`**${data.title}**`)
      .addFields({ name: "🔗 لینک", value: `[YouTube](${link})` })
      .setTimestamp();

    if (data.thumbnail) embed.setThumbnail(data.thumbnail);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("❌ Playback error:", error);

    let message = "❌ نەتوانرا گۆرانییەکە پەخش بکرێت.";
    if (error.message === "BOT_NO_VIEW_CHANNEL") message = "❌ بۆتەکە Permission ـی View Channel نییە.";
    else if (error.message === "BOT_NO_CONNECT") message = "❌ بۆتەکە Permission ـی Connect نییە لە Voice Channel ـەکە.";
    else if (error.message === "BOT_NO_SPEAK") message = "❌ بۆتەکە Permission ـی Speak نییە لە Voice Channel ـەکە.";
    else if (error.message === "BOT_IN_OTHER_VOICE") message = "❌ بۆتەکە لە Voice Channel ـێکی ترە.";
    else message = "❌ کێشەیەک ڕوویدا لە هێنانی دەنگی یوتیوب.";

    await interaction.editReply({ content: message });
  }
});

process.on("SIGINT", () => {
  for (const guildId of guildPlayers.keys()) stopGuild(guildId);
  process.exit(0);
});

process.on("SIGTERM", () => {
  for (const guildId of guildPlayers.keys()) stopGuild(guildId);
  process.exit(0);
});

client.login(TOKEN);
