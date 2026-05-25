require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getQueue, getOrCreateQueue, deleteQueue } = require('./src/player');
const { loadSound, SOUNDS_DIR } = require('./src/soundboard');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'src', 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err);
      const msg = { content: 'An error occurred.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        interaction.editReply(msg).catch(() => {});
      } else {
        interaction.reply(msg).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const id = interaction.customId;

    // Soundboard buttons — handled independently of music state
    if (id.startsWith('sound_')) {
      const filename = id.slice('sound_'.length);
      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({ content: 'You must be in a voice channel.', flags: MessageFlags.Ephemeral });
      }

      const filePath = path.join(SOUNDS_DIR, filename);
      let buffer;
      try {
        buffer = await loadSound(filename);
      } catch {
        return interaction.reply({ content: 'Failed to load that sound.', flags: MessageFlags.Ephemeral });
      }

      const q = getOrCreateQueue(interaction.guildId);
      if (!q.connection) {
        try { await q.connect(voiceChannel, interaction.channel); } catch (err) {
          return interaction.reply({ content: err.message, flags: MessageFlags.Ephemeral });
        }
      }

      q.playSound(buffer, filePath);
      return interaction.reply({ content: `🔊 **${filename.replace(/\.[^.]+$/, '')}**`, flags: MessageFlags.Ephemeral });
    }

    // Music control buttons — require an active queue
    const queue = getQueue(interaction.guildId);
    if (!queue?.current) {
      return interaction.update({ components: [] }).catch(() => {});
    }

    if (id === 'music_pause') {
      queue.togglePause();
      await interaction.update({
        embeds: [queue.buildEmbed()],
        components: [queue.buildRow()],
      }).catch(() => {});

    } else if (id === 'music_skip') {
      const skipped = queue.current.title;
      queue.clearNowPlayingRef();
      queue.skip();
      await interaction.update({
        embeds: [new EmbedBuilder().setDescription(`⏭ Skipped **${skipped}**`).setColor(0x5865f2)],
        components: [],
      }).catch(() => {});

    } else if (id === 'music_loop') {
      queue.loop = !queue.loop;
      await interaction.update({
        embeds: [queue.buildEmbed()],
        components: [queue.buildRow()],
      }).catch(() => {});

    } else if (id === 'music_stop') {
      queue.clearNowPlayingRef();
      deleteQueue(interaction.guildId);
      await interaction.update({
        embeds: [new EmbedBuilder().setDescription('⏹ Stopped and disconnected.').setColor(0xff0000)],
        components: [],
      }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
