export class Controller {
  constructor(g, v) {
    this.game = g;
    this.view = v;

    this.CELL_SIZE = document.getElementById("gameboard").offsetHeight / 5;

    this.view.update(g.getGameState());
    this.view.resetSplits();
    this.game.onMove(this.processMove);
    this.game.onLose(this.processLoss);

    this.correct = new Audio("assets/correct.mp3");
    this.success = new Audio("assets/next.mp3");
    this.fail = new Audio("assets/fail.mp3");

    this.clicked = false;
    this.allowClick = true;

    this.startTimer = null;
    this.elapsedTime = 0;
    this.restart_button = document.getElementById("restart");
    this.submit_button = document.getElementById("submit-score");

    this.fetchLeaderboard();

    if (this.submit_button) {
      this.submit_button.style.display = "none";
      this.submit_button.addEventListener("click", () => this.submitScore());
    }

    let restart = document.getElementById("restart");
    restart.addEventListener(
      "click",
      () => {
        this.restart_button.classList.remove("button-glow");
        if (this.submit_button) this.submit_button.style.display = "none";
        this.clicked = false;
        g.setupNewGame();
        v.update(g.getGameState());
        clearInterval(this.startTimer);
        v.setTime("00:00");
        v.setErrors(false);
        v.resetSplits();
        this.startTimer = Date.now();
      },
      false
    );
    let container = document.getElementById("gameboard-col");

    container.addEventListener(
      "mousedown",
      (e) => {
        let canvas = document.getElementById("gameboard");
        let elemLeft =
          container.offsetLeft + container.clientLeft + canvas.offsetLeft;
        let elemTop =
          container.offsetTop + container.clientTop + canvas.offsetTop;
        if (this.allowClick) {
          if (this.game.gameState.over) {
            // this.clicked = false;
            // g.setupNewGame();
            // v.update(g.getGameState());
            // v.setStatus("Started");
          } else {
            let x = e.pageX - elemLeft;
            let y = e.pageY - elemTop;
            if (x <= 500 && y <= 500 && x >= 0 && y >= 0) {
              let x_index = Math.floor(x / this.CELL_SIZE);
              let y_index = Math.floor(y / this.CELL_SIZE);
              if (!this.clicked) {
                if (this.game.isFirst(x_index, y_index)) {
                  if (
                    this.game.gameState.score === 0 &&
                    this.game.gameState.errors == 0
                  ) {
                    this.start();
                  }
                  this.clicked = true;
                  v.hideNumbers();
                  this.view.drawCell(x_index, y_index);
                  this.game.move(x_index, y_index);
                }
              } else if (!this.game.isClicked(x_index, y_index)) {
                this.view.drawCell(x_index, y_index);
                this.game.move(x_index, y_index);
              }
            }
          }
        }
      },
      true
    );
  }

  processMove = (status) => {
    if (status === "correct") {
      this.correct.play();
      // move correct
      this.next += 1;
    } else if (status == "next") {
      this.success.play();
      this.clicked = false;
      setTimeout(() => {
        this.game.nextPuzzle();
        this.view.update(this.game.getGameState());
        this.view.updateSplits(
          Math.floor(this.elapsedTime / 1000),
          this.game.gameState.score
        );
      }, 80);
    }
  };

  processLoss = (status) => {
    this.fail.play();
    this.clicked = false;
    this.view.setErrors(true);
    if (status === "over") {
      clearInterval(this.startTimer);
      this.startTimer = null;
      this.view.update(this.game.getGameState(), true);
      this.restart_button.classList.add("button-glow");
      if (this.submit_button) this.submit_button.style.display = "inline-block";
    } else if (status === "continue") {
      this.clicked = false;
      this.view.update(this.game.getGameState(), true);
      this.game.nextPuzzle();
      this.allowClick = false;
      setTimeout(() => {
        this.view.update(this.game.getGameState(), false);
        this.allowClick = true;
      }, 400);
    }
  };

  getRandomColor() {
    return "#000000".replace(/0/g, function () {
      return (~~(Math.random() * 16)).toString(16);
    });
  }

  start() {
    let startTime = Date.now();
    this.startTimer = setInterval((start) => {
      this.elapsedTime = Date.now() - startTime;
      this.view.setTime(this.timeToString(this.elapsedTime));
      let secondsElapsed = Math.floor(this.elapsedTime / 1000);
      this.view.updateSplits(secondsElapsed, this.game.gameState.score);
    }, 1000);
  }

  timeToString(time) {
    let diffInHrs = time / 3600000;
    let hh = Math.floor(diffInHrs);
    let diffInMin = (diffInHrs - hh) * 60;
    let mm = Math.floor(diffInMin);
    let diffInSec = (diffInMin - mm) * 60;
    let ss = Math.floor(diffInSec);
    let formattedMM = mm.toString().padStart(2, "0");
    let formattedSS = ss.toString().padStart(2, "0");

    return `${formattedMM}:${formattedSS}`;
  }

  async fetchLeaderboard() {
    try {
      let res = await fetch("/api/leaderboard?limit=10");
      if (res.ok) {
        let data = await res.json();
        this.view.updateLeaderboard(data.scores);
      }
    } catch (e) {
      // ignore
    }
  }

  async submitScore() {
    if (this.submit_button && this.submit_button.style.display === "none") return;
    let name = prompt("Enter your name for the leaderboard:");
    if (!name || !name.trim()) return;

    try {
      let tokenRes = await fetch("/api/score-token");
      if (!tokenRes.ok) return;
      let tokenData = await tokenRes.json();

      let res = await fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenData.token,
          name: name.trim(),
          score: this.game.gameState.score,
        }),
      });

      if (res.ok) {
        if (this.submit_button) this.submit_button.style.display = "none";
        this.fetchLeaderboard();
      } else {
        let errData = await res.json();
        alert(errData.error || "Failed to submit score");
      }
    } catch (e) {
      alert("Error submitting score");
    }
  }
}
