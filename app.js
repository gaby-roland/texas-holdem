'use strict';
var secureUtil = require('./server/secureUtil');
var pokerUtil = require('./server/pokerUtil');
var helmet = require('helmet');
var log4js = require('log4js');

var logger = log4js.getLogger();
logger.level = 'info';

var express = require('express');
var app = express();
app.use(helmet());

var serv = require('http').Server(app);

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/client/index.html');
});
app.use(express.static(__dirname + '/client'));

// Listen to port 2000
serv.listen(2000);
logger.info("Server started.");

class User {
  constructor(id) {
    this.id = id;
    this.name = id;
    this.wallet = 10000;
    this.currentGame;
  }
}

var publicGameList = {};
for (var i = 1; i <= 2; i++) {
  var publicGame = pokerUtil.createNewGame("publicGame" + i);
  publicGameList[publicGame.id] = publicGame;
}

var socketList = [];
var io = require('socket.io')(serv, {});
io.sockets.on('connection', function (socket) {
  logger.info('Socket with ID ' + socket.id + ' connected to the server.');
  var user = new User(socket.id);
  socket.user = user;
  addSocketToList(socket);

  socket.on('joinTable', async (data) => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (secureUtil.validateNumberInput(data.table)) {
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
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + user.id + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('rateLimit', {
        wait: rejection.msBeforeNext
      });
    }
  });

  socket.on('leaveTable', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (userInsideValidGame(user)) {
        var game = publicGameList[user.currentGame];
        game.removePlayerFromTable(user);
      }
      user.currentGame = null;
      logger.info('User ' + user.id + ' left the table.');
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + user.id + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('rateLimit', {
        wait: rejection.msBeforeNext
      });
    }
  });

  socket.on('startPlaying', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (userInsideValidGame(user)) {
        var game = publicGameList[user.currentGame];
        game.addPlayerToTable(user);
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + user.id + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('rateLimit', {
        wait: rejection.msBeforeNext
      });
    }
  });

  socket.on('startSpectating', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (userInsideValidGame(user)) {
        var game = publicGameList[user.currentGame];
        game.removePlayerFromTable(user);
      }
      logger.info('User ' + user.id + ' is spectating.');
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + user.id + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('rateLimit', {
        wait: rejection.msBeforeNext
      });
    }
  });

  socket.on('raise', async (data) => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (secureUtil.validateNumberInput(data.amount)) {
        var amount = parseInt(data.amount);
        if (userInsideValidGame(user)) {
          var game = publicGameList[user.currentGame];
          game.playerRaise(user, amount);
        }
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + user.id + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('rateLimit', {
        wait: rejection.msBeforeNext
      });
    }
  });

  socket.on('call', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (userInsideValidGame(user)) {
        var game = publicGameList[user.currentGame];
        game.playerCall(user);
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + user.id + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('rateLimit', {
        wait: rejection.msBeforeNext
      });
    }
  });

  socket.on('check', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (userInsideValidGame(user)) {
        var game = publicGameList[user.currentGame];
        game.playerCheck(user);
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + user.id + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('rateLimit', {
        wait: rejection.msBeforeNext
      });
    }
  });

  socket.on('fold', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (userInsideValidGame(user)) {
        var game = publicGameList[user.currentGame];
        game.playerFold(user);
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + user.id + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('rateLimit', {
        wait: rejection.msBeforeNext
      });
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
          var playerHand = null;
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