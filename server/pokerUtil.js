'use strict';
const database = require('./database');
const Hand = require('pokersolver').Hand;
const randomNumber = require('random-number-csprng');
const Promise = require('bluebird');
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'info';

class Player {
  constructor(user, balance) {
    this.user = user;
    this.originalBalance = balance;
    this.balance = balance;
    this.chipsOnTable = 0;
    this.cardsInHand = [];
    this.playedTheirTurn = false;
    this.playingCurrentHand = false;
    this.allIn = false;
  }

  resetGameParameters() {
    this.originalBalance = this.balance;
    this.chipsOnTable = 0;
    this.cardsInHand = [];
    this.playedTheirTurn = false;
    this.playingCurrentHand = false;
    this.allIn = false;
  }
}

class Game {
  constructor(id) {
    this.id = id;
    this.name;
    this.sockets = [];
    this.players = [];
    this.waitingList = [];
    this.userToPlayer = {};
    this.playerLimit = 2;
    this.smallBlind = 25;
    this.bigBlind = 50;
    this.minBuyIn = 1000;
    this.maxBuyIn = 5000;
    this.currentDeck;
    this.dealerPosition;
    this.playerTurn;
    this.communityCards = [];
    this.potAmount = 0;
    this.currentBet = 0;
    this.logForUsers = "";
    this.timerId;
    this.timeout = 30000;
    this.revealHands = false;
    this.completedRounds = { started: false, flop: false, turn: false, river: false, concluded: false };
  }

  get started() {
    return this.completedRounds.started;
  }

  get completedFlop() {
    return this.completedRounds.flop;
  }

  get completedTurn() {
    return this.completedRounds.turn;
  }

  get completedRiver() {
    return this.completedRounds.river;
  }

  get concluded() {
    return this.completedRounds.concluded;
  }

  get inProgress() {
    return this.started && !this.concluded;
  }

  /**
   * Returns true if every player currently playing has already played their turn.
   */
  get bettingRoundCompleted() {
    var completed = true;
    if (this.players.length == 0) {
      completed = false;
    }

    for (let j = 0; j < this.players.length; j++) {
      var player = this.players[j];
      if (player.playingCurrentHand && player.playedTheirTurn == false) {
        completed = false;
        break;
      }
    }
    return completed;
  }

  /**
  * Returns the number of players actively playing the current hand (e.g. hasn't folded).
  */
  get activePlayers() {
    var players = 0;
    for (let j = 0; j < this.players.length; j++) {
      if (this.players[j].playingCurrentHand) {
        players++;
      }
    }
    return players;
  }

  /**
  * Returns the number of players that have gone all-in (no remaining chips in the bank).
  */
  get allInPlayers() {
    var players = 0;
    for (let j = 0; j < this.players.length; j++) {
      if (this.players[j].allIn) {
        players++;
      }
    }
    return players;
  }

  /**
  * Small blind player is usually 1 position ahead of the dealer. Wrap around if needed.
  */
  get smallBlindPlayer() {
    var smallBlindIndex = this.dealerPosition + 1;
    if (smallBlindIndex >= this.players.length) {
      smallBlindIndex = smallBlindIndex % this.players.length;
    }
    return this.players[smallBlindIndex];
  }

  /**
  * Big blind player is usually 2 positions ahead of the dealer. Wrap around if needed.
  */
  get bigBlindPlayer() {
    var bigBlindIndex = this.dealerPosition + 2;
    if (bigBlindIndex >= this.players.length) {
      bigBlindIndex = bigBlindIndex % this.players.length;
    }
    return this.players[bigBlindIndex];
  }

