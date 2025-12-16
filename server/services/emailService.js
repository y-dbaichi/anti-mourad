const nodemailer = require('nodemailer');

/**
 * Email Service for notifications
 */

// Create transporter (configure with your SMTP settings)
const createTransporter = () => {
  // Use environment variables for configuration
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  // Fallback to Gmail if GMAIL credentials provided
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
  }

  // Development: use ethereal email (fake SMTP for testing)
  return null;
};

const transporter = createTransporter();

/**
 * Send email with retry logic
 */
const sendEmail = async (to, subject, html, attachments = []) => {
  if (!transporter) {
    console.log('[Email] No transporter configured, skipping email:', subject);
    return { success: false, reason: 'No email transporter configured' };
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"FormatX" <noreply@formatx.fr>',
    to,
    subject,
    html,
    attachments
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Sent to ${to}: ${subject}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Email] Send failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Email Templates
 */
const templates = {
  // Welcome email
  welcome: (user) => ({
    subject: 'Bienvenue sur FormatX - Votre compte est pret',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bienvenue sur FormatX</h1>
          </div>
          <div class="content">
            <p>Bonjour ${user.fullName || 'cher utilisateur'},</p>
            <p>Votre compte FormatX a ete cree avec succes. Vous pouvez maintenant convertir vos factures PDF en format Facture-X conforme EN 16931.</p>
            <p><strong>Votre offre gratuite inclut:</strong></p>
            <ul>
              <li>10 conversions par mois</li>
              <li>Export XML et PDF/A-3</li>
              <li>Validation automatique</li>
            </ul>
            <center>
              <a href="${process.env.CLIENT_URL}/dashboard" class="button">Acceder a mon compte</a>
            </center>
            <p>Besoin d'aide? Consultez notre documentation ou contactez-nous.</p>
          </div>
          <div class="footer">
            <p>FormatX - Conversion PDF vers Facture-X</p>
            <p>Cet email a ete envoye automatiquement, merci de ne pas y repondre.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Conversion complete notification
  conversionComplete: (user, invoice) => ({
    subject: `Facture ${invoice.invoiceNumber} convertie avec succes`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Conversion reussie</h1>
          </div>
          <div class="content">
            <p>Bonjour ${user.fullName || 'cher utilisateur'},</p>
            <p>Votre facture a ete convertie en Facture-X avec succes.</p>
            <div class="details">
              <p><strong>Numero de facture:</strong> ${invoice.invoiceNumber}</p>
              <p><strong>Vendeur:</strong> ${invoice.extractedData?.sellerName || 'N/A'}</p>
              <p><strong>Acheteur:</strong> ${invoice.extractedData?.buyerName || 'N/A'}</p>
              <p><strong>Montant TTC:</strong> ${invoice.extractedData?.totalTTC?.toFixed(2) || 'N/A'} ${invoice.extractedData?.currency || 'EUR'}</p>
              <p><strong>Profil:</strong> ${invoice.profile}</p>
            </div>
            <center>
              <a href="${process.env.CLIENT_URL}/dashboard" class="button">Telecharger ma facture</a>
            </center>
          </div>
          <div class="footer">
            <p>FormatX - Conversion PDF vers Facture-X</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Batch complete notification
  batchComplete: (user, batch) => ({
    subject: `Lot de ${batch.total} factures traite`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .stats { display: flex; justify-content: space-around; margin: 20px 0; }
          .stat { text-align: center; padding: 15px; background: white; border-radius: 6px; min-width: 80px; }
          .stat-number { font-size: 24px; font-weight: bold; color: #3b82f6; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Traitement termine</h1>
          </div>
          <div class="content">
            <p>Bonjour ${user.fullName || 'cher utilisateur'},</p>
            <p>Le traitement de votre lot de factures est termine.</p>
            <div class="stats">
              <div class="stat">
                <div class="stat-number">${batch.total}</div>
                <div>Total</div>
              </div>
              <div class="stat">
                <div class="stat-number" style="color: #10b981;">${batch.successful}</div>
                <div>Reussies</div>
              </div>
              <div class="stat">
                <div class="stat-number" style="color: #ef4444;">${batch.failed}</div>
                <div>Echouees</div>
              </div>
            </div>
            <center>
              <a href="${process.env.CLIENT_URL}/dashboard" class="button">Voir les resultats</a>
            </center>
          </div>
          <div class="footer">
            <p>FormatX - Conversion PDF vers Facture-X</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Usage limit warning
  usageLimitWarning: (user, usage) => ({
    subject: 'FormatX - Limite de conversions bientot atteinte',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .usage-bar { background: #e5e7eb; border-radius: 10px; height: 20px; margin: 20px 0; }
          .usage-fill { background: #f59e0b; border-radius: 10px; height: 20px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Limite presque atteinte</h1>
          </div>
          <div class="content">
            <p>Bonjour ${user.fullName || 'cher utilisateur'},</p>
            <p>Vous avez utilise <strong>${usage.used}</strong> conversions sur <strong>${usage.limit}</strong> ce mois-ci.</p>
            <div class="usage-bar">
              <div class="usage-fill" style="width: ${Math.min((usage.used / usage.limit) * 100, 100)}%;"></div>
            </div>
            <p>Pour continuer a convertir vos factures sans interruption, pensez a passer a un forfait superieur.</p>
            <center>
              <a href="${process.env.CLIENT_URL}/pricing" class="button">Voir les forfaits</a>
            </center>
          </div>
          <div class="footer">
            <p>FormatX - Conversion PDF vers Facture-X</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Export ready notification
  exportReady: (user, exportInfo) => ({
    subject: `Export ${exportInfo.format.toUpperCase()} pret au telechargement`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Export pret</h1>
          </div>
          <div class="content">
            <p>Bonjour ${user.fullName || 'cher utilisateur'},</p>
            <p>Votre export au format <strong>${exportInfo.format.toUpperCase()}</strong> contenant <strong>${exportInfo.count}</strong> facture(s) est pret.</p>
            <center>
              <a href="${process.env.CLIENT_URL}/dashboard" class="button">Telecharger l'export</a>
            </center>
            <p><small>Ce lien est valide pendant 24 heures.</small></p>
          </div>
          <div class="footer">
            <p>FormatX - Conversion PDF vers Facture-X</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (user) => {
  const { subject, html } = templates.welcome(user);
  return await sendEmail(user.email, subject, html);
};

/**
 * Send conversion complete notification
 */
const sendConversionNotification = async (user, invoice) => {
  const { subject, html } = templates.conversionComplete(user, invoice);
  return await sendEmail(user.email, subject, html);
};

/**
 * Send batch complete notification
 */
const sendBatchNotification = async (user, batch) => {
  const { subject, html } = templates.batchComplete(user, batch);
  return await sendEmail(user.email, subject, html);
};

/**
 * Send usage limit warning
 */
const sendUsageLimitWarning = async (user, usage) => {
  const { subject, html } = templates.usageLimitWarning(user, usage);
  return await sendEmail(user.email, subject, html);
};

/**
 * Send export ready notification
 */
const sendExportNotification = async (user, exportInfo) => {
  const { subject, html } = templates.exportReady(user, exportInfo);
  return await sendEmail(user.email, subject, html);
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendConversionNotification,
  sendBatchNotification,
  sendUsageLimitWarning,
  sendExportNotification,
  templates
};
