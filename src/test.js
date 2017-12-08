let metronome = new METRO.Metronome();

function stop() {
  metronome.stopAll();
}

function start() {
  metronome.startAll();
}

let buttonState = 0;

document.getElementById('button').onclick = function() {
  if (buttonState == 0) {
    start();
    buttonState = 1;

    this.innerHTML = "Stop";
  } else {
    stop();
    buttonState = 0;

    this.innerHTML = "Start";
  }
}

metronome.addSample("sounds/kick1.wav", "kick");
metronome.addSample("sounds/kick2.wav", "lightkick");
metronome.addSample("sounds/snare1.wav", "snare");
metronome.addSample("sounds/snare2.wav", "lightsnare");
metronome.addSample("sounds/rim1.wav", "rim");
metronome.addSample("sounds/click1.wav", "click");

metronome.audio.onLoaded = function() {
  let beats1 = [];
  let beats2 = [];

  for (var i = 0; i <= 4; i++) {
    beats1.push({time: i / 4, volume: (i % 4 === 0) ? 1 : 2, sound: (i % 4 === 0) ? "kick" : "lightkick"});
  }

  for (var i = 0; i <= 5; i++) {
    beats2.push({time: i / 5, volume: 1, sound: "snare"});
  }

  j = new METRO.TimeSignature(4, 3);
  k = new METRO.TimeSignature(4, 4);
  l = new METRO.TimeSignature(1, 1);

  p = new METRO.AutomationTrack({bpm:[{time: 0, bpm: 40}]});

  metronome.addBeat(new METRO.SimpleLoop(j.rhythm("kick", "lightkick")), 'beat1', p);
  metronome.addBeat(new METRO.SimpleLoop(k.rhythm("snare", "lightsnare")), 'beat2', p);
  metronome.addBeat(new METRO.SimpleLoop(l.rhythm("rim").shift(0.25).snip(1).repeat(3).concat(l.rhythm("click").shift(0.25).snip(1).repeat(3).boost(2)), 'beat3', p));
}

function animate() {
  // animator.animate();
  requestAnimationFrame(animate);
}

animate();