  /**
  * Updates the state of the game.
  */
  updateGameState() {
    if (this.players.length >= 2) {
      if (!this.inProgress && !this.timerId) {
        this.resetGame();
        this.resetAllPlayers();

        this.completedRounds.started = true;
        generateNewShuffledDeck().then(function (newDeck) {
          this.currentDeck = newDeck;
          this.dealHands();

          if (this.smallBlindPlayer.balance <= this.smallBlind) {
            this.smallBlindPlayer.chipsOnTable = this.smallBlindPlayer.balance;
            this.smallBlindPlayer.balance = 0;
            this.smallBlindPlayer.allIn = true;
            this.logForUsers += 'Player ' + this.smallBlindPlayer.user.name + ' posted $' + this.smallBlindPlayer.chipsOnTable + ' small blind.\n';
          }
          else {
            this.smallBlindPlayer.chipsOnTable = this.smallBlind;
            this.smallBlindPlayer.balance -= this.smallBlind;
            this.logForUsers += 'Player ' + this.smallBlindPlayer.user.name + ' posted $' + this.smallBlind + ' small blind.\n';
          }

          if (this.bigBlindPlayer.balance <= this.bigBlind) {
            this.bigBlindPlayer.chipsOnTable = this.bigBlindPlayer.balance;
            this.bigBlindPlayer.balance = 0;
            this.bigBlindPlayer.allIn = true;
            this.logForUsers += 'Player ' + this.bigBlindPlayer.user.name + ' posted $' + this.bigBlindPlayer.chipsOnTable + ' big blind.\n';
          }
          else {
            this.bigBlindPlayer.chipsOnTable = this.bigBlind;
            this.bigBlindPlayer.balance -= this.bigBlind;
            this.logForUsers += 'Player ' + this.bigBlindPlayer.user.name + ' posted $' + this.bigBlind + ' big blind.\n';
          }

          this.currentBet = this.bigBlind;
          this.timerId = setTimeout(() => {
            this.removePlayerFromTable(this.players[this.playerTurn].user);
            this.timerId = null;
            this.updateGameState();
          }, this.timeout);
          this.sendInfoToClients();
        }.bind(this));
      }
      else if (this.activePlayers < 2) {
        this.roundUpBets()
        this.revealHands = true;
        this.timerId = setTimeout(() => {
          this.concludeGame();
          this.completedRounds.concluded = true;
          this.timerId = null;
          this.updateGameState();
        }, 5000);
      }
      else if (this.bettingRoundCompleted) {
        this.roundUpBets();
        if (this.activePlayers - this.allInPlayers > 1) {
          this.resetBettingRound()
        }

        if (!this.completedFlop) {
          this.dealFlop();
          this.completedRounds.flop = true;
        }
        else if (!this.completedTurn) {
          this.dealTurn();
          this.completedRounds.turn = true;
        }
        else if (!this.completedRiver) {
          this.dealRiver();
          this.completedRounds.river = true;
        }
        else {
          this.revealHands = true;
          this.timerId = setTimeout(() => {
            this.concludeGame();
            this.completedRounds.concluded = true;
            this.timerId = null;
            this.updateGameState()
          }, 5000);
        }
      }
    }
    else if (this.inProgress) {
      this.roundUpBets();
      this.concludeGame();
      this.completedRounds.concluded = true;
    }

    this.sendInfoToClients();
  }

  sendInfoToClients() {
    for (let i = 0; i < this.sockets.length; i++) {
      var players = [];
      var thisPlayer = null;
      var socket = this.sockets[i];
      for (let j = 0; j < this.players.length; j++) {
        var player = this.players[j];
        if (socket == player.user) {
          players.push({
            name: player.user.name,
            color: "",
            hand: player.cardsInHand,
            bank: player.balance,
            onTable: player.chipsOnTable,
            hasCards: true
          });

          thisPlayer = {
            name: player.user.name,
            chipsOnTable: player.chipsOnTable
          };
        }
        else {
          var playerHand = null;
          if (player.cardsInHand.length == 2) {
            if (this.revealHands) {
              playerHand = player.cardsInHand;
            }
            else {
              playerHand = [{ suit: "Hidden", value: null }, { suit: "Hidden", value: null }];
            }

          }
          players.push({
            name: player.user.name,
            color: "gray",
            hand: playerHand,
            bank: player.balance,
            onTable: player.chipsOnTable,
            hasCards: true
          });
        }
      }

      socket.emit('gameState', {
        players: players,
        thisPlayer: thisPlayer,
        communityCards: this.communityCards,
        playerTurn: this.playerTurn,
        currentBet: this.currentBet,
        inProgress: this.inProgress,
        log: this.logForUsers
      });
    }

    // Clear all user logs from games since they've been sent to users
    this.logForUsers = "";
  }

