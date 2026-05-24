const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getQueue } = require('../player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current song queue'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue?.current) return interaction.reply('Nothing is playing.');

    const embed = new EmbedBuilder()
      .setTitle('Music Queue')
      .setColor(0x5865f2);

    embed.addFields({
      name: 'Now Playing',
      value: `**${queue.current.title}** (${queue.current.duration}) — ${queue.current.requestedBy}`,
    });

    if (queue.tracks.length > 0) {
      const list = queue.tracks
        .slice(0, 10)
        .map((t, i) => `${i + 1}. **${t.title}** (${t.duration}) — ${t.requestedBy}`)
        .join('\n');
      embed.addFields({ name: 'Up Next', value: list });

      if (queue.tracks.length > 10) {
        embed.setFooter({ text: `...and ${queue.tracks.length - 10} more` });
      }
    }

    if (queue.loop) {
      embed.addFields({ name: 'Loop', value: 'Enabled' });
    }

    interaction.reply({ embeds: [embed] });
  },
};
