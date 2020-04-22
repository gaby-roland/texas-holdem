const Hand = require('pokersolver').Hand;
const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'info';

class User {
    constructor(id) {
        this.id = id;
        this.name = id;
        this.wallet = 10000;
        this.currentGame;
    }
}

class Player {
    constructor(user) {
        this.user = user;
        this.balance = 1000;
        this.chipsOnTable = 0;
        this.cardsInHand = [];
        this.playedTheirTurn = false;
        this.playingCurrentHand = false;
    }

    resetGameParameters() {
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
        this.communityCards;
        this.potAmount;
        this.currentBet;
        this.completedRounds = {started: false, flop: false, turn: false, river: false, concluded: false};
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
        if (this.players.length == 0) {
            completed = false;
        }

        for(let j = 0; j < this.players.length; j++) {
            var player = this.players[j];
            if (player.playingCurrentHand && player.playedTheirTurn == false) {
                completed = false;
                break;
            }
        }
        return completed;
    }

    get activePlayers() {
        var players = 0;
        for(let j = 0; j < this.players.length; j++) {
            if (this.players[j].playingCurrentHand) {
                players++;
            }
        }
        return players;
    }

    get smallBlindPlayer() {
        var smallBlindIndex = this.dealerPosition + 1;
        if (smallBlindIndex >= this.players.length) {
            smallBlindIndex = smallBlindIndex % this.players.length;
        }
        return this.players[smallBlindIndex];
    }

    get bigBlindPlayer() {
        var bigBlindIndex = this.dealerPosition + 2;
        if (bigBlindIndex >= this.players.length) {
            bigBlindIndex = bigBlindIndex % this.players.length;
        }
        return this.players[bigBlindIndex];
    }

    updateGameState() {
        if (this.players.length >= 2) {
            if (!this.inProgress) {
                this.resetGame();
                this.dealHands();

                this.smallBlindPlayer.chipsOnTable = this.smallBlind;
                this.bigBlindPlayer.chipsOnTable = this.bigBlind;
                this.currentBet = this.bigBlind;
            }
    
            if (this.bettingRoundCompleted) {
                this.roundUpBets();
                if (!this.completedFlop) {
                    this.dealFlop();
                }
                else if (!this.completedTurn) {
                    this.dealTurn();
                }
                else if (!this.completedRiver) {
                    this.dealRiver();
                }
                else {
                    this.concludeGame();
                }
            }
        }
        else if (this.inProgress) {
            this.concludeGame();
        }
    }
    
