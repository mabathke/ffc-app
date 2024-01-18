var sqlite3 = require('sqlite3');
var mkdirp = require('mkdirp');
var crypto = require('crypto');
var fs = require('fs');
var csv = require('csv-parser');

mkdirp.sync('var/db');

var db = new sqlite3.Database('var/db/todos.db');

db.serialize(function () {
  // create the database schema for the todos app
  db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    hashed_password BLOB,
    salt BLOB,
    name TEXT,
    email TEXT UNIQUE
  )
`);

  db.run(`
  CREATE TABLE IF NOT EXISTS federated_credentials (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    UNIQUE (provider, subject)
  )
`);

  db.run(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY,
    owner_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER
  )
`);

  db.run(`
  CREATE TABLE IF NOT EXISTS types_of_fish (
    id INTEGER PRIMARY KEY,
    type TEXT UNIQUE,
    avg_length INTEGER NOT NULL,
    upper_bound INTEGER NOT NULL,
    lower_bound INTEGER NOT NULL,
    is_rare BOOLEAN NOT NULL
  )
`);
  db.run(`
CREATE TABLE IF NOT EXISTS scoreboard (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL,
  fish_type_id INTEGER NOT NULL,
  length INTEGER NOT NULL,
  points INTEGER NOT NULL,
  date TEXT NOT NULL
)
`);

  db.run(`
CREATE TABLE IF NOT EXISTS email_verified (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE
)
`);


  // create an initial user (username: alice, password: letmein)
  var salt = crypto.randomBytes(16);
  db.run('INSERT OR IGNORE INTO users (username, hashed_password, salt) VALUES (?, ?, ?)', [
    'alice',
    crypto.pbkdf2Sync('letmein', salt, 310000, 32, 'sha256'),
    salt
  ]);

  // create an INSERT INTO for email_verified
  db.run('INSERT OR IGNORE INTO email_verified (email) VALUES (?)', [
    'marvin.bathke@gmx.de']);
});

// initialize the values of types_of_fish
function insertTypeOfFish(id, type, avg_length, upper_bound, lower_bound, is_rare) {
  db.run('INSERT OR IGNORE INTO types_of_fish (id, type, avg_length, upper_bound, lower_bound, is_rare) VALUES (?, ?, ?, ?, ?, ?)', [
    id, type, avg_length, upper_bound, lower_bound, is_rare === 'True'
  ], (err) => {
    if (err) {
      return console.log(err.message);
    }
    console.log(`A row has been inserted with id ${id}`);
  });
}

// Read and parse the CSV file
fs.createReadStream('C:/Users/Admin/fishing-challenge-app/var/data/types_of_fish.csv')
  .pipe(csv({
    separator: ',',
    mapHeaders: ({ header }) => header.trim()
  }))
  .on('data', (row) => {
    // For each row in the CSV, insert a record into the database
    insertTypeOfFish(row.id, row.type, row.avg_length, row.upper_bound, row.lower_bound, row.is_rare);
  })
  .on('end', () => {
    console.log('CSV file successfully processed');
  });

module.exports = db;
