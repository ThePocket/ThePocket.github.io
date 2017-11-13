var AudioContext = window.AudioContext 
    || window.webkitAudioContext 
    || false; 

var isPlaying = false;      
var startTime;              
var current16thNote;        
var tempo = 85;          
var volume = 0.2
var lookahead = 100.0;     
var scheduleAheadTime = 0.120;
var nextNoteTime = 0.0;     
var noteResolution = 2;     
var noteLength = 0.0200;    
var canvas,                 
    canvasContext;          
var last16thNoteDrawn = -1; 
var notesInQueue = [];      
var timerWorker = new Worker("js/metronomeworker.js");


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


function change_tempo(amount, tempo) {
    tempo = tempo + amount;
    return;
}


function decrease_tempo(tempo) {
    tempo = tempo - 1;
    console.log('decrease tempo')
    return tempo;
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
    eq.frequency.value = 500;
    eq2 = audioContext.createBiquadFilter();
    eq2.type = "lowpass";
    eq2.frequency.value = 2500;
    gainNode.connect(eq)
    eq.connect(eq2)
    eq2.connect(audioContext.destination);

    
    if (beatNumber % 16 === 0)   
        osc.frequency.value = 800;
    else if (beatNumber % 4 === 0 )    
        osc.frequency.value = 800	;
    else                       
        osc.frequency.value = 800;

    osc.start( time );
    osc.stop( time + noteLength );
}


function scheduler() {
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


function update_tempo_slider() {
    tempo = event.target.value; 
    document.getElementById('showTempo').innerText = tempo; document.getElementById('tempo').value = tempo;
}


function draw() {
    var currentNote = last16thNoteDrawn;
    var currentTime = audioContext.currentTime;

    while (notesInQueue.length && notesInQueue[0].time < currentTime) {
        currentNote = notesInQueue[0].note;
        notesInQueue.splice(0,1); 
    }
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

    audioContext = new AudioContext();

    window.onorientationchange = resetCanvas;
    window.onresize = resetCanvas;
    requestAnimFrame(draw);   
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
