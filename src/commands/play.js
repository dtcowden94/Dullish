const { SlashCommandBuilder } = require('discord.js');
const play = require('play-dl');
const { getOrCreateQueue } = require('../player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Song name or YouTube URL').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.editReply('You must be in a voice channel.');
    }

    const botMember = interaction.guild.members.me;
    const perms = voiceChannel.permissionsFor(botMember);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      return interaction.editReply('I need permission to join and speak in your voice channel.');
    }

    const query = interaction.options.getString('query');

    let trackInfo;
    try {
      if (play.yt_validate(query) === 'video') {
        const info = await play.video_info(query);
        trackInfo = {
          title: info.video_details.title,
          url: info.video_details.url,
          duration: info.video_details.durationRaw,
          requestedBy: interaction.user.tag,
        };
      } else {
        const results = await play.search(query, { limit: 1 });
        if (!results.length) return interaction.editReply('No results found.');
        const video = results[0];
        trackInfo = {
          title: video.title,
          url: video.url,
          duration: video.durationRaw,
          requestedBy: interaction.user.tag,
        };
      }
    } catch (err) {
      console.error(err);
      return interaction.editReply('Failed to fetch track info. Try again.');
    }

    const queue = getOrCreateQueue(interaction.guildId);

    if (!queue.connection) {
      try {
        await queue.connect(voiceChannel, interaction.channel);
      } catch (err) {
        return interaction.editReply(err.message);
      }
    }

    const wasIdle = queue.tracks.length === 0 && !queue.current;
    await queue.add(trackInfo);

    if (wasIdle) {
      interaction.editReply(`Playing **${trackInfo.title}**`);
    } else {
      interaction.editReply(`Added to queue: **${trackInfo.title}** (${trackInfo.duration})`);
    }
  },
};
