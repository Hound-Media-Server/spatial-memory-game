import { Game } from "./engine/game.js";
import { View } from "./engine/view.js";
import { Controller } from "./engine/controller.js";

document.addEventListener("DOMContentLoaded", function () {
  let v = new View();
  let g = new Game();
  let c = new Controller(g, v);
});
