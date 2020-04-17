const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'info';

class Player {
    constructor(id) {
        this.id = id;
        this.name = id;
        this.bank = 1000;
        this.hand = [];
    }
}

class Game {
    constructor(players, dealerPosition, deck) {
        this.players = players;
        this.deck = deck;
        this.dealerPosition = dealerPosition;
        this.completedRounds = {started: false, flop: false, turn: false, river: false, concluded: false};
        this.communityCards = [];
        this.potAmount = 0;
    }

    get started() {
        return this.completedRounds.started;
    }

    get concluded() {
        return this.completedRounds.concluded;
    }

    /**
     * Deal 1 card to each player until each player has 2 cards. Remove dealt cards from original deck.
     */
    dealHands() {
        logger.info("Dealing cards to players.");
        for (let i = 1; i <= 2; i++) {
            for(let j = 0; j < this.players.length; j++) {
                var player = this.players[j];
                var topCard = this.deck.shift();
                player.hand.push(topCard);
            }
        }
        logger.info("Cards have been dealt.");
        this.completedRounds.started = true;
    }

    /**
     * Deal 3 cards (flop) on the table. Remove dealt cards from original deck.
     */
    dealFlop() {
        for (let i = 1; i <= 3; i++) {
            var topCard = this.deck.shift();
            this.communityCards.push(topCard);
        }
        this.completedRounds.flop = true;
    }

    /**
     * Deal 1 card (turn) on the table. Remove dealt card from original deck.
     */
    dealTurn() {
        var topCard = this.deck.shift();
        this.communityCards.push(topCard);
        this.completedRounds.turn = true;
    }

    /**
     * Deal 1 card (river) on the table. Remove dealt card from original deck.
     */
    dealRiver() {
        var topCard = this.deck.shift();
        this.communityCards.push(topCard);
        this.completedRounds.river = true;
    }
}

module.exports = {
    /**
     * Generate a new deck of cards containing all 13 values in 4 suits (52 total cards).
     * @return {Array} New deck of cards containing 52 cards.
     */
    generateNewShuffledDeck: function() {
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
    },

    /**
     * Create a new player.
     * @param {String} id player id, should match socket id of player
     * @return {Player} the new player
     */
    createNewPlayer: function(id) {
        return new Player(id);
    },

    /**
     * Start a new game containing a newly shuffled deck of card.
     * @param {Array} players list of players in the current game
     * @param {Array} dealerPosition the position of the player who is the current dealer
     * @return {Game} the new game
     */
    createNewGame: function(players, dealerPosition) {
        return new Game(players, dealerPosition, this.generateNewShuffledDeck());
    }
}