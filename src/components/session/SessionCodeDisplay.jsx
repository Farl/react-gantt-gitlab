// src/components/session/SessionCodeDisplay.jsx
//
// Overlay that shows the generated 6-char session code with a countdown timer.
// Auto-closes when the code expires.

import { useState, useEffect, useRef } from 'react';

/**
 * @param {Object} props
 * @param {string} props.code - The 6-char session code to display
 * @param {number} props.expiresAt - Expiry timestamp (ms)
 * @param {string} props.credentialName - Name of the credential this code is for
 * @param {Function} props.onClose - Called when user closes or code expires
 */
export function SessionCodeDisplay({ code, expiresAt, credentialName, onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.round((expiresAt - Date.now()) / 1000)),
  );
  // Use a ref for onClose so the interval never needs to re-register when the
  // parent passes a new arrow function reference on re-render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(interval);
        onCloseRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]); // intentionally omit onClose — using ref instead

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const isExpiringSoon = secondsLeft < 60;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20000,
      }}
    >
      <div
        style={{
          background: 'var(--wx-gitlab-modal-background, #fff)',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          textAlign: 'center',
          maxWidth: '360px',
          width: '90%',
        }}
      >
        <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: 'var(--wx-gitlab-modal-text, #333)' }}>
          Login Code
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--wx-gitlab-modal-hint-text, #666)' }}>
          {credentialName}
        </p>

        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '48px',
            fontWeight: 'bold',
            letterSpacing: '0.3em',
            color: '#3b82f6',
            marginBottom: '24px',
            userSelect: 'all',
          }}
        >
          {code}
        </div>

        <p style={{ fontSize: '13px', color: 'var(--wx-gitlab-modal-hint-text, #666)', marginBottom: '24px' }}>
          Enter this code on the other device.
          <br />
          Expires in{' '}
          <span style={{ color: isExpiringSoon ? '#ef4444' : 'inherit', fontWeight: isExpiringSoon ? 600 : 'normal' }}>
            {minutes}:{seconds}
          </span>
        </p>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '13px',
            color: 'var(--wx-gitlab-modal-hint-text, #999)',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
