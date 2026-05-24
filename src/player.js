const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
  StreamType,
} = require('@discordjs/voice');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { spawn } = require('child_process');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

const YTDLP = path.join(__dirname, '..', 'yt-dlp.exe');

class MusicQueue {
  constructor() {
    this.tracks = [];
    this.current = null;
    this.player = createAudioPlayer();
    this.connection = null;
    this.textChannel = null;
    this.loop = false;
    this._ytdlp = null;
    this._ffmpeg = null;
    this._nowPlayingMessage = null;

    this.player.on(AudioPlayerStatus.Idle, () => this._onIdle());
    this.player.on('error', (err) => {
      console.error('Player error:', err.message);
      this._advance();
    });
  }

  async connect(voiceChannel, textChannel) {
    this.textChannel = textChannel;
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 10_000);
    } catch {
      this.connection.destroy();
      throw new Error('Could not connect to voice channel in time.');
    }

    this.connection.subscribe(this.player);

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  async add(track) {
    this.tracks.push(track);
    if (this.player.state.status === AudioPlayerStatus.Idle) {
      await this._play(this.tracks.shift());
    }
  }

  skip() {
    this._killProcesses();
    this.player.stop(true);
  }

  togglePause() {
    if (this.player.state.status === AudioPlayerStatus.Paused) {
      this.player.unpause();
      return false;
    }
    this.player.pause();
    return true;
  }

  stop() {
    this.tracks = [];
    this.loop = false;
    this._killProcesses();
    this.player.stop(true);
  }

  destroy() {
    this.stop();
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
  }

  getStatus() {
    return this.player.state.status;
  }

  clearNowPlayingRef() {
    this._nowPlayingMessage = null;
  }

  buildEmbed() {
    const paused = this.player.state.status === AudioPlayerStatus.Paused;
    return new EmbedBuilder()
      .setTitle(paused ? '⏸ Paused' : '🎵 Now Playing')
      .setDescription(`**${this.current.title}**`)
      .addFields(
        { name: 'Duration', value: this.current.duration, inline: true },
        { name: 'Requested by', value: this.current.requestedBy, inline: true },
        { name: 'Up Next', value: this.tracks.length ? `${this.tracks.length} song(s)` : 'Nothing', inline: true },
      )
      .setColor(paused ? 0xffa500 : 0x5865f2);
  }

  buildRow() {
    const paused = this.player.state.status === AudioPlayerStatus.Paused;
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('music_pause')
        .setLabel(paused ? '▶ Resume' : '⏸ Pause')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('⏭ Skip')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('music_loop')
        .setLabel('🔁 Loop')
        .setStyle(this.loop ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('music_stop')
        .setLabel('⏹ Stop')
        .setStyle(ButtonStyle.Danger),
    );
  }

  _killProcesses() {
    try { this._ytdlp?.kill(); } catch {}
    try { this._ffmpeg?.kill(); } catch {}
    this._ytdlp = null;
    this._ffmpeg = null;
  }

  async _play(track) {
    this.current = track;

    // Disable buttons on the previous now-playing message
    if (this._nowPlayingMessage) {
      try { await this._nowPlayingMessage.edit({ components: [] }); } catch {}
      this._nowPlayingMessage = null;
    }

    const ytdlp = spawn(YTDLP, [
      '--no-playlist',
      '-f', 'bestaudio',
      '-o', '-',
      '--quiet',
      '--no-warnings',
      track.url,
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    const ffmpeg = spawn(ffmpegPath, [
      '-i', 'pipe:0',
      '-analyzeduration', '0',
      '-loglevel', '0',
      '-f', 's16le',
      '-ar', '48000',
      '-ac', '2',
      'pipe:1',
    ], { stdio: ['pipe', 'pipe', 'ignore'] });

    this._ytdlp = ytdlp;
    this._ffmpeg = ffmpeg;

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ytdlp.stdout.on('error', () => {});
    ffmpeg.stdin.on('error', () => {});

    ytdlp.on('error', (err) => {
      console.error('yt-dlp error:', err.message);
      ffmpeg.kill();
      this.textChannel?.send(`Failed to play **${track.title}**. Is yt-dlp.exe in the project folder?`);
      this._advance();
    });

    ffmpeg.on('error', (err) => {
      console.error('ffmpeg error:', err.message);
      this.textChannel?.send(`Failed to play **${track.title}**. Skipping...`);
      this._advance();
    });

    const resource = createAudioResource(ffmpeg.stdout, { inputType: StreamType.Raw });
    this.player.play(resource);

    try {
      this._nowPlayingMessage = await this.textChannel?.send({
        embeds: [this.buildEmbed()],
        components: [this.buildRow()],
      });
    } catch {}
  }

  _onIdle() {
    if (this.loop && this.current) {
      this._play(this.current);
      return;
    }
    this._advance();
  }

  async _advance() {
    if (this.tracks.length > 0) {
      this._play(this.tracks.shift());
    } else {
      this.current = null;
      if (this._nowPlayingMessage) {
        try {
          await this._nowPlayingMessage.edit({
            embeds: [new EmbedBuilder().setDescription('Queue ended.').setColor(0x5865f2)],
            components: [],
          });
        } catch {}
        this._nowPlayingMessage = null;
      }
    }
  }
}

const queues = new Map();

function getQueue(guildId) {
  return queues.get(guildId);
}

function getOrCreateQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, new MusicQueue());
  }
  return queues.get(guildId);
}

function deleteQueue(guildId) {
  const q = queues.get(guildId);
  if (q) q.destroy();
  queues.delete(guildId);
}

module.exports = { getQueue, getOrCreateQueue, deleteQueue };
