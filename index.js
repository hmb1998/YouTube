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

const ytdl = require("@distube/ytdl-core");

const TOKEN = process.env.TOKEN;
const YOUTUBE_COOKIE = process.env.YOUTUBE_COOKIE;

if (!TOKEN) {
  console.error("❌ TOKEN is missing in Railway Variables.");
  process.exit(1);
}

// ڕێکخستنی کووکی بۆ ytdl-core
let agent = undefined;
if (YOUTUBE_COOKIE) {
  try {
    // دروستکردنی ئەکاونتی ئەگەینت بە کووکی
    agent = ytdl.createAgent(JSON.stringify([{
      domain: ".youtube.com",
      expirationDate: 1821419422,
      hostOnly: false,
      httpOnly: true,
      name: "__Secure-1PSID",
      path: "/",
      sameSite: "unspecified",
      secure: true,
      session: false,
      value: YOUTUBE_COOKIE.trim()
    }]));
    console.log("🍪 Agent with Cookie created successfully for ytdl-core!");
  } catch (err) {
    console.error("⚠️ Failed to create agent with cookie:", err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const guildPlayers = new Map();

function stopGuild(guildId) {
  const current = guildPlayers.get(guildId);
  if (!current) return;

  try { current.player.stop(); } catch {}
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

  // وەرگرتنی زانیاری ڤیدیۆ
  const songInfo = await ytdl.getInfo(link, agent ? { agent } : {});
  const videoDetails = songInfo.videoDetails;

  const stream = ytdl(link, {
    agent: agent,
    filter: "audioonly",
    quality: "highestaudio",
    highWaterMark: 1 << 25
  });

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

  const resource = createAudioResource(stream, {
    inputType: StreamType.Arbitrary,
    inlineVolume: false
  });

  player.play(resource);
  connection.subscribe(player);

  const state = { player, connection };
  guildPlayers.set(guildId, state);

  player.once(AudioPlayerStatus.Idle, () => {
    if (guildPlayers.get(guildId)?.player === player) {
      try { connection.destroy(); } catch {}
      guildPlayers.delete(guildId);
    }
  });

  player.on("error", error => {
    console.error("❌ Discord audio player error:", error);
    if (guildPlayers.get(guildId)?.player === player) {
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

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: [command] }
      );
    } catch (error) {
      console.error(`❌ Failed to register /youtube in ${guild.name}:`, error);
    }
  }

  console.log("🎵 YouTube music bot is ready with Distube ytdl-core!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "youtube") return;

  const link = interaction.options.getString("link", true).trim();

  if (!ytdl.validateURL(link)) {
    return interaction.reply({
      content: "❌ تکایە لینکی دروستی YouTube بنێرە.",
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
    await interaction.editReply({ content: "❌ کێشەیەک ڕوویدا لە پەخشکردنی گۆرانییەکە." });
  }
});

client.login(TOKEN);
