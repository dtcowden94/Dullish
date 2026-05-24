const { SlashCommandBuilder } = require('discord.js');
const YouTube = require('youtube-sr').default;
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
      if (YouTube.validate(query, 'VIDEO')) {
        const video = await YouTube.getVideo(query);
        trackInfo = {
          title: video.title,
          url: video.url,
          duration: video.durationFormatted,
          requestedBy: interaction.user.tag,
        };
      } else {
        const video = await YouTube.searchOne(query);
        if (!video) return interaction.editReply('No results found.');
        trackInfo = {
          title: video.title,
          url: video.url,
          duration: video.durationFormatted,
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

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
