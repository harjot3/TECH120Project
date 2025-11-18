import EventEmitter from 'events';
const eventEmitter = new EventEmitter();
console.log("shorts")

document.getElementById("timerButton").addEventListener("click", () => {
    eventEmitter.emit('toggleTimer');
});