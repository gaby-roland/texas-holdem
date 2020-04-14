var pokerUtil = require('./server/pokerUtil');

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

// -----------------------------------------------------
var socketList = [];
var playerList = [];
var waitingList = [];
var HAND_IN_PROGRESS = false;

var originalDeck = pokerUtil.generateNewShuffledDeck();

// Define player object
var Player = function(id) {
    var self = {
        id:id,
        name:id,
        bank:1000,
        hand: []
    }
    return self;
}

var fives = [];
for (let i = 0; i < 5; i++) {
    let rand_id = parseInt(Math.random() * originalDeck.length)
    fives.push(originalDeck[rand_id])
}

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
    socket.id = Math.floor(Math.random() * Math.floor(1000)); // Random number between 0 and 1000
    console.log('Socket ' + socket.id + ' connected.');
    addSocketToList(socket);

    var player = Player(socket.id);
    socket.on('play', function() {
        addPlayerToTable(player);
    });

    socket.on('spectate', function() {
        removePlayerFromTable(player);
        checkQueue();
        console.log('Player ' + player.id + ' is spectating');
   });

    socket.on('disconnect', function() {
        removeSocketFromList(socket);
        removePlayerFromTable(player);
        checkQueue();
        console.log('Player ' + player.id + ' disconnected.');
    });
});

var currentDeck = [];
setInterval(function() {
    if (playerList.length >= 2 && !HAND_IN_PROGRESS) {
        HAND_IN_PROGRESS = true;
        currentDeck = originalDeck.slice();
        pokerUtil.dealHands(playerList, currentDeck);
    }

    for(let i = 0; i < socketList.length; i++) {
        var packet = [];
        var socket = socketList[i];
        for(let j = 0; j < playerList.length; j++) {
            var player = playerList[j];
            if (player.id == socket.id) {
                packet.push({name: player.name, color: "", hand: player.hand, bank: player.bank, onTable: 999, hasCards: false});
            }
            else{
                packet.push({name: player.name, color: "gray", bank: player.bank, onTable: 999, hasCards: false});
            }
        }
        socket.emit('players', {
            players: packet
        });
        socket.emit('cards', {
            cards: fives
        });
    }
}, 1000/25);

function addSocketToList(socket) {
    if (!socketList.includes(socket))
    {
        socketList.push(socket);
    }
}

function removeSocketFromList(socket) {
    for (let i = 0; i < socketList.length; i++)
    {
        if (socketList[i] == socket)
        {
            socketList.splice(i, 1);
            break;
        }
    }
}

function addPlayerToTable(player) {
    if (!playerList.includes(player) && !waitingList.includes(player)) {
        if (playerList.length < 8) {
            player.name = "Player" + (playerList.length + 1);
            playerList.push(player);
            console.log('Player ' + player.id + ' joined the table');
        }
        else {
            waitingList.push(player);
            console.log('Player ' + player.id + ' added to the queue');
        }
    }
}

function removePlayerFromTable(player) {
    player.name = player.id;
    for (let i = 0; i < playerList.length; i++)
    {
        if (playerList[i] == player)
        {
            playerList.splice(i, 1);
            break;
        }
    }
    for (let i = 0; i < waitingList.length; i++)
    {
        if (waitingList[i] == player)
        {
            waitingList.splice(i, 1);
            break;
        }
    }
}

function checkQueue() {
    while (playerList.length < 8 && waitingList.length > 0) {
        var firstPlayerInQueue = waitingList.shift();
        firstPlayerInQueue.name = "Player" + (playerList.length + 1);
        playerList.push(firstPlayerInQueue);
        console.log('Player ' + firstPlayerInQueue.id + ' moved from queue to table');
    }
}