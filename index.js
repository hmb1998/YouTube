require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require("@discordjs/voice");
const { exec } = require('yt-dlp-exec');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const command = new SlashCommandBuilder()
    .setName("radio")
    .setDescription("Play YouTube audio")
    .addStringOption(opt => opt.setName("url").setDescription("YouTube URL").setRequired(true));

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [command.toJSON()] });
  }
  console.log("✅ Bot is ready!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "radio") return;
  
  const channel = interaction.member?.voice?.channel;
  if (!channel) return interaction.reply({ content: "❌ سەرەتا بچۆ ناو ڤۆیس چەنڵ.", ephemeral: true });

  const url = interaction.options.getString("url");
  if (!url.includes("http")) {
    return interaction.reply({ content: "❌ تکایە لینکی ڕاستەوخۆ دابنە.", ephemeral: true });
  }

  await interaction.deferReply();

  try {
    const output = await exec(url, {
      print: '%(url)s',
      format: 'bestaudio',
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true
    });

    const audioUrl = output.stdout.trim().split('\n').pop();
    if (!audioUrl) throw new Error("Could not get audio URL");

    const connection = joinVoiceChannel({ 
      channelId: channel.id, 
      guildId: channel.guild.id, 
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true 
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(audioUrl, { inputType: StreamType.Arbitrary });
    
    player.play(resource);
    connection.subscribe(player);

    player.once(AudioPlayerStatus.Idle, () => {
      try { connection.destroy(); } catch {}
    });

    await interaction.editReply("🎵 ئێستا دەنگی لینکەکە دەستی پێکرد!");
  } catch (e) {
    console.error(e);
    await interaction.editReply("❌ کێشە ڕوویدا لە وەرگرتنی دەنگەکە.");
  }
});

client.login(process.env.TOKEN);
