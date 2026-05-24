const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue?.current) return interaction.reply('Nothing is playing.');
    queue.unpause();
    interaction.reply('Resumed.');
  },
};
