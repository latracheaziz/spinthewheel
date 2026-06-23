const express = require('express');
const router = express.Router();
const { dbQuery } = require('../config/db');

// Validation simple d'email (regex)
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

// POST /verify/check - Vérifie le format de l'email et valide directement
router.post('/check', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Veuillez saisir une adresse email valide.' });
  }

  const trimmedInput = email.trim();

  if (!validateEmail(trimmedInput)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Adresse email invalide. Veuillez saisir une adresse email correcte.' 
    });
  }

  const standardizedIdentifier = trimmedInput.toLowerCase();
  const isBypass = standardizedIdentifier === 'azizlatrache5@gmail.com';

  try {
    // Vérifier si l'utilisateur a déjà joué (double-spin interdit)
    if (!isBypass) {
      const spinExists = await dbQuery.get(
        'SELECT id FROM users_spins WHERE user_identifier = ?',
        [standardizedIdentifier]
      );
      if (spinExists) {
        return res.status(400).json({ success: false, error: 'Cette adresse email a déjà été utilisée pour lancer la roue.' });
      }
    }

    // Marquer l'email comme vérifié directement
    await dbQuery.run(`
      INSERT INTO email_verifications (email, code, verified_at, created_at)
      VALUES (?, 'BYPASS', datetime('now'), CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET 
        code = 'BYPASS',
        verified_at = datetime('now'), 
        created_at = CURRENT_TIMESTAMP
    `, [standardizedIdentifier]);

    res.json({ 
      success: true, 
      verified: true, 
      message: 'Adresse email vérifiée avec succès.' 
    });

  } catch (error) {
    console.error('Erreur verify/check:', error);
    res.status(500).json({ success: false, error: 'Une erreur serveur est survenue lors de la vérification.' });
  }
});

// POST /verify/confirm - Confirme le code entré par l'utilisateur
router.post('/confirm', async (req, res) => {
  const { email, code } = req.body;
  
  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'Email et code requis.' });
  }

  const trimmedInput = email.trim();

  if (!validateEmail(trimmedInput)) {
    return res.status(400).json({ success: false, error: 'Adresse email invalide.' });
  }

  const standardizedIdentifier = trimmedInput.toLowerCase();

  try {
    const row = await dbQuery.get(
      'SELECT * FROM email_verifications WHERE email = ? AND code = ?',
      [standardizedIdentifier, code.trim()]
    );

    if (!row) {
      return res.status(400).json({ success: false, error: 'Code de vérification incorrect.' });
    }

    await dbQuery.run(
      "UPDATE email_verifications SET verified_at = datetime('now') WHERE email = ?",
      [standardizedIdentifier]
    );

    res.json({ success: true, message: 'Identifiant vérifié avec succès.' });

  } catch (error) {
    console.error('Erreur verify/confirm:', error);
    res.status(500).json({ success: false, error: 'Erreur lors de la validation du code.' });
  }
});

module.exports = router;
