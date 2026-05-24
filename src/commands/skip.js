const { SlashCommandBuilder } = require('discord.js');
const { getQueue } = require('../player');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current song'),

  async execute(interaction) {
    const queue = getQueue(interaction.guildId);
    if (!queue?.current) return interaction.reply('Nothing is playing.');

    const title = queue.current.title;
    queue.skip();
    interaction.reply(`Skipped **${title}**.`);
  },
};
