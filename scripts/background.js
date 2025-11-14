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
const timerButton = document.getElement('timerButton');
timerButton.addEventListener('click', function(){

    console.log("button clicked!");
    
});
