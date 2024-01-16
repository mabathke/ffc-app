var express = require('express');
var db = require('../db');

function fetchTodos(req, res, next) {
  db.all('SELECT * FROM todos WHERE owner_id = ?', [
    req.user.id
  ], function (err, rows) {
    if (err) { return next(err); }

    var todos = rows.map(function (row) {
      return {
        id: row.id,
        title: row.title,
        completed: row.completed == 1 ? true : false,
        url: '/' + row.id
      }
    });
    res.locals.todos = todos;
    res.locals.activeCount = todos.filter(function (todo) { return !todo.completed; }).length;
    res.locals.completedCount = todos.length - res.locals.activeCount;
    next();
  });
}

var router = express.Router();

/* GET home page. */
router.get('/', function (req, res, next) {
  if (!req.user) {
    // Query for overall scores
    const overallScoresQuery = `
      SELECT u.name, SUM(s.points) AS total_points
      FROM scoreboard s
      JOIN users u ON s.owner_id = u.id
      GROUP BY u.name
      ORDER BY total_points DESC
    `;

    // Execute the query for overall scores
    db.all(overallScoresQuery, [], function (err, overallScores) {
      if (err) {
        console.error(err.message);
        return res.render('error', { error: err });
      } else {
        // Add a ranking property to each row in overall scores
        overallScores.forEach((row, index) => {
          row.ranking = index + 1;
        });

        // Render the home view with the scores
        res.render('home', { scores: overallScores });
      }
    });
  } else {
    // User is logged in, fetch fish types
    const fishTypesQuery = `
      SELECT * FROM types_of_fish
      ORDER BY type
    `;

    db.all(fishTypesQuery, [], function (err, fishTypes) {
      if (err) {
        console.error(err.message);
        return res.render('error', { error: err });
      } else {
        // Query for individual entries for the current user
        const individualEntriesQuery = `
          SELECT t.type, s.length, s.id
          FROM scoreboard s
          JOIN types_of_fish t ON s.fish_type_id = t.id
          WHERE s.owner_id = ?
          ORDER BY s.length DESC
        `;

        db.all(individualEntriesQuery, [req.user.id], function (err, individualEntries) {
          if (err) {
            console.error(err.message);
            return res.render('error', { error: err });
          } else {
            // Render the index view with user info, fish types, and individual entries
            res.render('index', { user: req.user, fishTypes: fishTypes, entries: individualEntries });
          }
        });
      }
    });
  }
});



router.post('/submitfish', function (req, res) {
  if (!req.user) {
    // Redirect to login if the user is not logged in
    return res.redirect('/login');
  }

  const ownerId = req.user.id;
  const fishTypeId = req.body.fish_type;
  const length = parseInt(req.body.length);

  // Fetch fish type details from types_of_fish table
  const fishTypeQuery = 'SELECT avg_length, upper_bound, lower_bound FROM types_of_fish WHERE id = ?';
  db.get(fishTypeQuery, [fishTypeId], function (err, fishType) {
    if (err) {
      console.error(err.message);
      return res.render('error', { error: err });
    }

    // Calculate points
    let points = 0;
    if (length >= fishType.lower_bound) {
      if (length < fishType.avg_length) {
        points = length * 0.5;
      } else if (length >= fishType.avg_length && length < fishType.upper_bound) {
        points = length;
      } else {
        points = length * 1.5;
      }
    }

    // Prepare the date for the entry
    const date = new Date().toISOString();

    // Insert the data into the scoreboard table
    const insertQuery = `
      INSERT INTO scoreboard (owner_id, fish_type_id, length, points, date) 
      VALUES (?, ?, ?, ?, ?)
    `;
    db.run(insertQuery, [ownerId, fishTypeId, length, points, date], function (err) {
      if (err) {
        console.error(err.message);
        return res.render('error', { error: err });
      }

      // Redirect or render a success message/page
      res.redirect('/?fishRegistered=true');
    });
  });
});


router.post('/deletefish', function (req, res) {
  if (!req.user) {
    // Redirect to login if the user is not logged in
    return res.redirect('/login');
  }

  const catchId = parseInt(req.body.catch_id); // Assuming catch_id is an integer
  const ownerId = req.user.id; // User's ID for additional verification (optional)

  // Delete query to remove the catch from the scoreboard
  const deleteQuery = 'DELETE FROM scoreboard WHERE id = ? AND owner_id = ?';

  db.run(deleteQuery, [catchId, ownerId], function (err) {
    if (err) {
      console.error(err.message);
      return res.render('error', { error: err });
    }

    // Redirect or render a page after successful deletion
    // For example, redirect back to the main page or a confirmation page
    res.redirect('/?fishDeleted=true');
  });
});
module.exports = router;
