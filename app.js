var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use(express.static(__dirname + '/client'));

// Listen to port 2000
serv.listen(2000);
console.log("Server started.");

var SOCKET_LIST = {};
var PLAYER_LIST = {};

// Define player object
var Player = function(id) {
    var self = {
        id:id,
        name:id,
        bank:1000
    }
    return self;
}

var suits = ['S', 'H', 'C', 'D'];
var values = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
var allCards = [];
for (let suit of suits) {
    for (let value of values) {
        allCards.push({
            suit: suit,
            value: value
        })
    }
}

var fives = [];
for (let i = 0; i < 5; i++) {
    let rand_id = parseInt(Math.random() * allCards.length)
    fives.push(allCards[rand_id])
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
    socket.id = Math.floor(Math.random() * Math.floor(1000)); // Random number between 0 and 1000
    SOCKET_LIST[socket.id] = socket;

    var player = Player(socket.id);
    PLAYER_LIST[socket.id] = player;
    console.log('Player ' + socket.id + ' connected.');

    socket.on('disconnect', function() {
        delete SOCKET_LIST[socket.id];
        delete PLAYER_LIST[socket.id];
        console.log('Player ' + socket.id + ' disconnected.');
    });
});

setInterval(function() {
    var packet = [];
    for(var id in PLAYER_LIST) {
        var player = PLAYER_LIST[id];
        packet.push({name: player.name, bank: player.bank, onTable: 0, hasCards: false});
    }
    for(var i in SOCKET_LIST) {
        var socket = SOCKET_LIST[i];
        socket.emit('players', {
            players: packet
        });
        socket.emit('cards', {
            cards: fives
        });
    }
}, 1000/25);