const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue?.current) return interaction.reply('Nothing is playing.');
    queue.pause();
    interaction.reply('Paused.');
  },
};
