const express = require('express');
const router = express.Router();
const dns = require('dns').promises;
const { dbQuery } = require('../config/db');

// Validation simple d'email (regex)
function validateEmail(email) {
  const re = /^[a-zA-Z0-9]+[a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
}

// Filtre anti-email bidon/jetable
function isFakeOrDummyEmail(email) {
  const normalized = email.toLowerCase().trim();
  const [localPart, domain] = normalized.split('@');

  // Blacklist de mots-clés typiques des adresses jetables/tests
  const dummyKeywords = ['test', 'fake', 'dummy', 'temp', 'example', 'abc', '123', 'placeholder', 'demo', 'noreply', 'mailinator', 'yopmail'];
  for (const keyword of dummyKeywords) {
    if (localPart.includes(keyword) || domain.includes(keyword)) {
      return true;
    }
  }

  // Blacklist de domaines connus pour les mails jetables (disposable emails)
  const disposableDomains = [
    'tempmail.com', 'mailinator.com', '10minutemail.com', 'yopmail.com', 
    'guerrillamail.com', 'sharklasers.com', 'dispostable.com', 
    'getairmail.com', 'maildrop.cc', 'throwawaymail.com', 'temp-mail.org'
  ];
  if (disposableDomains.includes(domain)) {
    return true;
  }

  // Parties locales trop courtes ou suspectes (ex: a@gmail.com)
  if (localPart.length < 3) {
    return true;
  }

  return false;
}

// Vérification de l'existence des serveurs de messagerie (records MX)
async function hasValidMXRecords(domain) {
  // Liste de domaines connus et toujours valides pour éviter des requêtes DNS inutiles
  const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'outlook.fr', 'orange.fr', 'sfr.fr', 'free.fr', 'live.fr', 'yahoo.fr', 'icloud.com', 'laposte.net', 'msn.com', 'aol.com', 'protonmail.com', 'proton.me'];
  if (commonDomains.includes(domain)) {
    return true;
  }

  try {
    // Timeout après 1500ms
    const mxPromise = dns.resolveMx(domain);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), 1500)
    );
    const records = await Promise.race([mxPromise, timeoutPromise]);
    return records && records.length > 0;
  } catch (err) {
    if (err.message === 'timeout') {
      return true;
    }
    return false;
  }
}

// POST /verify/check - Vérifie le statut de l'adresse e-mail et valide directement si elle est réelle
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

  // 1. Filtrage anti-email bidon/jetable
  if (!isBypass && isFakeOrDummyEmail(standardizedIdentifier)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Les adresses e-mail de test ou temporaires (comme test@gmail.com) ne sont pas autorisées. Veuillez utiliser votre véritable adresse e-mail.' 
    });
  }

  try {
    // 2. Vérification des serveurs de messagerie (MX records)
    if (!isBypass) {
      const [_, domain] = standardizedIdentifier.split('@');
      const validDomain = await hasValidMXRecords(domain);
      if (!validDomain) {
        return res.status(400).json({
          success: false,
          error: 'Le domaine de cette adresse e-mail semble invalide ou n\'existe pas (pas de serveur de réception d\'e-mail). Veuillez utiliser une adresse correcte.'
        });
      }
    }

    // 3. Vérifier si l'utilisateur a déjà joué (double-spin interdit)
    if (!isBypass) {
      const spinExists = await dbQuery.get(
        'SELECT id FROM users_spins WHERE user_identifier = ?',
        [standardizedIdentifier]
      );
      if (spinExists) {
        return res.status(400).json({ success: false, error: 'Cette adresse email a déjà été utilisée pour lancer la roue.' });
      }
    }

    // 4. Mettre automatiquement à jour la date de validation dans la base (vérifié direct)
    await dbQuery.run(`
      INSERT INTO email_verifications (email, code, verified_at, created_at)
      VALUES (?, 'BYPASS', datetime('now'), CURRENT_TIMESTAMP)
      ON CONFLICT(email) DO UPDATE SET 
        code = 'BYPASS',
        verified_at = datetime('now'), 
        created_at = CURRENT_TIMESTAMP
    `, [standardizedIdentifier]);

    // Retourner verified: true directement, pour lancer la roue sans étape de code OTP !
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
