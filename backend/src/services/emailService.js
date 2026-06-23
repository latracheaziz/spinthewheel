const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Logs locaux d'emails envoyés en mode dev
const logFilePath = path.join(__dirname, '../../data/sent_emails.log');

async function sendVerificationEmail(target, code) {
  // Configurer le transporteur SMTP à partir des variables d'environnement
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'Griffin Store <noreply@griffinstore.com>';

  const hasSmtpConfig = host && user && pass;
  const subject = 'Code de vérification - Griffin Store 🔐';
  
  const plainText = `Votre code de vérification Griffin Store est : ${code}. Ce code est requis pour valider votre compte.`;
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #7c3aed; margin: 0; font-family: sans-serif; letter-spacing: 2px; font-size: 24px;">GRIFFIN STORE</h1>
      </div>
      <hr style="border: 0; border-top: 1px solid #edf2f7; margin-bottom: 25px;" />
      
      <h2 style="color: #1a202c; font-size: 20px; margin-top: 0; text-align: center;">Vérification de votre compte</h2>
      <p style="color: #4a5568; font-size: 15px; line-height: 1.6; text-align: center;">
        Veuillez utiliser le code de sécurité ci-dessous pour vérifier votre compte et continuer à utiliser le système.
      </p>

      <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0;">
        <span style="color: #718096; font-size: 13px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Code de sécurité à 6 chiffres :</span>
        <div style="font-family: monospace; font-size: 32px; font-weight: 800; color: #7c3aed; margin-top: 10px; letter-spacing: 5px;">
          ${code}
        </div>
      </div>

      <p style="color: #718096; font-size: 13px; line-height: 1.5; text-align: center; font-style: italic;">
        Ce code est requis pour des raisons de sécurité tous les 7 jours. N'échangez jamais ce code avec qui que ce soit.
      </p>

      <hr style="border: 0; border-top: 1px solid #edf2f7; margin-top: 30px;" />
      <p style="color: #a0aec0; font-size: 11px; text-align: center; margin: 0;">
        &copy; ${new Date().getFullYear()} Griffin Store. Tous droits réservés.
      </p>
    </div>
  `;

  // 1. Essai d'envoi via Resend API
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      console.log(`[EmailService] Tentative d'envoi du code de vérification via Resend à ${target}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || 'onboarding@resend.dev',
          to: target,
          subject: subject,
          text: plainText,
          html: htmlBody
        })
      });

      const resJson = await response.json();
      if (response.ok) {
        console.log(`[EmailService] Code envoyé via Resend à ${target} ! ID: ${resJson.id}`);
        return { success: true, method: 'resend', id: resJson.id };
      } else {
        console.error(`[EmailService] Échec Resend :`, resJson);
      }
    } catch (resendError) {
      console.error(`[EmailService] Erreur lors de l'envoi Resend :`, resendError.message);
    }
  }

  // 2. Essai d'envoi via SMTP
  if (hasSmtpConfig) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: parseInt(port, 10) === 465,
        auth: { user, pass }
      });

      await transporter.sendMail({
        from,
        to: target,
        subject,
        text: plainText,
        html: htmlBody
      });

      console.log(`[EmailService] Code envoyé via SMTP à ${target} !`);
      return { success: true, method: 'smtp' };
    } catch (smtpError) {
      console.error(`[EmailService] Échec SMTP à ${target} :`, smtpError.message);
    }
  }

  // 3. Essai d'envoi via Ethereal Mail
  try {
    console.log(`[EmailService] SMTP absent. Génération d'une boîte de test Ethereal...`);
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });

    const info = await transporter.sendMail({
      from: '"Griffin Store" <noreply@griffinstore.com>',
      to: target,
      subject,
      text: plainText,
      html: htmlBody
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    const logContent = `
========================================
[CODE VERIFICATION - ETHEREAL] Envoyé le : ${new Date().toISOString()}
Destinataire  : ${target}
Code envoyé   : ${code}
Lien d'aperçu : ${previewUrl}
========================================
`;
    fs.appendFileSync(logFilePath, logContent, 'utf8');

    console.log('\n======================================================================');
    console.log(`[EmailService] CODE ENVOYÉ (Aperçu Ethereal disponible) !`);
    console.log(`Destinataire : ${target}`);
    console.log(`Code         : ${code}`);
    console.log(`Lien d'aperçu : ${previewUrl}`);
    console.log(`*(Copiez et ouvrez ce lien dans votre navigateur pour voir le code reçu !)*`);
    console.log('======================================================================\n');

    return { success: true, method: 'ethereal', url: previewUrl };
  } catch (etherealError) {
    console.error(`[EmailService] Échec Ethereal, repli sur fichier log local :`, etherealError.message);
  }

  // 4. Log local en dernier recours (développement hors ligne)
  const logContent = `
========================================
[CODE VERIFICATION - LOCAL] Envoyé le : ${new Date().toISOString()}
Destinataire : ${target}
Code envoyé  : ${code}
========================================
`;
  try {
    fs.appendFileSync(logFilePath, logContent, 'utf8');
  } catch (fsError) {
    console.error('[EmailService] Impossible d\'écrire dans sent_emails.log:', fsError.message);
  }

  console.log('\n======================================================================');
  console.log(`[EmailService] MODE LOCAL : Code écrit dans le fichier log`);
  console.log(`Destinataire : ${target}`);
  console.log(`Code         : ${code}`);
  console.log(`-> Écrit dans : backend/data/sent_emails.log`);
  console.log('======================================================================\n');

  return { success: true, method: 'dev_log' };
}

module.exports = {
  sendVerificationEmail
};