  /**
   * Deal 1 card to each player until each player has 2 cards. Remove dealt cards from original deck.
   */
  dealHands() {
    for (let i = 1; i <= 2; i++) {
      for (let j = 0; j < this.players.length; j++) {
        var player = this.players[j];
        var topCard = this.currentDeck.shift();
        player.cardsInHand.push(topCard);
      }
    }
    logger.info("Cards have been dealt to players.");
  }

  /**
   * Deal 3 cards (flop) on the table. Remove dealt cards from original deck.
   */
  dealFlop() {
    var flopStr = "";
    for (let i = 1; i <= 3; i++) {
      var topCard = this.currentDeck.shift();
      this.communityCards.push(topCard);
      flopStr += topCard.value + topCard.suit + " ";
    }
    logger.info("The flop (3 cards) have been dealt: " + flopStr);
  }

  /**
   * Deal 1 card (turn) on the table. Remove dealt card from original deck.
   */
  dealTurn() {
    var topCard = this.currentDeck.shift();
    this.communityCards.push(topCard);
    logger.info("The turn has been dealt: " + topCard.value + topCard.suit);
  }

  /**
   * Deal 1 card (river) on the table. Remove dealt card from original deck.
   */
  dealRiver() {
    logger.info("Dealing the river.");
    var topCard = this.currentDeck.shift();
    this.communityCards.push(topCard);
    logger.info("The river has been dealt: " + topCard.value + topCard.suit);
  }

  /**
  * Player raised the bet on the current hand.
  */
  playerRaise(user, amount) {
    if (user.id in this.userToPlayer) {
      var player = this.userToPlayer[user.id];
      if (this.playerCanPlay(player)) {
        if (this.currentBet < player.chipsOnTable + amount) {
          if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
          }

          var maxBet = player.balance + player.chipsOnTable;
          for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].balance + this.players[i].chipsOnTable < maxBet) {
              maxBet = this.players[i].balance + this.players[i].chipsOnTable;
            }
          }
          if (amount > maxBet - player.chipsOnTable) {
            amount = maxBet - player.chipsOnTable;
          }

          if (amount == player.balance) {
            logger.info("Player " + player.user.name + ' went all-in with $' + (player.chipsOnTable + player.balance) + '.');
            this.logForUsers += 'Player ' + player.user.name + ' went all-in with $' + (player.chipsOnTable + player.balance) + '.\n';
            amount = player.balance;
            player.allIn = true;
          }
          else {
            logger.info("Player " + player.user.name + ' raised to $' + (player.chipsOnTable + amount) + '.');
            this.logForUsers += "Player " + player.user.name + ' raised to $' + (player.chipsOnTable + amount) + '.\n';
          }
          this.currentBet = player.chipsOnTable + amount;
          player.chipsOnTable = this.currentBet;
          player.balance -= amount;

