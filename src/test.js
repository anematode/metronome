let metronome = new METRO.Metronome();

metronome.audio.addSample("sounds/click1.wav");
metronome.audio.addSample("sounds/click2.wav");
metronome.audio.addSample("sounds/click3.wav");
metronome.audio.addSample("sounds/accent1.wav");

metronome.audio.onLoaded = function() {
  let beats = [];

  beats.push({time: 0, volume: 1, sound: "click2"});
  for (var i = 0; i < 3; i++) {
    beats.push({time: 1 + i / 3, volume: 1, sound: "click1"});
  }
  beats.push({time: 2, volume: 1, sound: "click1"});

  j = new METRO.Rhythm(beats);
  k = j.copy();

  j.squish(4/3);
  k.apply(function(x) {
    if (x.sound == "click1") {
      x.sound = "click3";
    }
    if (x.sound == "click2") {
      x.sound = "accent1";
    }
  }, false);

  metronome.addBeat(new METRO.GenericLoop(j));
  metronome.addBeat(new METRO.GenericLoop(k));

  // metronome.addBeat(new METRO.ConstantBeat(200, 'click3'), 'beat3');
  metronome.startAll(1);
}
