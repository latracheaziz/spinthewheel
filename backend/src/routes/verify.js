const express = require('express');
const router = express.Router();
const { dbQuery } = require('../config/db');

// Validation simple de téléphone (Tunisie)
function validatePhone(phone) {
  const cleaned = String(phone).replace(/\s+/g, '');
  const re = /^(?:\+216|00216)?[0-9]{8}$/;
  return re.test(cleaned);
}

function standardizePhone(phone) {
  let cleaned = String(phone).replace(/\s+/g, '');
  if (cleaned.startsWith('00216')) {
    cleaned = '+' + cleaned.substring(2);
  } else if (!cleaned.startsWith('+216')) {
    cleaned = '+216' + cleaned;
  }
  return cleaned;
}

// POST /verify/check - Vérifie le format du téléphone et valide directement
router.post('/check', async (req, res) => {
  const { email } = req.body;
  const phoneInput = email || req.body.phone;
  if (!phoneInput) {
    return res.status(400).json({ success: false, error: 'Veuillez saisir un numéro de téléphone.' });
  }

  const trimmedInput = phoneInput.trim();

  if (!validatePhone(trimmedInput)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Numéro de téléphone invalide. Veuillez saisir un numéro de téléphone tunisien correct.' 
    });
  }

  const standardizedIdentifier = standardizePhone(trimmedInput);
  const isBypass = standardizedIdentifier === 'azizlatrache5@gmail.com' || standardizedIdentifier === '+21699999999';

  try {
    // Vérifier si l'utilisateur a déjà joué (double-spin interdit)
    if (!isBypass) {
      const spinExists = await dbQuery.get(
        'SELECT id FROM users_spins WHERE user_identifier = ?',
        [standardizedIdentifier]
      );
      if (spinExists) {
        return res.status(400).json({ success: false, error: 'Ce numéro de téléphone a déjà été utilisé pour lancer la roue.' });
      }
    }

    // Marquer le numéro comme vérifié directement
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
      message: 'Numéro de téléphone vérifié avec succès.' 
    });

  } catch (error) {
    console.error('Erreur verify/check:', error);
    res.status(500).json({ success: false, error: 'Une erreur serveur est survenue lors de la vérification.' });
  }
});

// POST /verify/confirm - Confirme le code entré par l'utilisateur
router.post('/confirm', async (req, res) => {
  const { email, code } = req.body;
  const phoneInput = email || req.body.phone;
  
  if (!phoneInput || !code) {
    return res.status(400).json({ success: false, error: 'Téléphone et code requis.' });
  }

  const trimmedInput = phoneInput.trim();

  if (!validatePhone(trimmedInput)) {
    return res.status(400).json({ success: false, error: 'Numéro de téléphone invalide.' });
  }

  const standardizedIdentifier = standardizePhone(trimmedInput);

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
