require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  REST,
  Routes
} = require("discord.js");

const { Player } = require("discord-player");
const { DefaultExtractors } = require("@discord-player/extractor");

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

const player = new Player(client);

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
    await player.extractors.loadMulti(DefaultExtractors);
    console.log("✅ Extractors loaded");
  } catch (error) {
    console.error("❌ Extractor loading error:", error);
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

  let url;
  try {
    url = new URL(link);
  } catch {
    return interaction.reply({
      content: "❌ تکایە لینکی دروستی YouTube بنێرە.",
      ephemeral: true
    });
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const isYouTube =
    host === "youtube.com" ||
    host === "youtu.be" ||
    host === "music.youtube.com" ||
    host.endsWith(".youtube.com");

  if (!isYouTube) {
    return interaction.reply({
      content: "❌ تەنها لینکی YouTube قبوڵە.",
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
    const result = await player.play(voiceChannel, link, {
      nodeOptions: {
        metadata: { channel: interaction.channel },
        leaveOnEnd: true,
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 30000,
        leaveOnStop: true
      }
    });

    const track = result.track;

    const embed = new EmbedBuilder()
      .setTitle("🎵 ئێستا دەخوێنرێت")
      .setDescription(`**${track.title}**`)
      .addFields({ name: "🔗 لینک", value: `[YouTube](${link})` })
      .setTimestamp();

    if (track.thumbnail) embed.setThumbnail(track.thumbnail);

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("❌ Playback error:", error);
    await interaction.editReply({
      content:
        "❌ نەتوانرا گۆرانییەکە پەخش بکرێت.\n" +
        "دڵنیابە لینکەکەی YouTube دروستە و بۆتەکە Permission ـی Connect و Speak ـی هەیە."
    });
  }
});

player.events.on("playerError", (queue, error) => {
  console.error("❌ Player error:", error);
});

player.events.on("error", (queue, error) => {
  console.error("❌ Queue error:", error);
});

client.login(TOKEN);
