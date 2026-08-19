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
const path = require("path");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN is missing in Railway Variables.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

let youtube;
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

async function getAudioStream(videoId) {
  const info = await youtube.getBasicInfo(videoId);
  const status = info.playability_status?.status;

  if (status && status !== "OK") {
    throw new Error(`YouTube playability status: ${status}`);
  }

  const formats = info.streaming_data?.formats || [];
  const adaptiveFormats = info.streaming_data?.adaptive_formats || [];
  const allFormats = [...formats, ...adaptiveFormats];

  let streamUrl = null;
  for (const fmt of allFormats) {
    if (fmt.url && (fmt.mime_type?.includes("audio") || fmt.type?.includes("audio"))) {
      streamUrl = fmt.url;
      break;
    }
  }

  // ئەگەر لینکی ڕاستەوخۆ نەدۆزرایەوە، با chooseFormat تاقی بکەینەوە بێ decipher
  if (!streamUrl) {
    const format = info.chooseFormat({ type: "audio", quality: "best" });
    if (format && typeof format.url === "string" && format.url.startsWith("http")) {
      streamUrl = format.url;
    }
  }

  if (!streamUrl) {
    throw new Error("No direct playable YouTube audio stream found.");
  }

  console.log("✅ YouTube audio stream obtained successfully");

  return {
    title: info.basic_info?.title || "YouTube",
    author: info.basic_info?.author || "",
    thumbnail: info.basic_info?.thumbnail?.[0]?.url || null,
    streamUrl
  };
}

function stopGuild(guildId) {
  const current = guildPlayers.get(guildId);
  if (!current) return;

  try { current.player.stop(); } catch {}
  try { current.ffmpeg?.kill("SIGKILL"); } catch {}
  try { current.connection.destroy(); } catch {}
  guildPlayers.delete(guildId);
}

async function playYouTube(interaction, voiceChannel, link, videoId) {
  const guildId = interaction.guild.id;

  const me = interaction.guild.members.me;
  const perms = voiceChannel.permissionsFor(me);

  if (!perms?.has(PermissionsBitField.Flags.ViewChannel)) {
    throw new Error("BOT_NO_VIEW_CHANNEL");
  }
  if (!perms?.has(PermissionsBitField.Flags.Connect)) {
    throw new Error("BOT_NO_CONNECT");
  }
  if (!perms?.has(PermissionsBitField.Flags.Speak)) {
    throw new Error("BOT_NO_SPEAK");
  }

  if (me?.voice?.channelId && me.voice.channelId !== voiceChannel.id) {
    throw new Error("BOT_IN_OTHER_VOICE");
  }

  stopGuild(guildId);

  const data = await getAudioStream(videoId);

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
    "-reconnect", "1",
    "-reconnect_streamed", "1",
    "-reconnect_delay_max", "5",
    "-i", data.streamUrl,
    "-vn",
    "-f", "s16le",
    "-ar", "48000",
    "-ac", "2",
    "pipe:1"
  ], { stdio: ["ignore", "pipe", "pipe"] });

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

  return data;
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

  try {
    const mod = await import("youtubei.js");
    youtube = await mod.Innertube.create({ generate_session_locally: true });
    console.log("✅ YouTube engine loaded");
  } catch (error) {
    console.error("❌ YouTube engine loading error:", error);
    process.exit(1);
  }

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
    const data = await playYouTube(interaction, voiceChannel, link, videoId);

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
    else if (/LOGIN_REQUIRED|AGE_RESTRICTED|UNPLAYABLE/i.test(error.message)) message = "❌ ئەم ڤیدیۆیە لەلایەن YouTube ـەوە بۆ playback بەردەست نییە. ڤیدیۆیەکی تری تاقی بکەرەوە.";

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
