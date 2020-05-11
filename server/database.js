const promisify = require('util.promisify');
const mySql = require('mySql');
const log4js = require('log4js');

const logger = log4js.getLogger();
logger.level = 'info';

// Create pool connections
const pool = mySql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'poker_app',
  password: 'Creative#Face&Masks72',
  database: 'texas_holdem'
});

// Attempt to connect to the database and create required tables (if they do not exist)
pool.getConnection((err, connection) => {
  if (err) {
    logger.error('Error connecting to the database');
    throw err;
  }
  else if (connection) {
    logger.info('Connection to the database has been established.');
    connection.query(`CREATE TABLE IF NOT EXISTS users (
                        id INT NOT NULL AUTO_INCREMENT,
                        username VARCHAR(32) NOT NULL UNIQUE,
                        email VARCHAR(256) NOT NULL UNIQUE,
                        password VARCHAR(256) NOT NULL,
                        PRIMARY KEY(id))`,
      function (error) {
        if (error) {
          connection.release();
          logger.error('Error creating users table');
          throw error;
        }
      });

    connection.query(`CREATE TABLE IF NOT EXISTS user_info (
                        id INT NOT NULL,
                        balance INT NOT NULL default 0,
                        wins INT NOT NULL default 0,
                        losses INT NOT NULL default 0,
                        draws INT NOT NULL default 0,
                        PRIMARY KEY(id),
                        FOREIGN KEY(id) references users(id)
                        ON DELETE CASCADE);`,
      function (error) {
        connection.release();
        if (error) {
          logger.error('Error creating user_info table');
          throw error;
        }
      });
  }
});

pool.query = promisify(pool.query);

module.exports = {
  getUserInfoByUserId: function (userId, callback) {
    pool.query('SELECT * FROM USER_INFO WHERE ID = ?', [userId],
      function (error, results) {
        if (error) {
          callback(error, results);
        }
        else {
          callback(null, results);
        }
      });
  },

  getUserByUsername: function (username, callback) {
    pool.query('SELECT * FROM users WHERE username = ?', [username],
      function (error, results) {
        if (error) {
          callback(error, results);
        }
        else {
          callback(null, results);
        }
      });
  },

  addUser: function (username, email, password, callback) {
    pool.query('INSERT INTO USERS (username, email, password) VALUES (?, ?, ?)', [username, email, password],
      function (error, results) {
        if (error) {
          callback(error, results);
        }
        else {
          callback(null, results);
        }
      });
  },

  addUserInfo: function (userId, initialBalance, callback) {
    pool.query('INSERT INTO USER_INFO (id, balance) VALUES (?, ?)', [userId, initialBalance],
      function (error, results) {
        if (error) {
          callback(error, results);
        }
        else {
          callback(null, results);
        }
      });
  },

  incrementUserWins: function (userId) {
    pool.query('UPDATE user_info SET wins = wins + 1 WHERE id = ?', [userId]);
  },

  incrementUserLosses: function (userId) {
    pool.query('UPDATE user_info SET losses = losses + 1 WHERE id = ?', [userId]);
  },

  incrementUserDraws: function (userId) {
    pool.query('UPDATE user_info SET draws = draws + 1 WHERE id = ?', [userId]);
  },

  updateUserBalance: function (userId, change) {
    pool.query('UPDATE user_info SET balance = balance + ? WHERE id = ?', [change, userId]);
  }
};