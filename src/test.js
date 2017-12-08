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

metronome.audio.onLoaded = function() {
  let beats1 = [];
  let beats2 = [];

  for (var i = 0; i <= 8; i++) {
    beats1.push({time: i / 8, volume: (i % 4 === 0) ? 1 : 2, sound: (i % 4 === 0) ? "kick" : "lightkick"});
  }

  for (var i = 0; i <= 5; i++) {
    beats2.push({time: i / 5, volume: 1, sound: "snare"});
  }

  j = new METRO.Rhythm(beats1);
  k = new METRO.Rhythm(beats2);
  k.stretch(5);
  j.stretch(5);


  metronome.addBeat(new METRO.Simple(j), 'beat1');
  metronome.addBeat(new METRO.Simple(k), 'beat2');
}

function animate() {
  // animator.animate();
  requestAnimationFrame(animate);
}

animate();
