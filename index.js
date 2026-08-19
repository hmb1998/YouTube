require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const play = require("play-dl");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once("ready", async () => {
  console.log("✅ Bot is ready!");
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const command = new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a YouTube link directly")
    .addStringOption(opt => opt.setName("link").setDescription("Direct YouTube URL").setRequired(true));

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [command.toJSON()] });
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "play") return;

  const channel = interaction.member?.voice?.channel;
  if (!channel) return interaction.reply({ content: "❌ سەرەتا بچۆ ناو ڤۆیس چەنڵ.", ephemeral: true });

  const url = interaction.options.getString("link");
  if (!url.includes("http")) {
    return interaction.reply({ content: "❌ تکایە لینکی ڕاستەوخۆی یوتیوب دابنە (ناوی گۆرانی مەنوسە).", ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const stream = await play.stream(url);

    const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
    const player = createAudioPlayer();
    
    player.play(createAudioResource(stream.stream, { inputType: stream.type }));
    connection.subscribe(player);

    player.once(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    await interaction.editReply(`🎵 ئێستا لێدەدرێت لە لینکەوە!`);
  } catch (err) {
    console.error(err);
    await interaction.editReply("❌ کێشەیەک ڕوویدا لە لێدانی لینکەکە.");
  }
});

client.login(process.env.TOKEN);
