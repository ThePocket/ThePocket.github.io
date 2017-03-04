var AudioContext = window.AudioContext // Default
    || window.webkitAudioContext // Safari and old versions of Chrome
    || false; 

var isPlaying = false;      // Are we currently playing?
var startTime;              // The start time of the entire sequence.
var current16thNote;        // What note is currently last scheduled?
var tempo = 85;          // tempo (in beats per minute)
var volume = 0.1
var lookahead = 100.0;       // How frequently to call scheduling function 
                            //(in milliseconds)
var scheduleAheadTime = 1;    // How far ahead to schedule audio (sec)
                            // This is calculated from lookahead, and overlaps 
                            // with next interval (in case the timer is late)
var nextNoteTime = 0.0;     // when the next note is due.
var noteResolution = 2;     // 0 == 16th, 1 == 8th, 2 == quarter note
var noteLength = 0.0300;      // length of "beep" (in seconds)
var canvas,                 // the canvas element
    canvasContext;          // canvasContext is the canvas' context 2D
var last16thNoteDrawn = -1; // the last "box" we drew on the screen
var notesInQueue = [];      // the notes that have been put into the web audio,
                            // and may or may not have played yet. {note, time}
var timerWorker = null;     // The Web Worker used to fire timer messages


window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.oRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function( callback ){
        window.setTimeout(callback, 1000 / 60);
    };
})();

function nextNote() {
    var secondsPerBeat = 60.0 / tempo;                       
    nextNoteTime += 0.25 * secondsPerBeat;    // Add beat length to last beat time

    current16thNote++;    
    if (current16thNote == 16) {
        current16thNote = 0;
    }
}

function change_tempo(amount) {
    tempo = tempo + amount;
    return;
}

function scheduleNote( beatNumber, time ) {
  
    notesInQueue.push( { note: beatNumber, time: time } );

    if ( (noteResolution==1) && (beatNumber%2))
        return; 
    if ( (noteResolution==2) && (beatNumber%4))
        return; 

   
    var osc = audioContext.createOscillator();
    osc.type = "sawtooth"
    var gainNode = audioContext.createGain();
    osc.connect(gainNode);
    gainNode.gain.value = volume;
    eq = audioContext.createBiquadFilter();
    eq.type = "highpass";
    eq.frequency.value = 300;
    eq2 = audioContext.createBiquadFilter();
    eq2.type = "lowpass";
    eq2.frequency.value = 900;
    gainNode.connect(eq)
    eq.connect(eq2)
    eq2.connect(audioContext.destination);

    
    if (beatNumber % 16 === 0)   
        osc.frequency.value = 523.25;
    else if (beatNumber % 4 === 0 )    
        osc.frequency.value = 523.25	;
    else                       
        osc.frequency.value = 523.25;

    osc.start( time );
    osc.stop( time + noteLength );
}

function scheduler() {
    // while there are notes that will need to play before the next interval, 
    // schedule them and advance the pointer.
    while (nextNoteTime < audioContext.currentTime + scheduleAheadTime ) {
        scheduleNote( current16thNote, nextNoteTime );
        nextNote();
    }
}

function play() {
    isPlaying = !isPlaying;

    if (isPlaying) { 
        current16thNote = 0;
        nextNoteTime = audioContext.currentTime;
        timerWorker.postMessage("start");
        return "STOP";
    } else {
        timerWorker.postMessage("stop");
        return "PLAY";
    }
}

function resetCanvas (e) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.scrollTo(0,0); 
}

function draw() {
    var currentNote = last16thNoteDrawn;
    var currentTime = audioContext.currentTime;

    while (notesInQueue.length && notesInQueue[0].time < currentTime) {
        currentNote = notesInQueue[0].note;
        notesInQueue.splice(0,1);   // remove note from queue
    }

    // We only need to draw if the note has moved.
    // if (last16thNoteDrawn != currentNote) {
        // var x = Math.floor( canvas.width / 18 );
        // canvasContext.clearRect(0,0,canvas.width, canvas.height); 
        // for (var i=0; i<16; i++) {
        //     canvasContext.fillStyle = ( currentNote == i ) ? 
        //         ((currentNote%4 === 0)?"red":"blue") : "black";
        //     canvasContext.fillRect( x * (i+1), x, x/2, x/2 );
        // }
        // last16thNoteDrawn = currentNote;
    // }

    // set up to draw again
    requestAnimFrame(draw);
}

function init(){
    var container = document.createElement( 'div' );

    container.className = "container";
    canvas = document.createElement( 'canvas' );
    canvasContext = canvas.getContext( '2d' );
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
    document.body.appendChild( container );
    // container.appendChild(canvas);    
    // canvasContext.strokeStyle = "#ffffff";
    canvasContext.lineWidth = 1;

    // NOTE: THIS RELIES ON THE MONKEYPATCH LIBRARY BEING LOADED FROM
    // Http://cwilso.github.io/AudioContext-MonkeyPatch/AudioContextMonkeyPatch.js
    // TO WORK ON CURRENT CHROME!!  But this means our code can be properly
    // spec-compliant, and work on Chrome, Safari and Firefox.

    audioContext = new AudioContext();

    // if we wanted to load audio files, etc., this is where we should do it.

    window.onorientationchange = resetCanvas;
    window.onresize = resetCanvas;

    requestAnimFrame(draw);    // start the drawing loop.

    timerWorker = new Worker("js/metronomeworker.js");

    timerWorker.onmessage = function(e) {
        if (e.data == "tick") {
            console.log("tick!");
            scheduler();
        }
        else
            console.log("message: " + e.data);
    };
    timerWorker.postMessage({"interval":lookahead});
}

window.addEventListener("load", init );
