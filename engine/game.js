const BOARD_SIZE = 5;
const MAX_ERRORS = 5;

export class Game {
  constructor() {
    this.size = BOARD_SIZE;
    this.moveListeners = [];
    this.loseListeners = [];
    this.setupNewGame();
    this.board2D = this.getRows();
  }

  setupNewGame() {
    this.gameState = {
      score: 0,
      over: false,
      next: 1,
      errors: 0,
      tuples: [],
      started: false,
    };
    this.gameState.board = Array(this.size * this.size).fill(0);
    this.gameState.board = this.generateBoard();
  }

  nextPuzzle() {
    this.gameState.next = 1;
    this.gameState.tuples = [];
    this.gameState.board = Array(this.size * this.size).fill(0);
    this.gameState.board = this.generateBoard();
  }

  loadGame(gameState) {
    this.gameState = gameState;
    this.board2D = this.getRows();
  }

  getGameState() {
    return this.gameState;
  }

  /*
    Generate 2 or 4 cell on empty space
  */
  generateBoard() {
    let arr = this.gameState.board.slice();
    for (let i = 0; i < this.getWinTarget(this.gameState.score); i++) {
      arr[i] = i + 1;
    }
    this.shuffleArray(arr);
    return arr;
  }

  /*
    Returns an array of rows for the board
    Should only be called by constructor
    https://stackoverflow.com/questions/8495687/split-array-into-chunks
  */
  getRows() {
    let rows = [];
    for (let i = 0; i < this.size * this.size; i += this.size) {
      rows.push(this.gameState.board.slice(i, i + this.size));
    }
    return rows;
  }

  getCols() {
    return this.transpose(this.board2D);
  }

  /*
    Remove all instances of a value from an array
    https://stackoverflow.com/questions/20733207/loop-to-remove-an-element-in-array-with-multiple-occurrences
  */
  removeAll(array, val) {
    return array.filter(function (element) {
      return element !== val;
    });
  }

  /*
    update board from this.board2D
  */
  updateBoard() {
    this.gameState.board = Array.prototype.concat.apply([], this.board2D);
    return this.gameState.board;
  }

  move(x, y) {
    if (!this.gameState.started) {
      this.gameState.started = true;
    }
    if (this.getRows()[y][x] == this.gameState.next) {
      if (this.getRows()[y][x] == this.getWinTarget(this.gameState.score)) {
        // next puzzle
        this.gameState.score += 1;
        this.updateListeners("move", "next");
      } else {
        this.gameState.next += 1;
        this.gameState.tuples.push([x, y]);
        this.updateListeners("move", "correct");
      }
    } else {
      this.gameState.errors += 1;
      if (this.gameState.errors === MAX_ERRORS) {
        this.gameState.over = true;
        this.updateListeners("loss", "over");
      } else {
        this.updateListeners("loss", "continue");
      }
    }
  }

  getWinTarget(score) {
    // difficulty curve function : 3-3-3-4-4-4-4-5-5-5-5-5, etc.
    let temp = Math.ceil(-0.5 + Math.sqrt(2 * (score + 4) - 0.25));
    if (score <= 2) {
      return 3;
    }
    if (temp > 25) {
      return 25;
    }
    return temp;
  }

  string2D(arr) {
    let ret = "";
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr[0].length; j++) {
        ret += arr[i][j].toString().padStart(5, " ");
      }
      ret += "\n";
    }
    return ret;
  }

  toString() {
    return (
      "score: " + this.gameState.score + "\n" + this.string2D(this.board2D)
    );
  }

  onMove(callback) {
    this.moveListeners.push(callback);
  }

  onLose(callback) {
    this.loseListeners.push(callback);
  }

  updateListeners(event, statusMessage) {
    if (event === "move") {
      this.moveListeners.forEach((element) => {
        element(statusMessage);
      });
    } else if (event === "loss") {
      this.loseListeners.forEach((element) => {
        element(statusMessage);
      });
    }
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  isClicked(x, y) {
    let flag = false;
    this.gameState.tuples.map((e) => {
      if (e[0] == x && e[1] == y) {
        flag = true;
      }
    });
    return flag;
  }

  isFirst(x, y) {
    return this.getRows()[y][x] === 1;
  }
}
