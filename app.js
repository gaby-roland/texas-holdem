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

var socketList = [];
var playerList = [];
var waitingList = [];
var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
    logger.info('Socket with ID ' + socket.id + ' connected to the server.');
    addSocketToList(socket);

    var player = pokerUtil.createNewPlayer(socket.id);
    socket.on('play', function() {
        addPlayerToTable(player);
    });

    socket.on('spectate', function() {
        removePlayerFromTable(player);
        logger.info('Player ' + player.id + ' is spectating.');
        checkQueue();
   });

    socket.on('bet', function(data) {
        if (game.inProgress && player == game.playerList[game.playerTurn]) {
            var amount = parseInt(data.amount);
            if (game.currentBet < player.chipsOnTable + amount) {
                game.currentBet = player.chipsOnTable + amount;
                logger.info("Player " + player.id + ' raised to ' + game.currentBet + '.');
                player.chipsOnTable = player.chipsOnTable + amount;
                
                game.resetBettingRound();
                player.playedTheirTurn = true;
                game.nextPlayerTurn();
            }
        }
    });

    socket.on('call', function(data) {
        if (game.inProgress && player == game.playerList[game.playerTurn]) {
            if (game.currentBet > player.chipsOnTable) {
                logger.info("Player " + player.id + ' called.');
                player.chipsOnTable = game.currentBet;
                player.playedTheirTurn = true;
                game.nextPlayerTurn();
            }
        }
    });

    socket.on('check', function(data) {
        if (game.inProgress && player == game.playerList[game.playerTurn]) {
            if (game.currentBet == player.chipsOnTable)
            {
                logger.info("Player " + player.id + ' checked.');
                player.playedTheirTurn = true;
                game.nextPlayerTurn();
            }
        }
    });

    socket.on('fold', function(data) {
        console.log('player folded');
    });

    socket.on('disconnect', function() {
        removeSocketFromList(socket);
        removePlayerFromTable(player);
        logger.info("Socket with ID " + socket.id + ' disconnected from the server.');
        checkQueue();
    });
});

// -----------------------------------------------------

var playerLimit = 2;
var game = pokerUtil.createNewGame(playerList);
setInterval(function() {
    sendInfoToClients()

    if (playerList.length >= 2) {
        if (!game.inProgress) {
            game.resetGame();
            game.dealHands();
        }

        if (game.bettingRoundCompleted) {
            if (!game.completedFlop) {
                game.dealFlop();
            }
            else if (!game.completedTurn) {
                game.dealTurn();
            }
            else if (!game.completedRiver) {
                game.dealRiver();
            }
            else {
                game.concludeGame();
            }
        }
    }
}, 1000/25);

function sendInfoToClients() {
    for(let i = 0; i < socketList.length; i++) {
        var packet = [];
        var socket = socketList[i];
        for(let j = 0; j < playerList.length; j++) {
            var player = playerList[j];
            if (player.id == socket.id) {
                packet.push({name: player.name, color: "", hand: player.cardsInHand, bank: player.bank, onTable: player.chipsOnTable, hasCards: true});
            }
            else{
                packet.push({name: player.name, color: "gray", bank: player.bank, onTable: player.chipsOnTable, hasCards: true});
            }
        }
        socket.emit('players', {
            players: packet
        });
        if (game != null) {
            socket.emit('cards', {
                cards: game.communityCards
            });
            socket.emit('player_playing', {
                player: game.playerTurn
            });
        }
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
            logger.info('Player ' + player.id + ' joined the table.');
        }
        else {
            waitingList.push(player);
            logger.info('Player ' + player.id + ' added to queue.');
        }
    }
}

function removePlayerFromTable(player) {
    player.name = player.id;
    player.resetValues();
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
        logger.info('Player ' + firstPlayerInQueue.id + ' moved from queue to table.');
    }
}