    /**
     * Deal 1 card to each player until each player has 2 cards. Remove dealt cards from original deck.
     */
    dealHands() {
        logger.info("Dealing cards to players.");
        for (let i = 1; i <= 2; i++) {
            for(let j = 0; j < this.players.length; j++) {
                var player = this.players[j];
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
        var topCard = this.currentDeck.shift();
        this.communityCards.push(topCard);
        logger.info("The river has been dealt.");
        this.completedRounds.river = true;
    }

    playerRaise(user, amount) {
        if (user.id in this.userToPlayer) {
            var player = this.userToPlayer[user.id];
            if (this.playerCanPlay(player)) {
                if (this.currentBet < player.chipsOnTable + amount) {
                    this.currentBet = player.chipsOnTable + amount;
                    logger.info("Player " + player.user.id + ' raised to ' + this.currentBet + '.');
                    player.chipsOnTable = player.chipsOnTable + amount;
                        
                    this.resetBettingRound();
                    player.playedTheirTurn = true;
                    this.nextPlayerTurn();
                }
            }
        }
    }

    playerCall(user) {
        if (user.id in this.userToPlayer) {
            var player = this.userToPlayer[user.id];
            if (this.playerCanPlay(player)) {
                if (this.currentBet > player.chipsOnTable) {
                    logger.info("Player " + player.user.id + ' called.');
                    player.chipsOnTable = this.currentBet;
                    player.playedTheirTurn = true;
                    this.nextPlayerTurn();
                }
            }
        }
    }

    playerCheck(user) {
        if (user.id in this.userToPlayer) {
            var player = this.userToPlayer[user.id];
            if (this.playerCanPlay(player)) {
                if (this.currentBet == player.chipsOnTable)
                {
                    logger.info("Player " + player.user.id + ' checked.');
                    player.playedTheirTurn = true;
                    this.nextPlayerTurn();
                }
            }
        }
    }

    playerFold(user) {
        if (user.id in this.userToPlayer) {
            var player = this.userToPlayer[user.id];
            if (this.playerCanPlay(player)) {
                logger.info("Player " + player.user.id + ' folded.');
                player.playedTheirTurn = true;
                player.playingCurrentHand = false;
                this.concludeGame();
            }
        }
    }

    /**
     * Finish the game. Determine winner and reset player hand/bets in preparation for next game.
     */
    concludeGame() {
        logger.info("Game ended.");
        var winner;
        if (this.activePlayers < 2) {
            for(let j = 0; j < this.players.length; j++) {
                var player = this.players[j];
                if (player.playingCurrentHand) {
                    winner = player;
                    break;
                }
            }
        }
        else {
            var hand1 = Hand.solve(getPlayerFullHand(this.players[0].cardsInHand, this.communityCards));
            var hand2 = Hand.solve(getPlayerFullHand(this.players[1].cardsInHand, this.communityCards));

            var winnerHand = Hand.winners([hand1, hand2]);
            if (winnerHand.length == 1) {
                if (winnerHand[0] == hand1) {
                    logger.info("Player " + this.players[0].user.id + " won the game.");
                    winner = this.players[0];
                }
                else {
                    logger.info("Player " + this.players[1].user.id + " won the game.");
                    winner = this.players[1];
                }
            }
            else {
                logger.info("Game tied. Splitting the pot.");
                for(let j = 0; j < this.players.length; j++) {
                    this.players[j].balance = this.players[j].balance + (this.potAmount / 2);
                }
                this.completedRounds.concluded = true;
                return;
            }
        }
        
        winner.balance = winner.balance + this.potAmount;
        this.completedRounds.concluded = true;
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
            this.dealerPosition = (nextDealer >= this.players.length) ? 0 : nextDealer;
        }

        this.playerTurn = this.dealerPosition + 3;
        if (this.playerTurn >= this.players.length) {
            this.playerTurn = this.playerTurn % this.players.length;
        }

        for(let j = 0; j < this.players.length; j++) {
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
        for(let j = 0; j < this.players.length; j++) {
            this.players[j].playedTheirTurn = false;
        }
    }

    /**
     * Round up all the bets. Should be called at the end of a betting round.
     */
    roundUpBets() {
        for(let j = 0; j < this.players.length; j++) {
            var player = this.players[j];
            player.balance = player.balance - player.chipsOnTable;
            this.potAmount = this.potAmount + player.chipsOnTable;
            player.chipsOnTable = 0;
            player.playedTheirTurn = false;
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
    }

    addPlayerToTable(user) {
        if (!(user.id in this.userToPlayer)) {
            var player = new Player(user);
            this.userToPlayer[user.id] = player;
            if (this.players.length < this.playerLimit) {
                this.players.push(player);
                logger.info('Player ' + player.user.id + ' joined the table.');
            }
            else {
                this.waitingList.push(player);
                logger.info('Player ' + player.user.id + ' added to queue.');
            }
        }
    }

    removePlayerFromTable(user) {
        if (user.id in this.userToPlayer) {
            var player = this.userToPlayer[user.id];
            delete this.userToPlayer[user.id];
            player.resetGameParameters();
            for (let i = 0; i < this.players.length; i++)
            {
                if (this.players[i] == player)
                {
                    this.players.splice(i, 1);
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
            this.checkQueue();
        }
    }

    checkQueue() {
        while (this.players.length < this.playerLimit && this.waitingList.length > 0) {
            var firstPlayerInQueue = this.waitingList.shift();
            this.players.push(firstPlayerInQueue);
            logger.info('Player ' + firstPlayerInQueue.user.id + ' moved from queue to table.');
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
     * Create a new user.
     * @param {String} id user identifier, should match socket id of user
     * @return {User} the new user
     */
    createNewUser: function(id) {
        return new User(id);
    },

    /**
     * Start a new game instance.
     * @param {String} id unique identifier for the game instance
     * @return {Game} the new game instance
     */
    createNewGame: function(id) {
        return new Game(id);
    }
}