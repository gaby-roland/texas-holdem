'use strict';
const express = require('express');
const session = require('express-session');
const socketIOSession = require('express-socket.io-session');
const helmet = require('helmet');
const log4js = require('log4js');
const secureUtil = require('./server/secureUtil');
const database = require('./server/database');
const argon2 = require('argon2');

const logger = log4js.getLogger();
logger.level = 'info';

const {
  APPLICATION_PORT = 2000,
  NODE_ENV = 'development',
  SESSION_NAME = 'sid',
  SESSION_SECRET = 'FU11H0U53',
  SESSION_IDLE_TIMEOUT = 1000 * 60 * 60 * 2, // Two hours
} = process.env;

const IN_PRODUCTION = NODE_ENV === 'production';

const sessionMiddleware = session({
  name: SESSION_NAME,
  resave: false,
  saveUninitialized: false,
  secret: SESSION_SECRET,
  rolling: true, // If session active, reroll cookie timeout
  cookie: {
    maxAge: SESSION_IDLE_TIMEOUT,
    sameSite: true,
    secure: IN_PRODUCTION
  }
});

const app = express();
app.use(sessionMiddleware);
app.use(helmet());
app.use(express.static(__dirname + '/client'));
app.use(express.urlencoded({ extended: true }));

const server = require('http').Server(app);

const redirectLogin = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    res.redirect('/register-login');
  }
  else {
    next();
  }
};

const redirectPoker = (req, res, next) => {
  if (req.session && req.session.userId) {
    res.redirect('/poker');
  }
  else {
    next();
  }
};

app.get('/', (req, res) => {
  const { session } = req.session;
  if (session) {
    res.redirect('/poker');
  }
  else {
    res.redirect('/register-login');
  }
});

app.get('/register-login', redirectPoker, (req, res) => {
  res.sendFile(__dirname + '/client/login.html');
});

app.post('/login', redirectPoker, (req, res) => {
  const { username, password } = req.body;
  database.getUserByUsername(username,
    async function (error, results) {
      if (error) {
        logger.warn("Error while querying the database to log in: " + error);
        res.redirect('/register-login?errorType=loginError&errorCode=UnknownError');
      }
      if (results.length > 0) {
        try {
          if (await argon2.verify(results[0].password, password)) {
            req.session.username = results[0].username;
            req.session.userId = results[0].id;
            return res.redirect('/poker');
          }
          else {
            res.redirect('/register-login?errorType=loginError&errorCode=InvalidLogin');
          }
        }
        catch (error) {
          logger.error("Error while verifying password using argon2:");
          throw error;
        }
      }
      else {
        res.redirect('/register-login?errorType=loginError&errorCode=InvalidLogin');
      }
    });
});

app.post('/register', redirectPoker, (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  try {
    secureUtil.validateRegisterForm(username, email, password, confirmPassword);
    try {
      argon2.hash(password, { hashLength: 32 }).then(function (hash) {
        database.addUser(username, email, hash,
          function (error, results) {
            if (error) {
              if (error.code === "ER_DUP_ENTRY") {
                logger.warn("Failed to register new user with duplicate username/email.");
                return res.redirect('/register-login?errorType=registrationError&errorCode=InvalidCredentials');
              }
              else {
                logger.error("Error while adding new user to table: " + error);
                return res.redirect('/register-login?errorType=registrationError&errorCode=UnknownError');
              }
            }
            else if (results.insertId) {
              // Add user ID to session
              req.session.username = username;
              req.session.userId = results.insertId;
              // Grant new users 10,000 chips to get started
              database.addUserInfo(results.insertId, 10000,
                function (error, results) {
                  if (error) {
                    logger.error("Error while adding user to user_info table: " + error);
                  }
                });
              return res.redirect('/poker');
            }
          });
      }.bind(this));
    }
    catch (error) {
      logger.error("Error while hashing password using argon2:");
      throw error;
    }
  }
  catch (error) {
    // Error when validating username, email or password
    res.redirect('/register-login?errorType=registrationError&errorCode=' + error.message);
  }
});

app.post('/logout', redirectLogin, (req, res) => {
  req.session.destroy(error => {
    if (error) {
      return res.redirect('/');
    }

    res.clearCookie(SESSION_NAME);
    res.redirect('/register-login');
  });
});

app.get('/poker', redirectLogin, (req, res) => {
  res.sendFile(__dirname + '/client/poker.html');
});

const pokerUtil = require('./server/pokerUtil');

var publicGameList = {};
for (let i = 1; i <= 25; i++) {
  let id = "publicGame" + i;
  let publicGame = pokerUtil.createNewGame(id);
  publicGameList[id] = publicGame;
}

