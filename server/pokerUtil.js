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
     * Deal 2 random cards to each player. Remove dealt cards from original deck.
     * @param {Array} players - list of players that need to be dealt cards
     * @param {Array} deck - the current deck of cards containing all cards
     * @return {void}
     */
    dealHands: function(players, deck) {
        console.log('dealing hands...');
        for (let i = 1; i <= 2; i++) {
            for(let j = 0; j < players.length; j++) {
                var player = players[j];
                let randomCard = parseInt(Math.random() * deck.length);
                player.hand.push(deck[randomCard]);
                deck.splice(randomCard, 1);
            }  
        }
    }
}