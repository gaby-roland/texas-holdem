const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'info';

class Player {
    constructor(id) {
        this.id = id;
        this.name = id;
        this.bank = 1000;

        this.chipsOnTable = 0;
        this.cardsInHand = [];
        this.playedTheirTurn = false;
        this.playingCurrentHand = false;
    }

    resetValues() {
        this.chipsOnTable = 0;
        this.cardsInHand = [];
        this.playedTheirTurn = false;
        this.playingCurrentHand = false;
    }
}

class Game {
    constructor(playerList) {
        this.playerList = playerList;
        this.currentDeck;
        this.dealerPosition;
        this.playerTurn;
        this.communityCards;
        this.potAmount;
        this.currentBet;
        this.completedRounds = {started: false, flop: false, turn: false, river: false, concluded: false};
    }

    resetGame() {
        this.currentDeck = generateNewShuffledDeck();
        this.communityCards = [];
        this.potAmount = 0;
        this.currentBet = 0;
        this.completedRounds = {started: false, flop: false, turn: false, river: false, concluded: false};

        if (this.dealerPosition == null) {
            this.dealerPosition = 0;
        }
        else {
            var nextDealer = this.dealerPosition + 1;
            this.dealerPosition = (nextDealer >= this.playerList.length) ? 0 : nextDealer;
        }

        this.playerTurn = this.dealerPosition + 3;
        if (this.playerTurn >= this.playerList.length) {
            this.playerTurn = this.playerTurn % this.playerList.length;
        }

        for(let j = 0; j < this.playerList.length; j++) {
            var player = this.playerList[j];
            player.resetValues();
            player.playingCurrentHand = true;
        }
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

    get bettingRoundCompleted() {
        var completed = true;
        for(let j = 0; j < this.playerList.length; j++) {
            if (this.playerList[j].playedTheirTurn == false) {
                completed = false;
                break;
            }
        }
        return completed;
    }

    get activePlayers() {
        var players = 0;
        for(let j = 0; j < this.playerList.length; j++) {
            if (this.playerList[j].playingCurrentHand) {
                players++;
            }
        }
        return players;
    }
    
    /**
     * Deal 1 card to each player until each player has 2 cards. Remove dealt cards from original deck.
     */
    dealHands() {
        logger.info("Dealing cards to players.");
        this.resetBettingRound();
        for (let i = 1; i <= 2; i++) {
            for(let j = 0; j < this.playerList.length; j++) {
                var player = this.playerList[j];
                var topCard = this.currentDeck.shift();
                player.cardsInHand.push(topCard);
            }
        }
        logger.info("Cards have been dealt.");
        this.completedRounds.started = true;
    }

    /**
     * Deal 3 cards (flop) on the table. Remove dealt cards from original deck.
     */
    dealFlop() {
        logger.info("Dealing the flop.");
        this.resetBettingRound();
        for (let i = 1; i <= 3; i++) {
            var topCard = this.currentDeck.shift();
            this.communityCards.push(topCard);
        }
        logger.info("The flop (3 cards) have been dealt.");
        this.completedRounds.flop = true;
    }

    /**
     * Deal 1 card (turn) on the table. Remove dealt card from original deck.
     */
    dealTurn() {
        logger.info("Dealing the turn.");
        this.resetBettingRound();
        var topCard = this.currentDeck.shift();
        this.communityCards.push(topCard);
        logger.info("The turn has been dealt.");
        this.completedRounds.turn = true;
    }

    /**
     * Deal 1 card (river) on the table. Remove dealt card from original deck.
     */
    dealRiver() {
        logger.info("Dealing the river.");
        this.resetBettingRound();
        var topCard = this.currentDeck.shift();
        this.communityCards.push(topCard);
        logger.info("The river has been dealt.");
        this.completedRounds.river = true;
    }

    /**
     * Finish the game. Reset player hand/bets in preparation for next game.
     */
    concludeGame() {
        logger.info("Game ended. Cleaning up.");
        this.completedRounds.concluded = true;
    }

    /**
     * Reset the betting round.
     */
    resetBettingRound() {
        for(let j = 0; j < this.playerList.length; j++) {
            this.playerList[j].playedTheirTurn = false;
        }
    }

    /**
     * Simply increment the player turn to allow next player to make a move.
     */
    nextPlayerTurn() {
        this.playerTurn++;
        if (this.playerTurn >= this.playerList.length) {
            this.playerTurn = 0;
        }
    }
}

/**
* Generate a new deck of cards containing all 13 values in 4 suits (52 total cards).
* @return {Array} New deck of cards containing 52 cards.
*/
function generateNewShuffledDeck() {
    var suits = ['S', 'H', 'C', 'D'];
    var values = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    var newDeck = [];
    for (let suit of suits) {
        for (let value of values) {
            newDeck.push({
                suit: suit,
                value: value
            })
        }
    }

    return newDeck.sort(() => Math.random() - 0.5);
}

module.exports = {
    /**
     * Create a new player.
     * @param {String} id player id, should match socket id of player
     * @return {Player} the new player
     */
    createNewPlayer: function(id) {
        return new Player(id);
    },

    /**
     * Start a new game instance.
     * @param {Array} players list of players in the current game
     * @return {Game} the new game
     */
    createNewGame: function(players) {
        return new Game(players);
    }
}