const express = require('express');
const router = express.Router();
const { dbQuery } = require('../config/db');
const { sendVerificationEmail } = require('../services/emailService');

// Validation simple d'email
function validateEmail(email) {
  const re = /^[a-zA-Z0-9]+[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
}

// POST /verify/check - Vérifie le statut de l'adresse e-mail et envoie un code si nécessaire
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
    // 1. Si c'est l'adresse email de bypass, elle est automatiquement marquée comme vérifiée
    if (isBypass) {
      return res.json({ success: true, verified: true });
    }

    // 2. Vérifier si l'utilisateur a déjà joué (double-spin interdit)
    const spinExists = await dbQuery.get(
      'SELECT id FROM users_spins WHERE user_identifier = ?',
      [standardizedIdentifier]
    );
    if (spinExists) {
      return res.status(400).json({ success: false, error: 'Cet identifiant a déjà été utilisé pour lancer la roue.' });
    }

    // 3. Vérifier si l'identifiant a une vérification valide datant de moins de 7 jours
    // SQLite supporte les calculs de date relatifs avec datetime()
    const verification = await dbQuery.get(
      "SELECT verified_at FROM email_verifications WHERE email = ? AND verified_at >= datetime('now', '-7 days')",
      [standardizedIdentifier]
    );

    if (verification) {
      // Déjà vérifié il y a moins de 7 jours !
      return res.json({ success: true, verified: true });
    }

    // 4. Si non vérifié ou vérification expirée (plus de 7 jours), envoyer un code à 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Enregistrer le code en base (avec ON CONFLICT pour upsert)
    await dbQuery.run(`
      INSERT INTO email_verifications (email, code, verified_at, created_at)
      VALUES (?, ?, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET 
        code = excluded.code, 
        verified_at = NULL, 
        created_at = CURRENT_TIMESTAMP
    `, [standardizedIdentifier, code]);

    // Envoyer le code de vérification par e-mail
    await sendVerificationEmail(standardizedIdentifier, code);

    res.json({ 
      success: true, 
      verified: false, 
      message: 'Un code de vérification à 6 chiffres a été envoyé par e-mail.' 
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
    // Vérifier le code correspondant dans la table
    const row = await dbQuery.get(
      'SELECT * FROM email_verifications WHERE email = ? AND code = ?',
      [standardizedIdentifier, code.trim()]
    );

    if (!row) {
      return res.status(400).json({ success: false, error: 'Code de vérification incorrect.' });
    }

    // Mettre à jour la date de validation
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
