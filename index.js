require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const play = require("play-dl");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const command = new SlashCommandBuilder()
    .setName("radio")
    .setDescription("Play 24/7 Lofi Radio")
    .addStringOption(opt => opt.setName("url").setDescription("Live Stream URL").setRequired(true));

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [command.toJSON()] });
  }
  console.log("✅ Radio Bot is ready!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "radio") return;
  
  const channel = interaction.member?.voice?.channel;
  if (!channel) return interaction.reply({ content: "❌ بچۆ ڤۆیس.", ephemeral: true });

  await interaction.deferReply();
  try {
    const stream = await play.stream(interaction.options.getString("url"));
    const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
    const player = createAudioPlayer();
    
    player.play(createAudioResource(stream.stream, { inputType: stream.type }));
    connection.subscribe(player);
    await interaction.editReply("📻 ئێستا ڕادیۆکە دەستی پێکرد!");
  } catch (e) {
    await interaction.editReply("❌ تکایە تەنها لینکی (Live Stream) دابنێ.");
  }
});

client.login(process.env.TOKEN);
