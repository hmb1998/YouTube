require("dotenv").config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const play = require("play-dl");

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "play") return;

  const channel = interaction.member?.voice?.channel;
  if (!channel) return interaction.reply({ content: "تکایە بچۆ ناو ڤۆیس چەنڵ.", ephemeral: true });

  await interaction.deferReply();

  try {
    const query = interaction.options.getString("link");
    // بەکارهێنانی search بۆ دۆزینەوەی گۆرانییەکە بەبێ کێشەی client_id
    const res = await play.search(query, { limit: 1 });
    if (!res.length) return interaction.editReply("گۆرانییەکە نەدۆزرایەوە!");

    const song = res[0];
    const stream = await play.stream(song.url);

    const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
    const player = createAudioPlayer();
    
    player.play(createAudioResource(stream.stream, { inputType: stream.type }));
    connection.subscribe(player);

    player.once(AudioPlayerStatus.Idle, () => {
      connection.destroy();
    });

    await interaction.editReply(`🎵 ئێستا لێدەدرێت: **${song.title}**`);
  } catch (err) {
    console.error(err);
    await interaction.editReply("❌ کێشەیەک ڕوویدا لە لێدانی گۆرانییەکە.");
  }
});

client.login(process.env.TOKEN);