          this.resetBettingRound();
          player.playedTheirTurn = true;
          this.nextPlayerTurn();
        }
      }
    }
  }

  /**
  * Player called the bet on the current hand.
  */
  playerCall(user) {
    if (user.id in this.userToPlayer) {
      var player = this.userToPlayer[user.id];
      if (this.playerCanPlay(player)) {
        if (this.currentBet > player.chipsOnTable) {
          if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
          }

          var amount;
          if ((this.currentBet - player.chipsOnTable) >= player.balance) {
            amount = player.balance;
            player.allIn = true;
            logger.info("Player " + player.user.name + ' called and went all-in with $' + (player.chipsOnTable + amount) + '.');
            this.logForUsers += "Player " + player.user.name + ' called (all-in) with $' + (player.chipsOnTable + amount) + '.\n';
          }
          else {
            amount = (this.currentBet - player.chipsOnTable);
            logger.info("Player " + player.user.name + ' called $' + (player.chipsOnTable + amount) + '.');
            this.logForUsers += "Player " + player.user.name + ' called $' + (player.chipsOnTable + amount) + '.\n';
          }

          player.balance -= amount;
          player.chipsOnTable += amount;
          player.playedTheirTurn = true;
          this.nextPlayerTurn();
        }
      }
    }
  }

  /**
  * Player checked the current hand.
  */
  playerCheck(user) {
    if (user.id in this.userToPlayer) {
      var player = this.userToPlayer[user.id];
      if (this.playerCanPlay(player)) {
        if (this.currentBet == player.chipsOnTable) {
          if (this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
          }

          logger.info("Player " + player.user.name + ' checked.');
          this.logForUsers += "Player " + player.user.name + ' checked.\n';
          player.playedTheirTurn = true;
          this.nextPlayerTurn();
        }
      }
    }
  }

  /**
  * Player folded the current hand.
  */
  playerFold(user) {
    if (user.id in this.userToPlayer) {
      var player = this.userToPlayer[user.id];
      if (this.playerCanPlay(player)) {
        if (this.timerId) {
          clearTimeout(this.timerId);
          this.timerId = null;
        }

        logger.info("Player " + player.user.name + ' folded.');
        this.logForUsers += "Player " + player.user.name + ' folded.\n';
        player.cardsInHand = [];
        player.playedTheirTurn = true;
        player.playingCurrentHand = false;
      }
    }
  }

  /**
   * Finish the game. Determine winner and reset player hand/bets in preparation for next game.
   */
  concludeGame() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    logger.info("Game ended.");
    if (this.activePlayers == 1) {
      for (let i = 0; i < this.players.length; i++) {
        var player = this.players[i];
        if (player.playingCurrentHand) {
          logger.info("Player " + player.user.name + ' won $' + this.potAmount);
          this.logForUsers += "Player " + player.user.name + ' won $' + this.potAmount + '.\n';
          player.balance += this.potAmount;
          database.incrementUserWins(player.user.handshake.session.userId);
        }
        var change = player.originalBalance - player.balance;
        if (change != 0) {
          database.updateUserBalance(player.user.handshake.session.userId, change);
          player.user.wallet += change;
        }
      }
    }
    else {
      var competingPlayers = [];
      var hands = [];
      for (let i = 0; i < this.players.length; i++) {
        var player = this.players[i];
        if (player.playingCurrentHand) {
          competingPlayers.push(player);
          hands.push(Hand.solve(getPlayerFullHand(player.cardsInHand, this.communityCards)));
        }
      }

      var winningHands = Hand.winners(hands);
      if (winningHands.length == 1) {
        for (let i = 0; i < hands.length; i++) {
          if (hands[i] == winningHands[0]) {
            logger.info("Player " + competingPlayers[i].user.name + " won $" + this.potAmount + " with: " + winningHands[0].descr);
            this.logForUsers += "Player " + competingPlayers[i].user.name + ' won $' + this.potAmount + " with: " + winningHands[0].descr + '.\n';
            competingPlayers[i].balance += this.potAmount;
            database.incrementUserWins(competingPlayers[i].user.handshake.session.userId);
          }
          else {
            database.incrementUserLosses(competingPlayers[i].user.handshake.session.userId);
          }
        }
      }
      else {
        var splitPot = Math.ceil(this.potAmount / winningHands.length);
        logger.info("Game tied. Splitting $" + this.potAmount + " with " + winningHands.length + " players.");
        for (let i = 0; i < winningHands.length; i++) {
          for (let j = 0; j < hands.length; j++) {
            if (hands[j] == winningHands[i]) {
              logger.info("Player " + competingPlayers[j].user.name + " won $" + splitPot + " with: " + winningHands[i].descr);
              this.logForUsers += "Player " + competingPlayers[j].user.name + " won $" + splitPot + " with: " + winningHands[i].descr + '.\n';
              competingPlayers[j].balance += splitPot;
              database.incrementUserDraws(competingPlayers[j].user.handshake.session.userId);
            }
            else {
              database.incrementUserLosses(competingPlayers[j].user.handshake.session.userId);
            }
          }
        }
      }
      for (let i = 0; i < this.players.length; i++) {
        var player = this.players[i];
        if (player.balance == 0) {
          this.removePlayerFromTable(player.user);
          continue;
        }
        var change = player.originalBalance - player.balance;
        if (change != 0) {
          database.updateUserBalance(player.user.handshake.session.userId, change);
          player.user.wallet += change;
        }
      }
    }
    this.communityCards = [];
    this.resetAllPlayers();
  }

  /**
  * Reset the hand. This includes resetting the pot, current bet, game state, and emptying the deck of cards.
  */
  resetGame() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    this.currentDeck = [];
    this.communityCards = [];
    this.potAmount = 0;
    this.currentBet = 0;
    this.revealHands = false;
    this.completedRounds = { started: false, flop: false, turn: false, river: false, concluded: false };

    if (this.dealerPosition == null) {
      this.dealerPosition = 0;
    }
    else {
      var nextDealer = this.dealerPosition + 1;
      this.dealerPosition = (nextDealer >= this.players.length) ? 0 : nextDealer;
    }

    this.playerTurn = this.dealerPosition + 3;
    if (this.playerTurn >= this.players.length) {
      this.playerTurn = this.playerTurn % this.players.length;
    }

    this.resetAllPlayers();
  }

  /**
  * Reset each player's state and toggle on their playingCurrentHand variable.
  */
  resetAllPlayers() {
    for (let j = 0; j < this.players.length; j++) {
      var player = this.players[j];
      player.resetGameParameters();
      player.playingCurrentHand = true;
    }
  }

  /**
   * Determine if a player can make a legal move.
   */
  playerCanPlay(player) {
    return this.inProgress
      && player.playingCurrentHand == true
      && player.playedTheirTurn == false
      && player == this.players[this.playerTurn];
  }

  /**
   * Reset the betting round. Should be called when someone raises.
   */
  resetBettingRound() {
    for (let j = 0; j < this.players.length; j++) {
      this.players[j].playedTheirTurn = false;
    }
  }

  /**
   * Round up all the bets. Should be called at the end of a betting round.
   */
  roundUpBets() {
    for (let j = 0; j < this.players.length; j++) {
      var player = this.players[j];
      this.potAmount += player.chipsOnTable;
      player.chipsOnTable = 0;
    }
    this.currentBet = 0;
  }

  /**
   * Simply increment the player turn to allow next player to make a move.
   */
  nextPlayerTurn() {
    this.playerTurn++;
    if (this.playerTurn >= this.players.length) {
      this.playerTurn = 0;
    }

    // Create timeout for next player
    this.timerId = setTimeout(() => {
      this.removePlayerFromTable(this.players[this.playerTurn].user);
      this.timerId = null;
      this.updateGameState();
    }, this.timeout);
  }

  /**
  * Add a user to the table or waiting list if maximum player capacity is reached.
  */
  addPlayerToTable(user) {
    if (!(user.id in this.userToPlayer)) {
      var player
      if (user.wallet > 1000) {
        player = new Player(user, 1000);
      }
      else {
        player = new Player(user, user.wallet);
      }

      this.userToPlayer[user.id] = player;
      if (this.players.length < this.playerLimit) {
        this.players.push(player);
        logger.info('Player ' + player.user.name + ' joined the table.');
        this.logForUsers += 'Player ' + player.user.name + ' joined the table.\n';
      }
      else {
        this.waitingList.push(player);
        logger.info('Player ' + player.user.name + ' added to queue.');
        this.logForUsers += 'Player ' + player.user.name + ' is waiting to join.\n';
      }
    }
  }

  /**
  * Remove user from the table and waiting list.
  */
  removePlayerFromTable(user) {
    if (user.id in this.userToPlayer) {
      var player = this.userToPlayer[user.id];
      delete this.userToPlayer[user.id];
      if (this.inProgress) {
        this.potAmount += player.chipsOnTable;
        database.incrementUserLosses(player.user.handshake.session.userId);
        var change = player.originalBalance - player.balance;
        if (change != 0) {
          database.updateUserBalance(player.user.handshake.session.userId, change);
          player.user.wallet += change;
        }
      }
      player.resetGameParameters();
      for (let i = 0; i < this.players.length; i++) {
        if (this.players[i] == player) {
          this.players.splice(i, 1);
          break;
        }
      }
      for (let i = 0; i < this.waitingList.length; i++) {
        if (this.waitingList[i] == player) {
          this.waitingList.splice(i, 1);
          break;
        }
      }
      logger.info('Player ' + player.user.name + ' left the table.');
      this.logForUsers += 'Player ' + player.user.name + ' left the table.\n';
      this.checkQueue();
    }
  }

  /**
  * Move players from the waiting list to the table if there is an opening.
  */
  checkQueue() {
    while (this.players.length < this.playerLimit && this.waitingList.length > 0) {
      var firstPlayerInQueue = this.waitingList.shift();
      this.players.push(firstPlayerInQueue);
      logger.info('Player ' + firstPlayerInQueue.user.name + ' moved from queue to table.');
      this.logForUsers += 'Player ' + firstPlayerInQueue.user.name + ' joined the table.\n';
    }
  }

  /**
  * Add a connection socket to the game.
  * @param {SocketIO.Socket} socket object representing a connection
  */
  addSocketToGame(socket) {
    if (!this.sockets.includes(socket)) {
      this.sockets.push(socket);
    }
  }

  /**
  * Remove a connection socket from the game.
  * @param {SocketIO.Socket} socket object representing a connection
  */
  removeSocketFromGame(socket) {
    for (let i = 0; i < this.sockets.length; i++) {
      if (this.sockets[i] == socket) {
        this.sockets.splice(i, 1);
        break;
      }
    }
  }
}

