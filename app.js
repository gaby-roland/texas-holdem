var pokerUtil = require('./server/pokerUtil');
var log4js = require('log4js');
var logger = log4js.getLogger();
logger.level = 'info';

var express = require('express');
var app = express();
var serv = require('http').Server(app);

app.get('/', function (req, res) {
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
io.sockets.on('connection', function (socket) {
  logger.info('Socket with ID ' + socket.id + ' connected to the server.');
  var user = pokerUtil.createNewUser(socket.id);
  socket.user = user;
  addSocketToList(socket);

  socket.on('joinTable', function (data) {
    // TODO Validate input
    var table = data.table;
    if (!userInsideValidGame(user)) {
      user.currentGame = "publicGame" + table;
      if (userInsideValidGame(user)) {
        logger.info('User ' + user.id + ' joined table publicGame1.');
      }
      else {
        logger.warn('User ' + user.id + ' tried to join an invalid game.');
      }
    }
  });

  socket.on('leaveTable', function () {
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame];
      game.removePlayerFromTable(user);
    }
    user.currentGame = null;
    logger.info('User ' + user.id + ' left the table.');
  });

  socket.on('startPlaying', function () {
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame];
      game.addPlayerToTable(user);
    }
  });

  socket.on('startSpectating', function () {
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame];
      game.removePlayerFromTable(user);
    }
    logger.info('User ' + user.id + ' is spectating.');
  });

  socket.on('raise', function (data) {
    // TODO Validate input
    var amount = parseInt(data.amount);
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame];
      game.playerRaise(user, amount);
    }
  });

  socket.on('call', function () {
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame];
      game.playerCall(user);
    }
  });

  socket.on('check', function () {
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame];
      game.playerCheck(user);
    }
  });

  socket.on('fold', function () {
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame];
      game.playerFold(user);
    }
  });

  socket.on('disconnect', function () {
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame]
      game.removePlayerFromTable(user);
    }
    removeSocketFromList(socket);
    logger.info("Socket with ID " + socket.id + ' disconnected from the server.');
  });
});

setInterval(function () {
  sendInfoToClients()

  for (var gameId in publicGameList) {
    var game = publicGameList[gameId];
    game.updateGameState();
  }
}, 1000 / 10);

function sendInfoToClients() {
  for (let i = 0; i < socketList.length; i++) {
    var players = [];
    var socket = socketList[i];
    var user = socket.user;
    if (userInsideValidGame(user)) {
      var game = publicGameList[user.currentGame];
      for (let j = 0; j < game.players.length; j++) {
        var player = game.players[j];
        if (user == player.user) {
          players.push({
            name: player.user.name,
            color: "",
            hand: player.cardsInHand,
            bank: player.balance,
            onTable: player.chipsOnTable,
            hasCards: true
          });
        }
        else {
          var playerHand;
          if (player.playingCurrentHand == true) {
            playerHand = [{ suit: "Hidden", value: null }, { suit: "Hidden", value: null }];
          }
          players.push({
            name: player.user.name,
            color: "gray",
            hand: playerHand,
            bank: player.balance,
            onTable: player.chipsOnTable,
            hasCards: true
          });
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

/**
* Check if a user is inside a valid game. User can be playing or spectating.
* @param {User} user object representing a user
* @return {Boolean} true if user is currently inside a valid game, false otherwise
*/
function userInsideValidGame(user) {
  var inGame = false;
  if (user.currentGame != null && publicGameList[user.currentGame] != null) {
    inGame = true;
  }
  else {
    user.currentGame = null;
  }
  return inGame;
}

/**
* Add a connecting socket to the list containing all sockets.
* @param {SocketIO.Socket} socket object representing a connection
*/
function addSocketToList(socket) {
  if (!socketList.includes(socket)) {
    socketList.push(socket);
  }
}

/**
* Remove a disconnecting socket from the list containing all sockets.
* @param {SocketIO.Socket} socket object representing a connection
*/
function removeSocketFromList(socket) {
  for (let i = 0; i < socketList.length; i++) {
    if (socketList[i] == socket) {
      socketList.splice(i, 1);
      break;
    }
  }
}