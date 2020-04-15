const log4js = require('log4js');
const logger = log4js.getLogger();
logger.level = 'info';

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
     * Deal 1 card to each player until each player has 2 cards. Remove dealt cards from original deck.
     * @param {Array} players - list of players that need to be dealt cards
     * @param {Array} deck - the current shuffled deck of cards containing all cards
     * @return {void}
     */
    dealHands: function(players, deck) {
        logger.info("Dealing cards to players.");
        for (let i = 1; i <= 2; i++) {
            for(let j = 0; j < players.length; j++) {
                var player = players[j];
                var topCard = deck.shift();
                player.hand.push(topCard);
            }
        }
        logger.info("Cards have been dealt.");
    }
}