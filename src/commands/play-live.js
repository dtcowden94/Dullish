const { SlashCommandBuilder } = require('discord.js');
const YouTube = require('youtube-sr').default;
const { getOrCreateQueue } = require('../player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play-live')
    .setDescription('Play a YouTube livestream')
    .addStringOption((opt) =>
      opt.setName('url').setDescription('YouTube livestream URL').setRequired(true)
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

    const url = interaction.options.getString('url');

    if (!YouTube.validate(url, 'VIDEO')) {
      return interaction.editReply('Please provide a valid YouTube URL.');
    }

    let trackInfo;
    try {
      const video = await YouTube.getVideo(url);
      trackInfo = {
        title: video.title,
        url: video.url,
        duration: '🔴 LIVE',
        requestedBy: interaction.user.tag,
        isLive: true,
      };
    } catch (err) {
      console.error(err);
      return interaction.editReply('Failed to fetch stream info. Make sure the URL is a valid YouTube livestream.');
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
      interaction.editReply(`Playing livestream **${trackInfo.title}**`);
    } else {
      interaction.editReply(`Added to queue: **${trackInfo.title}** (🔴 LIVE)`);
    }
  },
};
