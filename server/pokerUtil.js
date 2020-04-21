const Hand = require('pokersolver').Hand;
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'info';

class Player {
    constructor(id) {
        this.id = id;
        this.name = id;
        this.bank = 1000;

        this.currentGame;
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
    constructor(id) {
        this.id = id;
        this.name;
        this.playerList = [];
        this.waitingList = [];
        this.playerLimit = 2;
        this.smallBlind = 10;
        this.bigBlind = 20;
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
        if (this.playerList.length == 0) {
            completed = false;
        }

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

    get smallBlindPlayer() {
        var smallBlindIndex = this.dealerPosition + 1;
        if (smallBlindIndex >= this.playerList.length) {
            smallBlindIndex = smallBlindIndex % this.playerList.length;
        }
        return this.playerList[smallBlindIndex];
    }

    get bigBlindPlayer() {
        var bigBlindIndex = this.dealerPosition + 2;
        if (bigBlindIndex >= this.playerList.length) {
            bigBlindIndex = bigBlindIndex % this.playerList.length;
        }
        return this.playerList[bigBlindIndex];
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
        this.smallBlindPlayer.chipsOnTable = this.smallBlind;
        this.bigBlindPlayer.chipsOnTable = this.bigBlind;
        this.currentBet = this.bigBlind;
        logger.info("Cards have been dealt.");
        this.completedRounds.started = true;
    }

    /**
     * Deal 3 cards (flop) on the table. Remove dealt cards from original deck.
     */
    dealFlop() {
        logger.info("Dealing the flop.");
        this.roundUpBets();
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
        this.roundUpBets();
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
        this.roundUpBets();
        var topCard = this.currentDeck.shift();
        this.communityCards.push(topCard);
        logger.info("The river has been dealt.");
        this.completedRounds.river = true;
    }

    playerRaise(player, amount) {
        if (this.playerCanPlay(player)) {
            if (this.currentBet < player.chipsOnTable + amount) {
                this.currentBet = player.chipsOnTable + amount;
                logger.info("Player " + player.id + ' raised to ' + this.currentBet + '.');
                player.chipsOnTable = player.chipsOnTable + amount;
                    
                this.resetBettingRound();
                player.playedTheirTurn = true;
                this.nextPlayerTurn();
            }
        }
    }

    playerCall(player) {
        if (this.playerCanPlay(player)) {
            if (this.currentBet > player.chipsOnTable) {
                logger.info("Player " + player.id + ' called.');
                player.chipsOnTable = this.currentBet;
                player.playedTheirTurn = true;
                this.nextPlayerTurn();
            }
        }
    }

    playerCheck(player) {
        if (this.playerCanPlay(player)) {
            if (this.currentBet == player.chipsOnTable)
            {
                logger.info("Player " + player.id + ' checked.');
                player.playedTheirTurn = true;
                this.nextPlayerTurn();
            }
        }
    }

    playerFold(player) {
        if (this.playerCanPlay(player)) {
            logger.info("Player " + player.id + ' folded.');
            player.playedTheirTurn = true;
            player.playingCurrentHand = false;
            this.concludeGame();
        }
    }

    /**
     * Finish the game. Determine winner and reset player hand/bets in preparation for next game.
     */
    concludeGame() {
        logger.info("Game ended.");
        this.roundUpBets();
        var winner;
        if (this.activePlayers < 2) {
            for(let j = 0; j < this.playerList.length; j++) {
                var player = this.playerList[j];
                if (player.playingCurrentHand) {
                    winner = player;
                    break;
                }
            }
        }
        else {
            var hand1 = Hand.solve(getPlayerFullHand(this.playerList[0].cardsInHand, this.communityCards));
            var hand2 = Hand.solve(getPlayerFullHand(this.playerList[1].cardsInHand, this.communityCards));

            var winnerHand = Hand.winners([hand1, hand2]);
            if (winnerHand.length == 1) {
                if (winnerHand[0] == hand1) {
                    logger.info("Player " + this.playerList[0].id + " won the game.");
                    winner = this.playerList[0];
                }
                else {
                    logger.info("Player " + this.playerList[1].id + " won the game.");
                    winner = this.playerList[1];
                }
            }
            else {
                logger.info("Game tied. Splitting the pot.");
                for(let j = 0; j < this.playerList.length; j++) {
                    this.playerList[j].bank = this.playerList[j].bank + (this.potAmount / 2);
                }
                this.completedRounds.concluded = true;
                return;
            }
        }
        
        winner.bank = winner.bank + this.potAmount;
        this.completedRounds.concluded = true;
    }

    /**
     * Determine if a player can make a legal move.
     */
    playerCanPlay(player) {
        return this.inProgress && player == this.playerList[this.playerTurn];
    }

    /**
     * Reset the betting round. Should be called when someone raises.
     */
    resetBettingRound() {
        for(let j = 0; j < this.playerList.length; j++) {
            this.playerList[j].playedTheirTurn = false;
        }
    }

    /**
     * Round up all the bets. Should be called at the end of a betting round.
     */
    roundUpBets() {
        for(let j = 0; j < this.playerList.length; j++) {
            var player = this.playerList[j];
            player.bank = player.bank - player.chipsOnTable;
            this.potAmount = this.potAmount + player.chipsOnTable;
            this.currentBet = 0;
            player.chipsOnTable = 0;
            player.playedTheirTurn = false;
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

    addPlayerToTable(player) {
        if (!this.playerList.includes(player) && !this.waitingList.includes(player)) {
            if (this.playerList.length < this.playerLimit) {
                player.name = "Player" + (this.playerList.length + 1);
                this.playerList.push(player);
                logger.info('Player ' + player.id + ' joined the table.');
            }
            else {
                this.waitingList.push(player);
                logger.info('Player ' + player.id + ' added to queue.');
            }
        }
    }

    removePlayerFromTable(player) {
        player.name = player.id;
        player.resetValues();
        for (let i = 0; i < this.playerList.length; i++)
        {
            if (this.playerList[i] == player)
            {
                this.playerList.splice(i, 1);
                break;
            }
        }
        for (let i = 0; i < this.waitingList.length; i++)
        {
            if (this.waitingList[i] == player)
            {
                this.waitingList.splice(i, 1);
                break;
            }
        }

        while (this.playerList.length < this.playerLimit && this.waitingList.length > 0) {
            var firstPlayerInQueue = this.waitingList.shift();
            firstPlayerInQueue.name = "Player" + (this.playerList.length + 1);
            this.playerList.push(firstPlayerInQueue);
            logger.info('Player ' + firstPlayerInQueue.id + ' moved from queue to table.');
        }
    }
}

/**
* Generate a new deck of cards containing all 13 values in 4 suits (52 total cards).
* @return {Array} New deck of cards containing 52 cards.
*/
function generateNewShuffledDeck() {
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

    return newDeck.sort(() => Math.random() - 0.5);
}

function getPlayerFullHand(playerCards, communityCards) {
    var fullHand = [];
    for(let j = 0; j < playerCards.length; j++) {
        var value = playerCards[j].value;
        if (value == '10') {
            value = 'T'
        }
        var suit = playerCards[j].suit.toLowerCase();
        fullHand.push(value + suit);
    }

    for(let j = 0; j < communityCards.length; j++) {
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