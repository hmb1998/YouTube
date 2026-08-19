require("dotenv").config();
require("opusscript");

const fs = require("node:fs");
const path = require("node:path");

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

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("❌ TOKEN is missing.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

const guildPlayers = new Map();

async function playLocalMusic(interaction, voiceChannel) {
  const guildId = interaction.guild.id;

  if (guildPlayers.has(guildId)) {
    const current = guildPlayers.get(guildId);
    try { current.player.stop(); current.connection.destroy(); } catch {}
  }

  // دیاریکردنی ڕێڕەوی فایلی دەنگیی ناوخۆیی
  const filePath = path.join(__dirname, "music", "song.mp3");

  if (!fs.existsSync(filePath)) {
    throw new Error("LOCAL_FILE_NOT_FOUND");
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guildId,
    adapterCreator: interaction.guild.voiceAdapterCreator,
    selfDeaf: true
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

  const player = createAudioPlayer();
  const resource = createAudioResource(filePath, {
    inputType: StreamType.Arbitrary
  });

  player.play(resource);
  connection.subscribe(player);

  guildPlayers.set(guildId, { player, connection });

  player.once(AudioPlayerStatus.Idle, () => {
    try { connection.destroy(); } catch {}
    guildPlayers.delete(guildId);
  });

  player.on("error", error => {
    console.error("❌ Audio player error:", error);
    try { connection.destroy(); } catch {}
    guildPlayers.delete(guildId);
  });

  return { title: "song.mp3" };
}

client.once("ready", async () => {
  console.log("✅ Local Music Bot is ready and 100% stable!");
  
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  const command = new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play local music file in voice channel");

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [command.toJSON()] });
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "play") return;
  
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: "❌ سەرەتا بچۆ ناو ڤۆیس چەنڵ.", ephemeral: true });
  }

  await interaction.deferReply();
  try {
    const song = await playLocalMusic(interaction, voiceChannel);
    await interaction.editReply({ 
      embeds: [new EmbedBuilder().setTitle("🎵 ئێستا لێدەدرێت (Local)").setDescription(`فایلی: **${song.title}**`)] 
    });
  } catch (e) {
    console.error(e);
    if (e.message === "LOCAL_FILE_NOT_FOUND") {
      await interaction.editReply({ content: "❌ فایلی `song.mp3` نەدۆزراوەتەوە لە فۆڵدەری `music`!" });
    } else {
      await interaction.editReply({ content: "❌ کێشەیەک ڕوویدا لە لێدانی فایلی دەنگییەکە." });
    }
  }
});

client.login(TOKEN);
