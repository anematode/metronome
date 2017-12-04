(function(global, build) {
  global.METRO = {};

  build(global.METRO);
})(window, (function(exports) {
  let getContext = function() {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    return new AudioContext();
  }

  class BufferLoader {
    constructor(audioContext) {
      this.context = audioContext;
      this.sources = [];
    }

    addSource(sources, call) {
      if (!call) {
        if (Array.isArray(sources)) {
          for (let i = 0; i < sources.length; i++) {
            this.sources.push(sources[i]);
          }
        } else {
          this.sources.push(sources);
        }
      } else {
        this.sources.push({
          url: sources,
          callback: call
        });
      }
    }

    get sourceCount() {
      return this.sources.length;
    }

    sourcesLeft() {
      return (this.sourceCount > 0);
    }

    peekSource() {
      if (this.sourcesLeft()) {
        return this.sources[0];
      }
    }

    getSource() {
      if (this.sourcesLeft()) {
        return this.sources.shift();
      }
    }

    loadSource() {
      if (!this.sourcesLeft()) {
        return;
      }

      let source = this.getSource();

      let request = new XMLHttpRequest();
      request.open("GET", source.url, true);
      request.responseType = "arraybuffer";

      let loader = this;

      request.onload = function() {
        loader.context.decodeAudioData(
          request.response,
          function(buffer) {
            if (!buffer) {
              throw new Error("Error decoding audio data.");
              return;
            }
            source.callback(buffer);
          },
          function(error) {
            throw new Error("Error loading audio file.");
          }
        );
      }

      request.onerror = function() {
        throw new Error("Could not connect to audio files.");
      }

      request.send();
    }

    loadAll() {
      while (this.sourcesLeft()) {
        this.loadSource();
      }
    }
  }

  function extractFileName(url) {
    let name = url.substring(url.lastIndexOf('/') + 1);
    return name.substr(0, name.lastIndexOf('.')) || name;
  }

  class MetronomeAudioContext {
    constructor() {
      this.audioCtx = getContext();

      this.bufferLoader = new BufferLoader(this.audioCtx);
      this.samples = {};

      this.volumes = {};

      this.masterGainNode = this.createGain();
      this.masterGainNode.connect(this.destination);

      this.sampleCount = 0;
    }

    createBufferSource() {
      return this.audioCtx.createBufferSource();
    }

    createGain() {
      return this.audioCtx.createGain();
    }

    get destination() {
      return this.audioCtx.destination;
    }

    addSample(url, name, callback) {
      let that = this;
      name = name || extractFileName(url);
      callback = callback || function(name) {};

      this.samples[name] = {ready: false, buffer: null};
      this.bufferLoader.addSource({url: url, callback: function(buffer) {
        that.samples[name] = {ready: true, buffer: buffer};

        if (that.allSamplesReady() && that.onLoaded) that.onLoaded();
        callback(name);
      }});
      this.bufferLoader.loadSource();
    }

    getVolumeNode(vol) {
      let roundVol = parseInt(vol * 100) / 100;
      if (this.volumes[roundVol]) return this.volumes[roundVol];

      let newNode = this.createGain();
      newNode.connect(this.masterGainNode);

      newNode.gain.value = vol;
      this.volumes[roundVol] = newNode;

      return newNode;
    }

    allSamplesReady() {
      for (let sample in this.samples) {
        if (!this.samples[sample].ready) return false;
      }
      return true;
    }

    get currentTime() {
      return this.audioCtx.currentTime;
    }

    getBuffer(name) {
      return this.samples[name].buffer;
    }

    schedulePlay(name, time, isOffset = false, modifiers = {}) {
      if (modifiers === null || !(typeof modifiers === 'object')) {
        modifiers = {};
      }
      modifiers.volume = modifiers.volume || 1;

      let source = this.createBufferSource();
      source.buffer = this.getBuffer(name);
      source.connect(this.getVolumeNode(modifiers.volume));

      source.start(time + (isOffset ? this.currentTime : 0));
      source.onended = markNodeFinishedConstructor(source, modifiers.onend);

      return source;
    }
  }

  function markNodeFinishedConstructor(node, other) {
    if (typeof other === "function") {
      return function() {
        node.finished = true;
        other();
      }
    } else {
      return function() {
        node.finished = true;
      }
    }
  }

  Array.prototype.removeIf = function(f) {
    for (let i = this.length - 1; i >= 0; i--) {
      if (f(this[i])) {
        this.splice(i, 1);
      }
    }
  }

  let MAXPLAYING = 500;
  let RESOLUTION = 1;

  class SchedulerContext {
    constructor(ctx) {
      this.audio = ctx || new MetronomeAudioContext();

      this.playing = [];
      this.referenceStart = this.audio.currentTime;
    }

    schedulePlay(name, time, modifiers = {}) {
      this.playing.push(this.audio.schedulePlay(name,
        time + this.referenceStart,
        false, modifiers));

      if (this.playing.length > MAXPLAYING) {
        this.clearFinished();
        if (this.playing.length > MAXPLAYING) {
          this.stopAll();

          throw new Error("Maximum queued beats exceeded.");
        }
      }
    }

    play(name, modifiers = {}) {
      this.schedulePlay(name, 0, true, modifiers);
    }

    stopAll() {
      for (let i = 0; i < this.playing.length; i++) {
        this.playing[i].onended = null;
        this.playing[i].stop();
      }

      this._clearPlaying();
    }

    clearFinished() {
      this.playing.removeIf(a => a.finished);
    }

    _clearPlaying() {
      this.playing = [];
    }

    get _currentTime() {
      return this.audio.currentTime;
    }

    setReference(time, isOffset = true) {
      this.referenceStart = time + (isOffset ? this._currentTime : 0);
    }
  }

  class BeatPlayer {
    constructor(beat, scheduler) {
      this.beat = beat;
      this.scheduler = scheduler;
    }

    start() {
      this.scheduler.setReference(0);

      this.beat.reset();
      this._allocateBeats();
    }

    _allocateBeats() {
      let beats = this.beat.gobble(2 * RESOLUTION);
      let didDelegateRecall = false;

      for (let i = 0; i < beats.length; i++) {
        if (!didDelegateRecall && beats[i].time >= beats[0].time + 0.9 * RESOLUTION) {
          let that = this;
          this.scheduler.schedulePlay(beats[i].sound, beats[i].time, {onend: function() {
            that._allocateBeats();
          }, volume: beats[i].volume});
          didDelegateRecall = true;
        } else {
          this.scheduler.schedulePlay(beats[i].sound, beats[i].time, {volume: beats[i].volume});
        }
      }
    }

    stop() {
      this.scheduler.stopAll();
    }
  }

  let defaultBeatNameCount = 0;

  class Metronome {
    constructor(context) {
      this.audio = context || new MetronomeAudioContext();

      this.players = {};
    }

    playerExists(id) {
      return !!this.getPlayer(id);
    }

    getPlayer(id) {
      return this.players[id];
    }

    addBeat(beat, id) {
      if (beat instanceof Beat) {
        if (!id) {
          id = '__' + defaultBeatNameCount;
          defaultBeatNameCount += 1;
        } else {
          id = id;
        }

        let scheduler = new SchedulerContext(this.audio);
        let player = new BeatPlayer(beat, scheduler);
        this.players[id] = player;
      }
    }

    stopPlayer(id) {
      this.getPlayer(id).stop();
    }

    startPlayer(id) {
      this.getPlayer(id).start();
    }

    destroyPlayer(id) {
      this.players[id] = undefined;
    }

    startAll() {
      for (let id in this.players) {
        this.startPlayer(id);
      }
    }

    stopAll() {
      for (let id in this.players) {
        this.stopPlayer(id);
      }
    }

    set volume(vol) {
      this.audio.masterGainNode.gain.value = vol;
    }

    get volume() {
      return this.audio.masterGainNode.gain.value;
    }

    mute() {
      this.volume = 0;
    }

    addSample(name, url, callback) {
      this.audio.addSample(name, url, callback);
    }
  }

  class Beat {
    constructor() {
      // Every beat inherits from this

      this.lastBeatTime = 0;
    }

    gobble(time) {
      let beats = [];
      let nextBeat = {time: 0};

      while (this.lastBeatTime > nextBeat.time - time) {
        nextBeat = this.next();
        if (!nextBeat) break;
        beats.push(Object.assign({}, nextBeat));
      }

      this.lastBeatTime = nextBeat.time;

      return beats;
    }
  }

  function BPMFromInteronset(interonset) {
    return 60 / interonset;
  }

  function BPSFromInteronset(interonset) {
    return 1 / interonset;
  }

  function interonsetFromBPM(bpm) {
    return 60 / bpm;
  }

  function interonsetFromBPS(bps) {
    return 1 / bps;
  }

  function updateFrequencyFromBPM(bpm) {
    return Math.round(Math.max(RESOLUTION / interonsetFromBPM(bpm), 1));
  }

  function updateFrequencyFromBPS(bps) {
    return Math.round(Math.max(RESOLUTION / interonsetFromBPS(bps), 1));
  }

  class ConstantBeat extends Beat {
    constructor(config) {
      super();

      config = config || {};

      if (config.bpm !== undefined) {
        config.interonset = interonsetFromBPM(config.bpm);
      } else if (config.bps !== undefined) {
        config.interonset = interonsetFromBPS(config.bps);
      }

      this.sound = config.sound;

      this.interonset = config.interonset || 0.5;
      this.volume = config.volume || 1;


      this.count = 0;
    }

    reset() {
      this.count = 0;
    }

    next() {
      this.count += 1;
      return {time: this.interonset * (this.count - 1), sound: this.sound, volume: this.volume};
    }

    get bpm() {
      return BPMFromInteronset(this.interonset);
    }

    get bps() {
      return BPSFromInteronset(this.interonset);
    }

    set bpm(bpm) {
      this.interonset = interonsetFromBPM(bpm);
    }

    set bpm(bps) {
      this.interonset = interonsetFromBPM(bps);
    }
  }

  class ConstantTime extends Beat {
    constructor(config) {
      super();

      config = config || {};

      if (config.bpm !== undefined) {
        config.interonset = interonsetFromBPM(config.bpm);
      } else if (config.bps !== undefined) {
        config.interonset = interonsetFromBPS(config.bps);
      }

      this.normalVolume = config.normalVolume || config.soundVolume || config.volume || 0.5;
      this.accentVolume = config.accentVolume || config.volume || 1;

      this.normal = config.sound || config.normal;
      this.accent = config.accent || this.normal;

      this.num = config.count || config.num || 4;

      this.interonset = config.interonset || 0.5;

      this.count = 0;
    }

    reset() {
      this.count = 0;
    }

    next() {
      this.count += 1;
      if ((this.count - 1) % this.num === 0) {
        return {time: this.interonset * (this.count - 1), sound: this.accent, volume: this.accentVolume};
      } else {
        return {time: this.interonset * (this.count - 1), sound: this.normal, volume: this.normalVolume};
      }
    }

    get bpm() {
      return BPMFromInteronset(this.interonset);
    }

    get bps() {
      return BPSFromInteronset(this.interonset);
    }

    set bpm(bpm) {
      this.interonset = interonsetFromBPM(bpm);
    }

    set bpm(bps) {
      this.interonset = interonsetFromBPM(bps);
    }
  }

  class Rhythm {
    constructor(beats, _empty = false) {
      if (!_empty && (!Array.isArray(beats) || (beats.length <= 1))) {
        throw new Error("There must be at least two beats provided in an array.");
      }

      this.beats = beats;
      this.sort();
    }

    sort() {
      this.beats.sort((x, y) => Math.sign(x.time - y.time));
    }

    add(beat) {
      if (Array.isArray(beat)) {
        this.beats = this.beats.concat(beat);
      } else {
        this.beats.push(beat);
      }

      this.sort();
    }

    duration() {
      return this.beats[this.beats.length - 1].time - this.beats[0].time;
    }

    count() {
      return this.beats.length;
    }

    stretch(f) {
      for (let i = 0; i < this.beats.length; i++) {
        this.beats[i].time = this.beats[i].time * f;
      }
    }

    squish(f) {
      this.stretch(1/f);
    }

    increaseVolume(f) {
      for (let i = 0; i < this.beats.length; i++) {
        this.beats[i].volume += f;
      }
    }

    decreaseVolume(f) {
      this.increaseVolume(-f);
    }

    multiplyVolume(f) {
      for (let i = 0; i < this.beats.length; i++) {
        this.beats[i].volume *= f;
      }
    }

    divideVolume(f) {
      this.multiplyVolume(1/f);
    }

    shift(time) {
      for (let i = 0; i < this.beats.length; i++) {
        this.beats[i].time += time;
      }
    }

    concat(rhythm) {
      if (rhythm instanceof RhythmicMotif) {
        this.beats = this.beats.concat(rhythm);
      }
    }

    copy() {
      let p = new Rhythm([], true);

      for (let i = 0; i < this.beats.length; i++) {
        p.add(Object.assign({}, this.beats[i]));
      }

      return p;
    }

    apply(f, usereturn = true) {
      for (let i = 0; i < this.beats.length; i++) {
        if (usereturn) {
          this.beats[i] = f(this.beats[i]);
        } else {
          f(this.beats[i])
        }
      }
    }
  }

  class GenericBeat extends Beat {
    constructor(rhythm, loop = true) {
      super();

      this.rhythm = rhythm.copy();
      this.loop = loop;
      this.count = 0;

      this.cycle = 0;
    }

    reset() {
      this.rhythm.shift(-this.cycle * this.rhythm.duration());

      this.count = 0;
      this.cycle = 0;
    }

    next() {
      this.count += 1;

      if (this.loop && this.count == this.rhythm.beats.length) {
        this.count = 1;
        this.cycle += 1;

        this.rhythm.shift(this.rhythm.duration());
        return this.rhythm.beats[0];
      }

      return this.rhythm.beats[this.count - 1];
    }
  }

  exports.BufferLoader = BufferLoader;
  exports.MetronomeAudioContext = MetronomeAudioContext;
  exports.SchedulerContext = SchedulerContext;
  exports.getContext = getContext;
  exports.Metronome = Metronome;
  exports.Beat = Beat;
  exports.ConstantBeat = ConstantBeat;
  exports.ConstantTime = ConstantTime;
  exports.Rhythm = Rhythm;
  exports.GenericLoop = GenericBeat;
  exports.MAXPLAYING = MAXPLAYING;
  exports.RESOLUTION = RESOLUTION;
}));
