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

const playdl = require("play-dl");

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN is missing.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const guildPlayers = new Map();

async function playSound(interaction, voiceChannel, link) {
  const guildId = interaction.guild.id;

  // پاککردنەوەی پێشو
  if (guildPlayers.has(guildId)) {
    const current = guildPlayers.get(guildId);
    try { current.player.stop(); current.connection.destroy(); } catch {}
  }

  // وەرگرتنی ستریم لە ڕێگەی play-dl
  let source = await playdl.search(link, { limit: 1, source: { soundcloud: "each" } });
  if (source.length === 0) throw new Error("NO_RESULTS");
  
  const song = source[0];
  const stream = await playdl.stream(song.url);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  const player = createAudioPlayer();
  const resource = createAudioResource(stream.stream, { inputType: stream.type });

  player.play(resource);
  connection.subscribe(player);

  guildPlayers.set(guildId, { player, connection });

  player.once(AudioPlayerStatus.Idle, () => {
    connection.destroy();
    guildPlayers.delete(guildId);
  });

  return { title: song.title, thumbnail: song.thumbnail?.url };
}

client.once("ready", async () => {
  console.log("✅ Bot is ready and stable!");
  
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const command = new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play from SoundCloud")
    .addStringOption(opt => opt.setName("link").setDescription("Song name or link").setRequired(true));

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [command.toJSON()] });
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "play") return;
  
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) return interaction.reply({ content: "❌ بچۆ ناو ڤۆیس چەنڵ.", ephemeral: true });

  await interaction.deferReply();
  try {
    const song = await playSound(interaction, voiceChannel, interaction.options.getString("link"));
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🎵 ئێستا لێدەدرێت").setDescription(song.title)] });
  } catch (e) {
    console.error(e);
    await interaction.editReply({ content: "❌ کێشەیەک ڕوویدا." });
  }
});

client.login(TOKEN);
