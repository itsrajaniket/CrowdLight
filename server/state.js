// server/state.js
// Holds the current state of the show for late joiners and reconnecting phones.

let currentState = {
  cmd: null // Last command object broadcasted: { name, params, executeAt }
};

module.exports = {
  getCurrentState() {
    return currentState;
  },
  setCurrentState(cmd) {
    currentState.cmd = cmd;
  },
  resetState() {
    currentState.cmd = null;
  }
};
