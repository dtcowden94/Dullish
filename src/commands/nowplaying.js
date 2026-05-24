const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue } = require('../player');
const { AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Show the currently playing song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue?.current) return interaction.reply('Nothing is playing.');

    const status = queue.getStatus();
    const paused = status === AudioPlayerStatus.Paused ? ' (paused)' : '';

    const embed = new EmbedBuilder()
      .setTitle(`Now Playing${paused}`)
      .setDescription(`**${queue.current.title}**`)
      .addFields(
        { name: 'Duration', value: queue.current.duration, inline: true },
        { name: 'Requested by', value: queue.current.requestedBy, inline: true }
      )
      .setColor(0x5865f2);

    interaction.reply({ embeds: [embed] });
  },
};
