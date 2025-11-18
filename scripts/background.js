import EventEmitter from 'events';
const eventEmitter = new EventEmitter();

var seconds = 0;
var timerOn = false;

function stopwatch() {
    if (timerOn)
    {
        seconds++;
        console.log("Stopwatch: " + seconds + " seconds");
    }
}

setInterval(stopwatch, 1000);

eventEmitter.on('toggleTimer', () => {
    timerOn = !timerOn;
    console.log("button pressed timer!!");
});