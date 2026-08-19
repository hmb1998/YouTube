require("dotenv").config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const https = require('https');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  const command = new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from YouTube")
    .addStringOption(opt => opt.setName("url").setDescription("YouTube URL").setRequired(true));

  for (const guild of client.guilds.cache.values()) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: [command.toJSON()] });
  }
  console.log("✅ Bot is ready!");
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "play") return;
  
  const channel = interaction.member?.voice?.channel;
  if (!channel) return interaction.reply({ content: "❌ تکایە سەرەتا بچۆ ناو ڤۆیس چەنڵ.", ephemeral: true });

  const url = interaction.options.getString("url");
  await interaction.deferReply();

  try {
    https.get(`https://api.cobalt.tools/api/json?url=${encodeURIComponent(url)}`, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', async () => {
        try {
          const json = JSON.parse(data);
          const audioUrl = json.url || json.picker?.[0]?.url;
          
          if (!audioUrl) return interaction.editReply("❌ نەتوانرا دەنگی ئەم لینکە وەربگیرێت.");

          const connection = joinVoiceChannel({ 
            channelId: channel.id, 
            guildId: channel.guild.id, 
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true 
          });

          const player = createAudioPlayer();
          const resource = createAudioResource(audioUrl);
          
          player.play(resource);
          connection.subscribe(player);

          player.once(AudioPlayerStatus.Idle, () => {
            try { connection.destroy(); } catch {}
          });

          await interaction.editReply("🎵 گۆرانییەکە دەستی پێکرد!");
        } catch (err) {
          await interaction.editReply("❌ هەڵە لە شیکردنەوەی داتاکە.");
        }
      });
    }).on('error', async () => {
      await interaction.editReply("❌ کێشەی ئینتەرنێت هەیە.");
    });
  } catch (e) {
    await interaction.editReply("❌ هەڵەیەک ڕوویدا.");
  }
});

client.login(process.env.TOKEN);
