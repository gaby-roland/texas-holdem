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

var publicGameList = {};
for (var i = 1; i <= 2; i++) {
    var publicGame = pokerUtil.createNewGame("publicGame" + i);
    publicGameList[publicGame.id] = publicGame;
}

var socketList = [];
var io = require('socket.io')(serv, {});
io.sockets.on('connection', function(socket) {
    logger.info('Socket with ID ' + socket.id + ' connected to the server.');
    var player = pokerUtil.createNewPlayer(socket.id);
    socket.player = player;
    addSocketToList(socket);

    socket.on('joinTable', function(data) {
        // TODO Validate input
        var table = data.table;
        if (!playerInsideValidGame(player)) {
            player.currentGame = "publicGame" + table;
            if (playerInsideValidGame(player)) {
                logger.info('Player ' + player.id + ' joined table publicGame1.');
            }
            else {
                logger.warn('Player ' + player.id + ' tried to join an invalid game.');
            }
        }
    });

    socket.on('leaveTable', function() {
        if (playerInsideValidGame(player)) {
            var game = publicGameList[player.currentGame];
            game.removePlayerFromTable(player);
        }
        player.currentGame = null;
        logger.info('Player ' + player.id + ' left the table.');
    });

    socket.on('startPlaying', function() {
        if (playerInsideValidGame(player)) {
            var game = publicGameList[player.currentGame];
            game.addPlayerToTable(player);
        }
    });

    socket.on('startSpectating', function() {
        if (playerInsideValidGame(player)) {
            var game = publicGameList[player.currentGame];
            game.removePlayerFromTable(player);
        }
        logger.info('Player ' + player.id + ' is spectating.');
   });

    socket.on('raise', function(data) {
        // TODO Validate input
        var amount = parseInt(data.amount);
        if (playerInsideValidGame(player)) {
            var game = publicGameList[player.currentGame];
            game.playerRaise(player, amount);
        }
    });

    socket.on('call', function() {
        if (playerInsideValidGame(player)) {
            var game = publicGameList[player.currentGame];
            game.playerCall(player);
        }
    });

    socket.on('check', function() {
        if (playerInsideValidGame(player)) {
            var game = publicGameList[player.currentGame];
            game.playerCheck(player);
        }
    });

    socket.on('fold', function() {
        if (playerInsideValidGame(player)) {
            var game = publicGameList[player.currentGame];
            game.playerFold(player);
        }
    });

    socket.on('disconnect', function() {
        if (playerInsideValidGame(player)) {
            var game = publicGameList[player.currentGame]
            game.removePlayerFromTable(player);
        }
        removeSocketFromList(socket);
        logger.info("Socket with ID " + socket.id + ' disconnected from the server.');
    });
});

setInterval(function() {
    sendInfoToClients()

    for (var gameId in publicGameList) {
        var game = publicGameList[gameId];
        var playerList = game.playerList;

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
        else if (game.inProgress) {
            game.concludeGame();
        }
    }
}, 1000/25);

function sendInfoToClients() {
    for(let i = 0; i < socketList.length; i++) {
        var players = [];
        var socket = socketList[i];
        var thisPlayer = socket.player;
        if (playerInsideValidGame(thisPlayer)) {
            var game = publicGameList[thisPlayer.currentGame];
            for(let j = 0; j < game.playerList.length; j++) {
                var thatPlayer = game.playerList[j];
                if (thisPlayer == thatPlayer) {
                    players.push({name: thatPlayer.name, color: "", hand: thatPlayer.cardsInHand, bank: thatPlayer.bank, onTable: thatPlayer.chipsOnTable, hasCards: true});
                }
                else{
                    players.push({name: thatPlayer.name, color: "gray", bank: thatPlayer.bank, onTable: thatPlayer.chipsOnTable, hasCards: true});
                }
            }

            socket.emit('players', {
                players: players
            });

            socket.emit('cards', {
                cards: game.communityCards
            });

            socket.emit('player_playing', {
                player: game.playerTurn
            });
        }
    }
}

function playerInsideValidGame(player) {
    var inGame = false;
    if (player.currentGame != null) {
        var game = publicGameList[player.currentGame];
        if (game != null) {
            inGame = true;
        }
        else {
            player.currentGame = null;
        }
    }
    return inGame;
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