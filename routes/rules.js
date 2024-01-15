var express = require('express');
var db = require('../db');

var router = express.Router();

router.get('/rules', function(req, res, next) {
    // Fetch data from types_of_fish table
    db.all('SELECT * FROM types_of_fish', [], function(err, rows) {
        if (err) {
            // Handle the error, maybe render an error page or log it
            console.error(err.message);
            res.render('error', { error: err }); // Assuming you have an error view
        } else {
            // If no error, render your page with the fetched rows
            res.render('rules', { fishes: rows }); // Replace 'your-view-name' with your actual view file
        }
    });
});

module.exports = router;
