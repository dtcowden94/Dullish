const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Toggle looping the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue?.current) return interaction.reply('Nothing is playing.');

    queue.loop = !queue.loop;
    interaction.reply(`Loop is now **${queue.loop ? 'on' : 'off'}**.`);
  },
};
