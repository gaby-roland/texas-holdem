const { generateNewShuffledDeck } = require('../server/pokerUtil');

describe('generateNewShuffledDeck', () => {
    it('should generate a new complete shuffled deck of cards', () => {
        const deck = generateNewShuffledDeck();
        expect(deck).toHaveLength(52);

        var suits = ['S', 'H', 'C', 'D'];
        var values = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        for (let suit of suits) {
            for (let value of values) {
                expect(deck).toContainEqual(expect.objectContaining({suit: suit, value: value}));
            }
        }
    });

    it('should verify shuffled decks are not the same', () => {
        const deck1 = generateNewShuffledDeck();
        const deck2 = generateNewShuffledDeck();

        expect(deck1).toHaveLength(52);
        expect(deck2).toHaveLength(52);

        expect(deck1).not.toEqual(deck2);
    });
});