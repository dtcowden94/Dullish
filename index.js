require('dotenv').config();
const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getQueue, deleteQueue } = require('./src/player');

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

client.once('ready', () => {
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
      const msg = { content: 'An error occurred.', ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        interaction.editReply(msg).catch(() => {});
      } else {
        interaction.reply(msg).catch(() => {});
      }
    }
    return;
  }

  if (interaction.isButton()) {
    const queue = getQueue(interaction.guildId);

    if (!queue?.current) {
      return interaction.update({ components: [] }).catch(() => {});
    }

    const id = interaction.customId;

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
