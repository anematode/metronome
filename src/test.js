let metronome = new METRO.Metronome();

metronome.audio.addSample("sounds/click1.wav");
metronome.audio.addSample("sounds/click2.wav");

metronome.audio.onLoaded = function() {
  metronome.addBeat(new METRO.ConstantBeat(120, 'click1'));
  metronome.startAll();
}
