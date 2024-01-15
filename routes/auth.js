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

router.get('/scoreboard', function(req, res) {
  res.render('scoreboard', {user: req.user});
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