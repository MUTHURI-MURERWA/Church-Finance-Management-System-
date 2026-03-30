// routes/villages.js — Villages list

//import express framework
const express = require('express');
//create a router instance to define routes
const router  = express.Router();
//import postgreSQL connection to pool for running database queries
const pool    = require('../db');
//import authentication middleware (checks if user is logged in)
const auth    = require('../middleware/auth');


//apply authentication middleware to all routes in this file
//every request must pass the auth check before accesing these endpoints
router.use(auth);

// ── GET /api/villages ────────────────────────────────────
// This route retrieves all villages and counts how many members belong to each village
router.get('/', async (req, res) => {
  try {
    // SQL query explanation:
    // v.*  -> select all columns from villages table
    // COUNT(m.id) -> count members belonging to that village
    // LEFT JOIN -> ensures villages without members still appear
    // GROUP BY -> required because we are using COUNT()
    // ORDER BY -> sorts villages alphabetically
    const result = await pool.query(`
      SELECT v.*, COUNT(m.id)::int AS member_count
      FROM villages v
      LEFT JOIN members m ON m.village_id = v.id
      GROUP BY v.id
      ORDER BY v.name ASC
    `);
     // Send the result rows as JSON response to the client
    res.json(result.rows);
  } catch (err) {
    console.error('Get villages error:', err);
    res.status(500).json({ error: 'Failed to fetch villages.' });
  }
});

// ── POST /api/villages ───────────────────────────────────
//to create a new village
router.post('/', async (req, res) => {
  const { name } = req.body;

  //validate input
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Village name is required.' });
  }
  try {


    // Insert new village into the database
    // $1 is a parameter placeholder to prevent SQL injection
    // RETURNING * returns the inserted row
    const result = await pool.query(
      'INSERT INTO villages (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    //send success response with the created village
    res.status(201).json(result.rows[0]);
  } catch (err) {
    //postgreSQL error code 23505 = unique constraints violation
    //this happens if the village already exists
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Village already exists.' });
    }
    // log other errors in the server console
    console.error('Create village error:', err);
    res.status(500).json({ error: 'Failed to create village.' });
  }
});

module.exports = router;
