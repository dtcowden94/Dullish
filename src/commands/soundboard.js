const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getSoundFiles } = require('../soundboard');
const { getOrCreateQueue } = require('../player');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('soundboard')
    .setDescription('Open the soundboard'),

  async execute(interaction) {
    const sounds = getSoundFiles();

    if (sounds.length === 0) {
      return interaction.reply({
        content: 'No sounds found. Add `.mp3` or `.wav` files to the `sounds/` folder and restart the bot.',
        ephemeral: true,
      });
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({ content: 'You must be in a voice channel to use the soundboard.', ephemeral: true });
    }

    // Join voice if not already connected
    const queue = getOrCreateQueue(interaction.guildId);
    if (!queue.connection) {
      try {
        await queue.connect(voiceChannel, interaction.channel);
      } catch (err) {
        return interaction.reply({ content: err.message, ephemeral: true });
      }
    }

    const rows = [];
    for (let i = 0; i < sounds.length; i += 5) {
      const chunk = sounds.slice(i, i + 5);
      rows.push(
        new ActionRowBuilder().addComponents(
          chunk.map((f) =>
            new ButtonBuilder()
              .setCustomId(`sound_${f}`)
              .setLabel(path.basename(f, path.extname(f)))
              .setStyle(ButtonStyle.Secondary)
          )
        )
      );
    }

    await interaction.reply({ content: '🎵 Soundboard', components: rows });
  },
};
