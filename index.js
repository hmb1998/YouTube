require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const play = require("play-dl");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const command = new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from YouTube")
    .addStringOption(opt => opt.setName("song").setDescription("YouTube URL").setRequired(true));

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [command.toJSON()] });
  }
  console.log("✅ Bot is ready!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "play") return;
  
  const channel = interaction.member?.voice?.channel;
  if (!channel) return interaction.reply({ content: "❌ تکایە سەرەتا بچۆ ناو ڤۆیس چەنڵ.", ephemeral: true });

  const url = interaction.options.getString("song");
  if (!url) return interaction.reply({ content: "❌ تکایە لینک بنووسە.", ephemeral: true });

  await interaction.deferReply();

  try {
    const stream = await play.stream(url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

    const connection = joinVoiceChannel({ 
      channelId: channel.id, 
      guildId: channel.guild.id, 
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true 
    });

    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    player.once(AudioPlayerStatus.Idle, () => {
      try { connection.destroy(); } catch {}
    });

    await interaction.editReply("🎵 گۆرانییەکە دەستی پێکرد!");
  } catch (err) {
    console.error("LOG ERROR:", err);
    await interaction.editReply(`❌ هەڵەیەک ڕوویدا: ${err.message || "نەتوانرا گۆرانییەکە لێبدرێت"}`);
  }
});

client.login(process.env.TOKEN);
