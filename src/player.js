const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  joinVoiceChannel,
} = require('@discordjs/voice');
const play = require('play-dl');

class MusicQueue {
  constructor() {
    this.tracks = [];
    this.current = null;
    this.player = createAudioPlayer();
    this.connection = null;
    this.textChannel = null;
    this.loop = false;

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

  async skip() {
    if (this.player.state.status !== AudioPlayerStatus.Idle) {
      this.player.stop(true);
    }
  }

  pause() {
    return this.player.pause();
  }

  unpause() {
    return this.player.unpause();
  }

  stop() {
    this.tracks = [];
    this.loop = false;
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

  async _play(track) {
    this.current = track;
    try {
      const stream = await play.stream(track.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type,
      });
      this.player.play(resource);
      this.textChannel?.send(`Now playing: **${track.title}** (${track.duration})`);
    } catch (err) {
      console.error('Stream error:', err.message);
      this.textChannel?.send(`Failed to play **${track.title}**. Skipping...`);
      this._advance();
    }
  }

  _onIdle() {
    if (this.loop && this.current) {
      this._play(this.current);
      return;
    }
    this._advance();
  }

  _advance() {
    if (this.tracks.length > 0) {
      this._play(this.tracks.shift());
    } else {
      this.current = null;
    }
  }
}

// One queue per guild
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
