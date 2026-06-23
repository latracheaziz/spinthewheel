import React, { useState } from 'react';
import { X, Gift, Copy, Check, Info } from 'lucide-react';
import '../styles/main.css';

export default function Modal({ isOpen, onClose, reward, couponCode }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isLosing = reward.name.toLowerCase().includes('pas de chance') || 
                   reward.name.toLowerCase().includes('perdu') ||
                   reward.name.toLowerCase().includes('prochaine') ||
                   reward.name.toLowerCase().includes('essaie');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(couponCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.overlay}>
      <div className="glass-panel" style={styles.modalContent}>
        {/* Bouton de fermeture */}
        <button onClick={onClose} style={styles.closeBtn}>
          <X size={20} />
        </button>

        {isLosing ? (
          // Contenu en cas de perte
          <div style={styles.body}>
            <h2 style={styles.title}>Essaie à la prochaine ! 😊</h2>
            <p style={styles.desc}>
              Pas de chance cette fois-ci ! Garde le sourire, d'autres surprises t'attendent très bientôt.
            </p>
            <button onClick={onClose} className="btn-primary" style={styles.actionBtn}>
              Fermer
            </button>
          </div>
        ) : (
          // Contenu en cas de gain
          <div style={styles.body}>
            <div style={{ ...styles.iconContainer, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
              <Gift size={40} />
            </div>
            <h2 style={styles.title}>Félicitations ! 🎉</h2>
            <p style={styles.desc}>
              Vous avez remporté la récompense suivante : <br />
              <strong style={styles.rewardHighlight}>{reward.name}</strong>
            </p>

            <div style={styles.couponContainer}>
              <span style={styles.couponLabel}>Votre code de réduction :</span>
              <div style={styles.couponRow}>
                <span style={styles.couponText}>{couponCode}</span>
                <button 
                  onClick={copyToClipboard} 
                  style={{
                    ...styles.copyBtn,
                    background: copied ? 'var(--success)' : 'rgba(255, 255, 255, 0.08)'
                  }}
                  title="Copier le code"
                >
                  {copied ? <Check size={16} color="white" /> : <Copy size={16} color="white" />}
                </button>
              </div>
              {copied && <span style={styles.copiedText}>Code copié dans le presse-papiers !</span>}
            </div>

            <p style={styles.disclaimer}>
              Utilisez ce code lors de votre passage en caisse pour appliquer votre gain.
            </p>

            <button onClick={onClose} className="btn-primary" style={styles.actionBtn}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 5, 10, 0.85)',
    backdropFilter: 'blur(8px)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '1rem',
    animation: 'fadeIn 0.2s ease-out'
  },
  modalContent: {
    width: '100%',
    maxWidth: '480px',
    padding: '2.5rem 2rem',
    position: 'relative',
    textAlign: 'center',
    transform: 'scale(1)',
    animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
  },
  closeBtn: {
    position: 'absolute',
    top: '1.25rem',
    right: '1.25rem',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '0.25rem',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.05)'
    }
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem'
  },
  iconContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.5rem'
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: '800',
    color: '#ffffff'
  },
  desc: {
    color: 'var(--text-secondary)',
    fontSize: '1.05rem',
    lineHeight: '1.5'
  },
  rewardHighlight: {
    color: 'var(--accent-gold)',
    fontSize: '1.4rem',
    display: 'inline-block',
    marginTop: '0.5rem',
    fontWeight: '800',
    textShadow: '0 0 10px rgba(245, 158, 11, 0.2)'
  },
  couponContainer: {
    background: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '1rem',
    width: '100%',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  couponLabel: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  couponRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem'
  },
  couponText: {
    fontFamily: 'monospace',
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '0.05em',
    wordBreak: 'break-all'
  },
  copyBtn: {
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  copiedText: {
    fontSize: '0.8rem',
    color: 'var(--success)',
    alignSelf: 'flex-start'
  },
  disclaimer: {
    fontSize: '0.8rem',
    color: 'var(--text-secondary)',
    fontStyle: 'italic'
  },
  actionBtn: {
    width: '100%',
    padding: '0.85rem 1.5rem',
    fontSize: '1rem',
    marginTop: '0.5rem'
  }
};
