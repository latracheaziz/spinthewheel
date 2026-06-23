const express = require('express');
const router = express.Router();
const { dbQuery } = require('../config/db');

// GET /api/admin/spins - Récupérer tous les lancers réels (par email/téléphone)
router.get('/spins', async (req, res) => {
  try {
    const spins = await dbQuery.all(
      "SELECT id, user_identifier as email, reward, coupon_code, created_at FROM users_spins WHERE (user_identifier LIKE '+%' OR user_identifier LIKE '%@%') ORDER BY created_at DESC"
    );
    res.json({ success: true, data: spins });
  } catch (error) {
    console.error('Erreur GET /admin/spins:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des lancers.' });
  }
});

// GET /api/admin/stats - Récupérer les statistiques des gains
router.get('/stats', async (req, res) => {
  try {
    const totalResult = await dbQuery.get(
      "SELECT COUNT(*) as total FROM users_spins WHERE (user_identifier LIKE '+%' OR user_identifier LIKE '%@%')"
    );
    const total = totalResult.total;

    const distribution = await dbQuery.all(
      "SELECT reward, COUNT(*) as count FROM users_spins WHERE (user_identifier LIKE '+%' OR user_identifier LIKE '%@%') GROUP BY reward"
    );

    const stats = distribution.map(row => ({
      reward: row.reward,
      count: row.count,
      percentage: total > 0 ? ((row.count / total) * 100).toFixed(1) : 0
    }));

    res.json({
      success: true,
      data: {
        totalSpins: total,
        distribution: stats
      }
    });
  } catch (error) {
    console.error('Erreur GET /admin/stats:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la récupération des statistiques.' });
  }
});

// POST /api/admin/rewards/update - Mettre à jour les configurations des récompenses
router.post('/rewards/update', async (req, res) => {
  const { rewards } = req.body; // Un tableau de récompenses [{ id, name, probability, active, stock }]

  if (!rewards || !Array.isArray(rewards)) {
    return res.status(400).json({ success: false, error: 'Format de données invalide.' });
  }

  // 1. Validation de la somme des probabilités pour les récompenses actives
  const activeRewards = rewards.filter(r => Number(r.active) === 1);
  const sum = activeRewards.reduce((s, r) => s + parseFloat(r.probability), 0);

  // Validation de la somme avec une tolérance pour la précision flottante
  if (activeRewards.length > 0 && Math.abs(sum - 1.0) > 0.0001) {
    return res.status(400).json({
      success: false,
      error: `La somme des probabilités des récompenses actives doit être égale à 1.0 (100%). Actuellement : ${(sum * 100).toFixed(1)}%`
    });
  }

  try {
    // 2. Transaction SQLite pour mettre à jour toutes les récompenses
    // sqlite3 ne supporte pas nativement les transactions via Promise de façon imbriquée simple,
    // on va exécuter les UPDATE de façon séquentielle dans un BEGIN/COMMIT.
    await dbQuery.exec('BEGIN TRANSACTION');

    for (const reward of rewards) {
      const activeVal = Number(reward.active) === 1 ? 1 : 0;
      await dbQuery.run(
        'UPDATE rewards SET name = ?, probability = ?, active = ?, stock = ? WHERE id = ?',
        [reward.name, parseFloat(reward.probability), activeVal, parseInt(reward.stock, 10), reward.id]
      );
    }

    await dbQuery.exec('COMMIT');

    res.json({ success: true, message: 'Récompenses mises à jour avec succès.' });
  } catch (error) {
    try {
      await dbQuery.exec('ROLLBACK');
    } catch (rbError) {
      console.error('Erreur lors du rollback:', rbError);
    }
    console.error('Erreur POST /admin/rewards/update:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour des récompenses en base.' });
  }
});

module.exports = router;
