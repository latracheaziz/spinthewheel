const express = require('express');
const router = express.Router();
const { dbQuery } = require('../config/db');

// GET /api/rewards - Liste toutes les récompenses
router.get('/', async (req, res) => {
  try {
    const rewards = await dbQuery.all('SELECT * FROM rewards');
    res.json({ success: true, data: rewards });
  } catch (error) {
    console.error('Erreur GET /rewards:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur lors de la récupération des récompenses' });
  }
});

module.exports = router;
