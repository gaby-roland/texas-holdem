var pokerUtil = require('./server/pokerUtil');
var log4js = require('log4js');
var logger = log4js.getLogger();
logger.level = 'info';

var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function(req, res) {
    res.sendFile(__dirname + '/client/index.html');
});
app.use(express.static(__dirname + '/client'));

// Listen to port 2000
serv.listen(2000);
logger.info("Server started.");

var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
    logger.info('Socket with ID ' + socket.id + ' connected to the server.');
    addSocketToList(socket);

    var player = Player(socket.id);
    socket.on('play', function() {
        addPlayerToTable(player);
    });

    socket.on('spectate', function() {
        removePlayerFromTable(player);
        logger.info('Player with ID ' + player.id + ' is spectating.');
        checkQueue();
   });

    socket.on('disconnect', function() {
        removeSocketFromList(socket);
        removePlayerFromTable(player);
        logger.info("Socket with ID " + socket.id + ' disconnected from the server.');
        checkQueue();
    });
});

// -----------------------------------------------------
var socketList = [];
var playerList = [];
var waitingList = [];
var HAND_IN_PROGRESS = false;
var bigBlindPlayer = 0;
var playerLimit = 2;

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

var currentDeck = [];
setInterval(function() {
    if (playerList.length >= 2 && !HAND_IN_PROGRESS) {
        HAND_IN_PROGRESS = true;
        currentDeck = pokerUtil.generateNewShuffledDeck();
        pokerUtil.dealHands(playerList, currentDeck);
    }

    sendInfoToClients()
}, 1000/25);

function sendInfoToClients() {
    for(let i = 0; i < socketList.length; i++) {
        var packet = [];
        var socket = socketList[i];
        for(let j = 0; j < playerList.length; j++) {
            var player = playerList[j];
            if (player.id == socket.id) {
                packet.push({name: player.name, color: "", hand: player.hand, bank: player.bank, onTable: 999, hasCards: true});
            }
            else{
                packet.push({name: player.name, color: "gray", bank: player.bank, onTable: 999, hasCards: true});
            }
        }
        socket.emit('players', {
            players: packet
        });
        socket.emit('cards', {
            cards: fives
        });
    }
}

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
        if (playerList.length < playerLimit) {
            player.name = "Player" + (playerList.length + 1);
            playerList.push(player);
            logger.info('Player with ID ' + player.id + ' joined the table.');
        }
        else {
            waitingList.push(player);
            logger.info('Player with ID ' + player.id + ' added to queue.');
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
    while (playerList.length < playerLimit && waitingList.length > 0) {
        var firstPlayerInQueue = waitingList.shift();
        firstPlayerInQueue.name = "Player" + (playerList.length + 1);
        playerList.push(firstPlayerInQueue);
        logger.info('Player with ID ' + firstPlayerInQueue.id + ' moved from queue to table.');
    }
}