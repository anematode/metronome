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

let animator = new METRO.MetronomeAnimator(metronome, document.getElementById('metrcanvas'));

metronome.audio.addSample("sounds/click1.wav");
metronome.audio.addSample("sounds/click2.wav");
metronome.audio.addSample("sounds/click3.wav");
metronome.audio.addSample("sounds/accent1.wav");

metronome.audio.onLoaded = function() {
  let beats = [];

  beats.push({time: 0, volume: 1, sound: "click2"});
  for (var i = 0; i < 3; i++) {
    beats.push({time: 1 + i/3, volume: 1, sound: "click2"});
  }
  beats.push({time: 2});

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

  metronome.addBeat(new METRO.GenericLoop(j), 'beat1');
  metronome.addBeat(new METRO.GenericLoop(k), 'beat2');

  animator.setupAnimation('beat1', METRO.Animation.SIMPLE);
  animator.configureAnimation('beat1', {xmax: 512, ymax: 512});

  animator.setupAnimation('beat2', METRO.Animation.SIMPLE);
  animator.configureAnimation('beat2', {xmin: 512, ymin: 0, xmax: 1024, ymax: 512});
}

function animate() {
  animator.animate();
  requestAnimationFrame(animate);
}

animate();