const io = require('socket.io')(server);
io.use(socketIOSession(sessionMiddleware, { autoSave: true }));
io.use(function (socket, next) {
  if (!socket.handshake.session.userId) {
    next(new Error('User not authenticated!'));
  }
  else {
    socket.name = socket.handshake.session.username;
    socket.userId = socket.handshake.session.userId;
    socket.wallet = 10000;
    socket.currentGame = null;
    next();
  }
});
io.sockets.on('connection', function (socket) {
  logger.info('Socket with ID ' + socket.id + ' connected to the server.');

  socket.on('joinTable', async (data) => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (secureUtil.validateNumberInput(data.table)) {
        var table = data.table;
        if (!socketInsideValidGame(socket)) {
          socket.currentGame = "publicGame" + table;
          if (socketInsideValidGame(socket)) {
            var game = publicGameList[socket.currentGame];
            game.addSocketToGame(socket);
            updateGameState(game);
            logger.info('User ' + socket.name + ' joined table publicGame' + socket.currentGame + '.');
          }
          else {
            logger.warn('User ' + socket.name + ' tried to join an invalid game.');
          }
        }
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + socket.name + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('alert', {
        header: "Too many requests!",
        message: "Try again in " + rejection.msBeforeNext + " ms."
      });
    }
  });

  socket.on('leaveTable', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (socketInsideValidGame(socket)) {
        var game = publicGameList[socket.currentGame];
        game.removePlayerFromTable(socket);
        game.removeSocketFromGame(socket);
        updateGameState(game);
      }
      socket.currentGame = null;
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + socket.name + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('alert', {
        header: "Too many requests!",
        message: "Try again in " + rejection.msBeforeNext + " ms."
      });
    }
  });

  socket.on('startPlaying', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (socketInsideValidGame(socket)) {
        if (socket.wallet > 0) {
          var game = publicGameList[socket.currentGame];
          game.addPlayerToTable(socket);
          updateGameState(game);
        }
        else {
          socket.emit('alert', {
            header: "Insufficient funds!",
            message: "Your balance is $0."
          });
        }
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + socket.name + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('alert', {
        header: "Too many requests!",
        message: "Try again in " + rejection.msBeforeNext + " ms."
      });
    }
  });

  socket.on('startSpectating', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (socketInsideValidGame(socket)) {
        var game = publicGameList[socket.currentGame];
        game.removePlayerFromTable(socket);
        updateGameState(game);
      }
      logger.info('User ' + socket.name + ' is spectating.');
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + socket.name + '. Consumed points: ' + rejection.consumedPoints);
      soc * ket.emit('alert', {
        header: "Too many requests!",
        message: "Try again in " + rejection.msBeforeNext + " ms."
      });
    }
  });

  socket.on('raise', async (data) => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (secureUtil.validateNumberInput(data.amount)) {
        var amount = parseInt(data.amount);
        if (socketInsideValidGame(socket)) {
          var game = publicGameList[socket.currentGame];
          game.playerRaise(socket, amount);
          updateGameState(game);
        }
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + socket.name + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('alert', {
        header: "Too many requests!",
        message: "Try again in " + rejection.msBeforeNext + " ms."
      });
    }
  });

  socket.on('call', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (socketInsideValidGame(socket)) {
        var game = publicGameList[socket.currentGame];
        game.playerCall(socket);
        updateGameState(game);
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + socket.name + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('alert', {
        header: "Too many requests!",
        message: "Try again in " + rejection.msBeforeNext + " ms."
      });
    }
  });

  socket.on('check', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (socketInsideValidGame(socket)) {
        var game = publicGameList[socket.currentGame];
        game.playerCheck(socket);
        updateGameState(game);
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + socket.name + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('alert', {
        header: "Too many requests!",
        message: "Try again in " + rejection.msBeforeNext + " ms."
      });
    }
  });

  socket.on('fold', async () => {
    try {
      await secureUtil.rateLimiter.consume(socket.handshake.address);
      if (socketInsideValidGame(socket)) {
        var game = publicGameList[socket.currentGame];
        game.playerFold(socket);
        updateGameState(game);
      }
    } catch (rejection) {
      logger.warn('Rate limiter blocked user ' + socket.name + '. Consumed points: ' + rejection.consumedPoints);
      socket.emit('alert', {
        header: "Too many requests!",
        message: "Try again in " + rejection.msBeforeNext + " ms."
      });
    }
  });

  socket.on('disconnect', function () {
    if (socketInsideValidGame(socket)) {
      var game = publicGameList[socket.currentGame]
      game.removePlayerFromTable(socket);
      game.removeSocketFromGame(socket);
      updateGameState(game);
    }
    logger.info("Socket with ID " + socket.id + ' disconnected from the server.');
  });
});

