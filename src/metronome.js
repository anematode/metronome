(function(global, build) {
  global.METRO = {};

  build(global.METRO);
})(window, (function(exports) {
  class Rhythm {
    constructor(beats, duration = -1, copy = false) {
      this.beats = copy ? copyBeats(beats) : beats;
      this._sort();

      if (duration === -1) {
        this.duration = getLength(beats);
        this.beats.splice(-1, 1);
      } else {
        this.duration = duration;
      }

      this.count = this.beats.length;
    }

    apply(f, copy = false, ret = true) {
      if (copy) return this.copy().apply(f, false);

      for (let i = 0; i < this.beats.length; i++) {
        f(this.beats[i]);
      }

      if (ret) return this;
    }

    shift(x, copy = false, ret = true) {
      if (copy) return this.copy().shift(x, false);

      this.apply(y => (y.time += x));
      this.duration += x;

      if (ret) return this;
    }

    stretch(x, copy = false, ret = true) {
      if (copy) return this.copy().stretch(x, false);

      this.apply(y => (y.time *= x));
      this.duration *= x;

      if (ret) return this;
    }

    squish(x, copy = false, ret = true) {
      if (copy) return this.copy().squish(x, false);

      this.stretch(1 / x);

      if (ret) return this;
    }

    snip(length, copy = false, ret = true) {
      if (copy) return this.copy().snip(length, false);
      let i = 0;

      for (; i < this.count; i++) {
        if (this.beats[i].time >= length) {
          this.beats.length = i;
          break;
        }
      }

      this.duration = length;
      this.count = i;

      if (ret) return this;
    }

    _sort() {
      this.beats.sort((x, y) => Math.sign(x.time - y.time));
    }

    repeat(count, copy = false, ret = true) {
      if (copy) return this.copy().repeat(count, false);
      let cp = this.copy();


      for (let i = 0; i < count - 1; i++) {
        this.concat(cp);
      }

      if (ret) return this;
    }

    copy() {
      return new Rhythm(copyBeats(this.beats), this.duration);
    }

    concat(rhythm, copy = false, ret = true) {
      if (copy) return this.copy().concat(rhythm, false);

      rhythm = rhythm.copy();
      rhythm.shift(this.duration);

      this.beats = this.beats.concat(rhythm.beats);
      this.count += rhythm.count;
      this.duration += rhythm.count;

      if (ret) return this;
    }

    union(rhythm, offset = 0, copy = false, ret = true) {
      if (copy) return this.copy().union(rhythm, offset, false);

      rhythm = rhythm.copy();
      rhythm.shift(offset);
      this.beats = this.beats.concat(rhythm.beats);

      this._sort();
      this.count += rhythm.count;
    }

    boost(factor, copy = false, ret = true) {
      if (copy) return this.copy().boost(volume, false);

      this.apply(function(y) {
        if (y.volume !== undefined) y.volume *= factor;
      });

      if (ret) return this;
    }

    addBeat(...beats) {
      this.beats = this.beats.concat(beats);

      this._sort();
      this.count += beats.length;
    }
  }

  class Beat {
    constructor() {
      // Every beat inherits from this

      this.lastBeatTime = 0;
    }

    gobble(time, min = 1) {
      let beats = [];
      let nextBeat = {
        time: 0
      };
      let c = 0;

      while ((this.lastBeatTime >= nextBeat.time - time) || (c < min)) {
        nextBeat = this.next();
        if (!nextBeat) break;
        beats.push(Object.assign({}, nextBeat));
        c++;
      }

      this.lastBeatTime = nextBeat.time;
      return beats;
    }

    gobbleMeasure(max = 500) {
      let beats = [];
      let nextBeat = {
        time: 0
      };

      do {
        nextBeat = this.next();
        beats.push(Object.assign({}, nextBeat));
      } while (!nextBeat.startMeasure && beats.length < 500);

      this.lastBeatTime = nextBeat.time;

      return beats;
    }

    _reset() {
      this.lastBeatTime = 0;
    }
  }

  class SimpleLoop extends Beat {
    constructor(rhythm) {
      super();

      this.rhythm = rhythm.copy();

      this.count = 0;
      this.cycle = 0;
    }

    reset() {
      this.count = 0;
      this.cycle = 0;

      this._reset();
    }

    next() {
      let b = Object.assign({}, this.rhythm.beats[this.count]);
      b.time += this.cycle * this.rhythm.duration;

      this.count += 1;
      this.count %= this.rhythm.count;
      if (this.count === 0) this.cycle += 1;

      return b;
    }

    prev() {
      let b = Object.assign({}, this.rhythm.beats[this.count]);
      b.time += this.cycle * this.rhythm.duration;

      this.count -= 1;
      if (this.count === -1) {
        this.cycle -= 1;
        this.count = this.rhythm.count - 1;
      }

      return b;
    }

    copy() {
      let p = new Simple(this.rhythm);

      p.count = this.count;
      p.cycle = this.cycle;
    }
  }

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

      this.samples[name] = {
        ready: false,
        buffer: null
      };
      this.bufferLoader.addSource({
        url: url,
        callback: function(buffer) {
          that.samples[name] = {
            ready: true,
            buffer: buffer
          };

          if (that.allSamplesReady() && that.onLoaded) that.onLoaded();
          callback(name);
        }
      });
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

  /* Format for AutomationTrack:

  {volume: {time: 1, }}
  */

  let defaultAutomationVolumeTrack = [{
    time: 0,
    volume: 1
  }];
  let defaultAutomationBPMTrack = [{
    time: 0,
    bpm: 120
  }];

  class AutomationTrack {
    constructor(keys) {
      if (keys) {
        this.volume = keys.volume || defaultAutomationVolumeTrack;
        this.bpm = keys.bpm || defaultAutomationBPMTrack;
      } else {
        this.volume = defaultAutomationVolumeTrack;
        this.bpm = defaultAutomationBPMTrack;
      }
    }

    convertTime(time) {
      let bpm = this.bpm;

      if (bpm.length === 1) return interonsetFromBPM(bpm[0].bpm) * time;
      let last = bpm[bpm.length - 1];

      for (let i = 0; i < bpm.length; i++) {
        if (bpm[i].time >= time) {
          last = (i > 0) ? bpm[i - 1] : bpm[0];
          break;
        }
      }

      return interonsetFromBPM(last.bpm) * (time - last.time) + last.time / 2;
    }

    convertVolume(time, volume) {
      let volumes = this.volume;

      if (volumes.length === 1) return volumes[0].volume * volume;
      let last = volumes[volumes.length - 1];

      for (let i = 0; i < volumes.length; i++) {
        if (volumes[i].time >= time) {
          last = (i > 0) ? volumes[i - 1] : volumes[0];
          break;
        }
      }

      return last.volume * volume;
    }
  }

  /*const Interpolation = {
    LINEAR: 0
  }*/

  class BeatPlayer {
    constructor(beat, scheduler, automation) {
      this.beat = beat;
      this.scheduler = scheduler;
      this.automation = automation;

      if (!this.automation || !(this.automation instanceof AutomationTrack)) {
        this.automation = new AutomationTrack();
      }

      this.playing = false;
      this.R = {
        onstart: function() {
          return;
        },
        onstop: function() {
          return;
        },
        onallocate: function(x) {
          return;
        },
      };
    }

    start() {
      if (this.playing) return;
      this.scheduler.setReference(0);

      this.beat.reset();
      this.R.onstart();
      this._allocateBeats();
      this.playing = true;
    }

    _allocateBeats() {
      this.scheduler.clearFinished();

      let beats = this.beat.gobble(2 * RESOLUTION);
      let didDelegateRecall = false;
      let that = this;
      let time, volume;

      for (let i = 0; i < beats.length; i++) {
        if (!didDelegateRecall) {
          time = beats[i].time;
          volume = beats[i].volume;

          this.scheduler.schedulePlay(beats[i].sound, this.automation.convertTime(time), {
            onend: function() {
              that._allocateBeats();
            },
            volume: this.automation.convertVolume(time, volume)
          });
          didDelegateRecall = true;
        } else {
          time = beats[i].time;
          volume = beats[i].volume;
          this.scheduler.schedulePlay(beats[i].sound, this.automation.convertTime(time), {
            volume: this.automation.convertVolume(time, volume)
          });
        }
      }

      this.R.onallocate(beats);
    }

    stop() {
      this.scheduler.stopAll();
      this.playing = false;

      this.R.onstop();
    }
  }

  let defaultBeatNameCount = 0;

  class Metronome {
    constructor(context) {
      this.audio = context || new MetronomeAudioContext();

      this.players = {};
      this.animator = null;
    }

    playerExists(id) {
      return !!this.getPlayer(id);
    }

    setAnimator(animator) {
      this.animator = animator;
    }

    getPlayer(id) {
      return this.players[id];
    }

    addBeat(beat, id, automation) {
      if (beat instanceof Beat) {
        if (!id) {
          id = '__' + defaultBeatNameCount;
          defaultBeatNameCount += 1;
        } else {
          id = id;
        }

        let scheduler = new SchedulerContext(this.audio);
        let player = new BeatPlayer(beat, scheduler, automation);
        this.players[id] = player;

        return player;
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

    startAll(delay = 0) {
      if (delay == 0) {
        for (let id in this.players) {
          this.startPlayer(id);
        }
      } else {
        let that = this;
        return setTimeout(function() {
          that.startAll(0);
        }, delay * 1000);
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

  function getLength(beats) {
    return beats[beats.length - 1].time - beats[0].time;
  }

  function copyBeat(beat) {
    return Object.assign({}, beat);
  }

  function copyBeats(beats) {
    return beats.map(copyBeat);
  }

  function beatShift(beat, time) {
    let l = copyBeat(beat);
    l.time += time;

    return l;
  }

  const Animation = {
    SIMPLE: 0,
    LINEAR: 1
  }

  let utils = {
    BPMFromInteronset,
    BPSFromInteronset,
    interonsetFromBPM,
    interonsetFromBPS
  }

  class TimeSignature {
    constructor(numerator = 4, denominator = 4) {
      this.num = numerator;
      this.den = denominator;
    }

    get length() {
      return this.num / this.den;
    }

    get beatLength() {
      return 1 / this.den;
    }

    toString() {
      return this.num + " / " + this.den;
    }

    rhythm(accent, normal) {
      if (!normal) normal = accent;
      if (!accent) accent = normal;

      let k = [];
      k.push({time: 0, sound: accent, volume: 1});

      for (let i = 1; i < this.num; i++) {
        k.push({time: i / this.den, sound: normal, volume: 1});
      }

      return new Rhythm(k, this.length);
    }
  }

  exports.BufferLoader = BufferLoader;
  exports.MetronomeAudioContext = MetronomeAudioContext;
  exports.SchedulerContext = SchedulerContext;
  exports.getContext = getContext;
  exports.Metronome = Metronome;
  exports.Beat = Beat;
  exports.Rhythm = Rhythm;
  exports.Animation = Animation;
  exports.SimpleLoop = SimpleLoop;
  exports.AutomationTrack = AutomationTrack;
  exports.TimeSignature = TimeSignature;
  exports.utils = utils;
  exports.MAXPLAYING = MAXPLAYING;
  exports.RESOLUTION = RESOLUTION;
}));
