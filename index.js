require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const { DisTube } = require("distube");
const { YtDlpPlugin } = require("@distube/yt-dlp");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const distube = new DisTube(client, {
  leaveOnStop: true,
  emitNewSongOnly: true,
  plugins: [new YtDlpPlugin()],
});

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const command = new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from YouTube")
    .addStringOption(opt => opt.setName("url").setDescription("YouTube URL or Song name").setRequired(true));

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [command.toJSON()] });
  }
  console.log("✅ Bot is ready with DisTube!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "play") return;
  
  const channel = interaction.member?.voice?.channel;
  if (!channel) return interaction.reply({ content: "❌ تکایە سەرەتا بچۆ ناو ڤۆیس چەنڵ.", ephemeral: true });

  const query = interaction.options.getString("url");
  await interaction.deferReply();

  try {
    await distube.play(channel, query, {
      textChannel: interaction.channel,
      member: interaction.member,
      text: interaction,
    });
    await interaction.editReply(`🎵 داواکارییەکەت جێبەجێ دەکرێت بۆ: ${query}`);
  } catch (err) {
    console.error(err);
    await interaction.editReply("❌ هەڵەیەک ڕوویدا لە لێدانی ئەم گۆرانییە.");
  }
});

distube.on("playSong", (queue, song) => {
  queue.textChannel?.send(`🎶 ئێستا دەستی پێکرد: **${song.name}**`);
});

client.login(process.env.TOKEN);
