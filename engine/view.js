const TEXT_COLOR = "#c73669";
const HIDE_COLOR = "#c9c4b1";
const BOARD_COLOR = "#ebe6d5";
const BORDER_COLOR = "#c08f8f";
const LOSS_COLOR = "#8f3232";
const CLICK_COLOR = "#f7f7d0";

export class View {
  constructor() {
    let canvas_element = document.createElement("canvas");
    canvas_element.setAttribute("id", "gameboard");
    canvas_element.height = 500;
    canvas_element.width = 500;
    document.getElementById("gameboard-container").appendChild(canvas_element);

    this.CELL_SIZE = Math.floor(
      document.getElementById("gameboard").offsetHeight / 5
    );
    this.BOARD_SIZE = document.getElementById("gameboard").offsetHeight;

    let gameboard = document.getElementById("gameboard");
    let canvas = gameboard.getContext("2d");
    canvas.font = "50px Clear Sans";
    canvas.textAlign = "center";
    canvas.textBaseline = "middle";
    canvas.fillStyle = "black";
    this.canvas = canvas;
  }

  update(gameState, over) {
    let score = document.getElementById("score");
    score.textContent = gameState.score;

    if (!over) {
      document.getElementById("gameboard").style.backgroundColor = BOARD_COLOR;
    } else {
      document.getElementById("gameboard").style.backgroundColor = LOSS_COLOR;
    }

    this.canvas.clearRect(0, 0, this.BOARD_SIZE, this.BOARD_SIZE);
    this.drawGrid(false);
    this.drawNumbers(gameState);
  }

  hideNumbers() {
    this.canvas.clearRect(0, 0, this.BOARD_SIZE, this.BOARD_SIZE);
    this.drawGrid(true);
  }

  drawNumbers(gameState) {
    this.canvas.fillStyle = TEXT_COLOR;
    let index = 0;
    for (
      let i = this.CELL_SIZE / 2;
      i <= this.BOARD_SIZE;
      i += this.CELL_SIZE
    ) {
      for (
        let j = this.CELL_SIZE / 2;
        j <= this.BOARD_SIZE;
        j += this.CELL_SIZE
      ) {
        let num = gameState.board[index];
        if (num != 0) {
          this.canvas.fillText(num, j, i);
        }
        index++;
      }
    }
  }

  drawGrid(bool) {
    if (bool) {
      document.getElementById("gameboard").style.backgroundColor = HIDE_COLOR;
    }
    this.canvas.lineWidth = 8.5;
    this.canvas.strokeStyle = BORDER_COLOR;
    this.canvas.beginPath();
    for (
      let i = this.CELL_SIZE;
      i <= this.BOARD_SIZE - 1;
      i += this.CELL_SIZE
    ) {
      for (
        let j = this.CELL_SIZE;
        j <= this.BOARD_SIZE - 1;
        j += this.CELL_SIZE
      ) {
        this.canvas.moveTo(i, 0);
        this.canvas.lineTo(i, this.BOARD_SIZE);
        this.canvas.moveTo(0, j);
        this.canvas.lineTo(this.BOARD_SIZE, j);
      }
    }
    this.canvas.stroke();
  }

  setErrors(bool) {
    let errors = document.getElementById("errors");
    if (bool) {
      errors.textContent += "X";
    } else {
      errors.textContent = "";
    }
  }

  drawCell(x, y) {
    this.canvas.fillStyle = CLICK_COLOR;
    this.canvas.beginPath();
    this.canvas.rect(
      x * this.CELL_SIZE,
      y * this.CELL_SIZE,
      this.CELL_SIZE,
      this.CELL_SIZE
    );
    this.canvas.fill();
    this.drawGrid(true);
  }

  setTime(str) {
    let el = document.getElementById("elapsed");
    el.innerHTML = str;
  }

  updateSplits(time, score) {
    if (time === 30) {
      let second_30 = document.getElementById("split-2");
      second_30.innerHTML = score;
    } else if (time === 60) {
      let second_60 = document.getElementById("split-3");
      second_60.innerHTML = score;
    } else if (time === 120) {
      let second_120 = document.getElementById("split-4");
      second_120.innerHTML = score;
    } else if (time === 180) {
      let second_180 = document.getElementById("split-5");
      second_180.innerHTML = score;
    } else {
      let current = document.getElementById("split-1");
      current.innerHTML = score;
    }
  }

  resetSplits() {
    let current = document.getElementById("split-1");
    let second_30 = document.getElementById("split-2");
    let second_60 = document.getElementById("split-3");
    let second_120 = document.getElementById("split-4");
    let second_180 = document.getElementById("split-5");
    current.innerHTML = "-";
    second_30.innerHTML = "-";
    second_60.innerHTML = "-";
    second_120.innerHTML = "-";
    second_180.innerHTML = "-";
  }

  updateLeaderboard(scores) {
    let container = document.getElementById("leaderboard-list");
    if (!container) return;
    if (!scores || scores.length === 0) {
      container.innerHTML = '<div class="row"><div class="col text-muted">-</div></div>';
      return;
    }
    let html = scores.map((item, idx) => `
      <div class="row leaderboard-entry">
        <div class="col-1 text-left leaderboard-rank">${idx + 1}.</div>
        <div class="col-6 text-left text-truncate leaderboard-name">${this.escapeHtml(item.name)}</div>
        <div class="col-2 text-right leaderboard-score">${item.score}</div>
      </div>
    `).join("");
    container.innerHTML = html;
  }

  escapeHtml(str) {
    let div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}
