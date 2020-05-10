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
                        email VARCHAR(256) NOT NULL,
                        password VARCHAR(256) NOT NULL,
                        PRIMARY KEY(id, username))`,
      function (error) {
        connection.release();
        if (error) {
          logger.error('Error creating users table');
          throw error;
        }
      });
  }
});

pool.query = promisify(pool.query);

module.exports = pool;