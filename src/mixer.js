const { Transform } = require('stream');

class PCMMixer extends Transform {
  constructor() {
    super();
    this._sounds = [];
  }

  _transform(chunk, encoding, callback) {
    if (this._sounds.length === 0) {
      return callback(null, chunk);
    }

    const output = Buffer.from(chunk);

    for (const sound of this._sounds) {
      const available = Math.min(chunk.length, sound.buffer.length - sound.offset);
      for (let i = 0; i < available; i += 2) {
        const music = output.readInt16LE(i);
        const sfx = sound.buffer.readInt16LE(sound.offset + i);
        output.writeInt16LE(Math.max(-32768, Math.min(32767, music + sfx)), i);
      }
      sound.offset += available;
    }

    this._sounds = this._sounds.filter((s) => s.offset < s.buffer.length);
    callback(null, output);
  }

  addSound(buffer) {
    this._sounds.push({ buffer, offset: 0 });
  }
}

module.exports = PCMMixer;
