var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
var db = require('../db');
var router = express.Router();

passport.use(new LocalStrategy(function verify(username, password, cb) {
    db.get('SELECT * FROM users WHERE username = ?', [ username ], function(err, row) {
      if (err) { return cb(err); }
      if (!row) { return cb(null, false, { message: 'Incorrect username or password.' }); }
  
      crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', function(err, hashedPassword) {
        if (err) { return cb(err); }
        if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
          return cb(null, false, { message: 'Incorrect username or password.' });
        }
        return cb(null, row);
      });
    });
  }));
  passport.serializeUser(function(user, cb) {
    process.nextTick(function() {
      cb(null, { id: user.id, username: user.username });
    });
  });
  
  passport.deserializeUser(function(user, cb) {
    process.nextTick(function() {
      return cb(null, user);
    });
  });
router.get('/login', function(req, res, next) {
  res.render('login');
});

module.exports = router;
router.post('/login/password', passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login'
  }));

router.post('/logout', function(req, res, next) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});  

router.get('/signup', function(req, res, next) {
  res.render('signup');
});

router.get('/rules', function(req, res, next) {
  // Fetch data from types_of_fish table
  db.all('SELECT * FROM types_of_fish', [], function(err, rows) {
      if (err) {
          // Handle the error, maybe render an error page or log it
          console.error(err.message);
          res.render('error', { error: err }); // Assuming you have an error view
      } else {
          // If no error, render your page with the fetched rows
          res.render('rules', {user: req.user, fishes: rows }); // Replace 'your-view-name' with your actual view file
      }
  });
});


router.get('/scoreboard', function(req, res, next) {
  // Query for overall scores
  const overallScoresQuery = `
      SELECT u.username, SUM(s.points) AS total_points
      FROM scoreboard s
      JOIN users u ON s.owner_id = u.id
      GROUP BY u.username
      ORDER BY total_points DESC
  `;

  // Query for individual entries for the current user
  const individualEntriesQuery = `
      SELECT t.type, s.length
      FROM scoreboard s
      JOIN types_of_fish t ON s.fish_type_id = t.id
      WHERE s.owner_id = ?
      ORDER BY s.date
  `;

  // Execute the first query for overall scores
  db.all(overallScoresQuery, [], function(err, overallScores) {
      if (err) {
          console.error(err.message);
          return res.render('error', { error: err });
      } else {
          // Add a ranking property to each row in overall scores
          overallScores.forEach((row, index) => {
              row.ranking = index + 1;
          });

          // Execute the second query for individual entries of the current user
          db.all(individualEntriesQuery, [req.user.id], function(err, individualEntries) {
              if (err) {
                  console.error(err.message);
                  return res.render('error', { error: err });
              } else {
                  // Render the scoreboard view with both overall scores and individual entries
                  res.render('scoreboard', {
                      user: req.user, 
                      scores: overallScores, 
                      entries: individualEntries
                  });
              }
          });
      }
  });
});



router.get('/', function(req, res) {
  res.render('home', {fishData: req.fishData});
});

router.post('/signup', function(req, res, next) {
  var salt = crypto.randomBytes(16);
  crypto.pbkdf2(req.body.password, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
    if (err) { return next(err); }
    db.run('INSERT INTO users (username, hashed_password, salt, email, name) VALUES (?, ?, ?, ?, ?)', [
      req.body.username,
      hashedPassword,
      salt,
      req.body.email,
      req.body.name
    ], function(err) {
      if (err) { return next(err); }
      var user = {
        id: this.lastID,
        username: req.body.username
      };
      req.login(user, function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
    });
  });
});