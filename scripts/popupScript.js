console.log("popup! again")

document.addEventListener("DOMContentLoaded", function() {
    var timerButton = document.getElementById("timerButton");
    timerButton.addEventListener("click", function() {
        console.log("button clicked!!");
        eventEmitter.emit("timerButtonClicked");
    });
});