/**
* Generate a new deck of cards containing all 13 values in 4 suits (52 total cards).
* Shuffles the new deck using a cryptographically secure pseudo-random number generator.
* @return {Array} New deck of cards containing 52 cards.
*/
async function generateNewShuffledDeck() {
  var suits = ['S', 'H', 'C', 'D'];
  var values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var newDeck = [];
  for (let suit of suits) {
    for (let value of values) {
      newDeck.push({
        suit: suit,
        value: value
      })
    }
  }

  const promises = [];
  // Asynchronously generate an array of random numbers using a CSPRNG
  for (let i = newDeck.length - 1; i > 0; i--) {
    promises.push(randomNumber(0, i));
  }

  const randomNumbers = await Promise.all(promises);

  // Apply durstenfeld shuffle with previously generated random numbers
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = randomNumbers[newDeck.length - i - 1];
    const temp = newDeck[i];
    newDeck[i] = newDeck[j];
    newDeck[j] = temp;
  }

  return newDeck;
}

/**
 * Get a player's full hand (2 cards in hand + 5 on the table).
 * This returns the list required for the poker solver module to evaluate all the hands.
 * @param {Array} playerCards list containing 2 player cards (value and suit)
 * @param {Array} communityCards list containing 5 community cards (value and suit)
 * @return {Array} list with 7 cards in the correct format for the poker solver module
 */
function getPlayerFullHand(playerCards, communityCards) {
  var fullHand = [];
  for (let j = 0; j < playerCards.length; j++) {
    var value = playerCards[j].value;
    if (value == '10') {
      value = 'T'
    }
    var suit = playerCards[j].suit.toLowerCase();
    fullHand.push(value + suit);
  }

  for (let j = 0; j < communityCards.length; j++) {
    var value = communityCards[j].value;
    if (value == '10') {
      value = 'T'
    }
    var suit = communityCards[j].suit.toLowerCase();
    fullHand.push(value + suit);
  }
  return fullHand;
}

module.exports = {
  /**
   * Start a new game instance.
   * @param {String} id unique identifier for the game instance
   * @return {Game} the new game instance
   */
  createNewGame: function (id) {
    return new Game(id);
  }
}