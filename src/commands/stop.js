const { SlashCommandBuilder } = require('discord.js');
const { getQueue, deleteQueue } = require('../player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback and disconnect'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue) return interaction.reply('I am not in a voice channel.');

    deleteQueue(interaction.guildId);
    interaction.reply('Stopped and disconnected.');
  },
};