/**
* Should be run on a time interval. Updates the state of the game.
*/
function updateGameState(game) {
  if (game.players.length >= 2) {
    if (!game.inProgress) {
      game.resetGame();
      game.resetAllPlayers();

      game.completedRounds.started = true;
      pokerUtil.generateNewShuffledDeck().then(function (newDeck) {
        game.currentDeck = newDeck;
        game.dealHands();

        if (game.smallBlindPlayer.balance <= game.smallBlind) {
          game.smallBlindPlayer.chipsOnTable = game.smallBlindPlayer.balance;
          game.smallBlindPlayer.balance = 0;
          game.smallBlindPlayer.allIn = true;
          game.logForUsers += 'Player ' + game.smallBlindPlayer.user.name + ' posted $' + game.smallBlindPlayer.chipsOnTable + ' small blind.\n';
        }
        else {
          game.smallBlindPlayer.chipsOnTable = game.smallBlind;
          game.smallBlindPlayer.balance -= game.smallBlind;
          game.logForUsers += 'Player ' + game.smallBlindPlayer.user.name + ' posted $' + game.smallBlind + ' small blind.\n';
        }

        if (game.bigBlindPlayer.balance <= game.bigBlind) {
          game.bigBlindPlayer.chipsOnTable = game.bigBlindPlayer.balance;
          game.bigBlindPlayer.balance = 0;
          game.bigBlindPlayer.allIn = true;
          game.logForUsers += 'Player ' + game.bigBlindPlayer.user.name + ' posted $' + game.bigBlindPlayer.chipsOnTable + ' big blind.\n';
        }
        else {
          game.bigBlindPlayer.chipsOnTable = game.bigBlind;
          game.bigBlindPlayer.balance -= game.bigBlind;
          game.logForUsers += 'Player ' + game.bigBlindPlayer.user.name + ' posted $' + game.bigBlind + ' big blind.\n';
        }

        game.currentBet = game.bigBlind;
        // game.timerId = setTimeout(() => {
        //   game.removePlayerFromTable(game.players[game.playerTurn].user);
        // }, 30000);
        sendInfoToClients(game);
      }.bind(this));
    }
    else if (game.activePlayers < 2) {
      game.roundUpBets()
      game.concludeGame();
      game.completedRounds.concluded = true;
      setTimeout(() => {
        updateGameState(game)
      }, 3000);
    }
    else if (game.bettingRoundCompleted) {
      game.roundUpBets();
      if (game.activePlayers - game.allInPlayers > 1) {
        game.resetBettingRound()
      }

      if (!game.completedFlop) {
        game.dealFlop();
        game.completedRounds.flop = true;
      }
      else if (!game.completedTurn) {
        game.dealTurn();
        game.completedRounds.turn = true;
      }
      else if (!game.completedRiver) {
        game.dealRiver();
        game.completedRounds.river = true;
      }
      else {
        game.concludeGame();
        game.completedRounds.concluded = true;
        setTimeout(() => {
          updateGameState(game)
        }, 3000);
      }
    }
  }
  else if (game.inProgress) {
    game.roundUpBets()
    game.concludeGame();
    game.completedRounds.concluded = true;
    setTimeout(() => {
      updateGameState(game)
    }, 3000);
  }

  sendInfoToClients(game);
}

function sendInfoToClients(game) {
  for (let i = 0; i < game.sockets.length; i++) {
    var players = [];
    var thisPlayer = null;
    var socket = game.sockets[i];
    for (let j = 0; j < game.players.length; j++) {
      var player = game.players[j];
      if (socket == player.user) {
        players.push({
          name: player.user.name,
          color: "",
          hand: player.cardsInHand,
          bank: player.balance,
          onTable: player.chipsOnTable,
          hasCards: true
        });

        thisPlayer = {
          name: player.user.name,
          chipsOnTable: player.chipsOnTable
        };
      }
      else {
        var playerHand = null;
        if (player.cardsInHand.length == 2) {
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

    socket.emit('gameState', {
      players: players,
      thisPlayer: thisPlayer,
      communityCards: game.communityCards,
      playerTurn: game.playerTurn,
      currentBet: game.currentBet,
      log: game.logForUsers
    });
  }

  // Clear all user logs from games since they've been sent to users
  for (var id in publicGameList) {
    publicGameList[id].logForUsers = "";
  }
}

/**
* Check if a socket is inside a valid game. Socket can be playing or spectating.
* @param {SocketIO.Socket} socket object representing a client socket
* @return {Boolean} true if socket is currently inside a valid game, false otherwise
*/
function socketInsideValidGame(socket) {
  var inGame = false;
  if (socket.currentGame != null && publicGameList[socket.currentGame] != null) {
    inGame = true;
  }
  else {
    socket.currentGame = null;
  }
  return inGame;
}

server.listen(APPLICATION_PORT, () => logger.info('Server started on port ' + APPLICATION_PORT));