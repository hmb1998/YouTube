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
  console.error("❌ TOKEN is missing in Railway Variables.");
  process.exit(1);
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

async function playSoundCloud(interaction, voiceChannel, link) {
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

  // پشکنین و وەرگرتنی ستریمی ساوندکلۆد
  const scData = await playdl.soundcloud(link);
  const stream = await playdl.stream_soundcloud(link);

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

  const resource = createAudioResource(stream.stream, {
    inputType: stream.type,
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
    title: scData.name || "SoundCloud Track",
    thumbnail: scData.thumbnail || null
  };
}

const soundcloudCommand = new SlashCommandBuilder()
  .setName("play")
  .setDescription("Play a SoundCloud song in your voice channel")
  .addStringOption(option =>
    option
      .setName("link")
      .setDescription("SoundCloud track link")
      .setRequired(true)
  );

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const command = soundcloudCommand.toJSON();

  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: [command] }
      );
    } catch (error) {
      console.error(`❌ Failed to register /play in ${guild.name}:`, error);
    }
  }

  console.log("🎵 SoundCloud music bot is ready!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "play") return;

  const link = interaction.options.getString("link", true).trim();

  if (!link.includes("soundcloud.com")) {
    return interaction.reply({
      content: "❌ تکایە لینکی دروستی SoundCloud بنێرە.",
      ephemeral: true
    });
  }

  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.reply({
      content: "❌ سەرەتا بچۆ ناو Voice Channel، پاشان /play بەکاربهێنە.",
      ephemeral: true
    });
  }

  await interaction.deferReply();

  try {
    const data = await playSoundCloud(interaction, voiceChannel, link);

    const embed = new EmbedBuilder()
      .setTitle("🎵 ئێستا دەخوێنرێت (SoundCloud)")
      .setDescription(`**${data.title}**`)
      .addFields({ name: "🔗 لینک", value: `[SoundCloud](${link})` })
      .setTimestamp();

    if (data.thumbnail) embed.setThumbnail(data.thumbnail);
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("❌ Playback error:", error);
    await interaction.editReply({ content: "❌ کێشەیەک ڕوویدا لە پەخشکردنی گۆرانییەکە." });
  }
});

client.login(TOKEN);
