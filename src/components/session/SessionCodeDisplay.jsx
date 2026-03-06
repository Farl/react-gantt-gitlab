// src/components/session/SessionCodeDisplay.jsx
//
// Modal overlay that shows the generated 6-char session code with a countdown timer.
// Auto-closes when the code expires. Uses BaseDialog for consistent modal behavior.

import { useState, useEffect, useRef } from 'react';
import { BaseDialog } from '../shared/dialogs/BaseDialog';

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
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);
  const copyTimeoutRef = useRef(null);

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

  // Clear copy feedback timeout on unmount to avoid setState on unmounted component
  useEffect(() => () => clearTimeout(copyTimeoutRef.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the code text for manual copy
      const selection = window.getSelection();
      const range = document.createRange();
      if (codeRef.current) {
        range.selectNodeContents(codeRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, '0');
  const isExpiringSoon = secondsLeft < 60;

  return (
    <BaseDialog
      isOpen={true}
      onClose={onClose}
      title="Login Code"
      width={380}
      className="session-code-dialog"
    >
      <div style={{ textAlign: 'center' }}>
        <p className="dialog-hint" style={{ marginBottom: '16px' }}>{credentialName}</p>

        {/* Clickable code area — click to copy */}
        <button
          ref={codeRef}
          onClick={handleCopy}
          className={`session-code-value ${copied ? 'session-code-copied' : ''}`}
          title="Click to copy"
        >
          <span className="session-code-text">{code}</span>
          <span className="session-code-copy-hint">
            {copied ? 'Copied!' : 'Click to copy'}
          </span>
        </button>

        <p className="dialog-hint">
          Enter this code on the other device.
          <br />
          Expires in{' '}
          <span className={isExpiringSoon ? 'session-code-expiring' : ''}>
            {minutes}:{seconds}
          </span>
        </p>
      </div>

      <style>{`
        .session-code-value {
          display: block;
          width: 100%;
          border: 2px dashed var(--wx-gitlab-filter-input-border, #ccc);
          border-radius: 8px;
          background: var(--wx-gitlab-filter-background, #f8f9fa);
          padding: 16px 8px 8px;
          margin-bottom: 16px;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }
        .session-code-value:hover {
          border-color: var(--wx-gitlab-modal-text, #999);
          background: var(--wx-gitlab-button-hover-background, rgba(0, 0, 0, 0.03));
        }
        .session-code-value.session-code-copied {
          border-color: #28a745;
          background: #d4edda;
        }
        .session-code-text {
          display: block;
          font-family: monospace;
          font-size: 48px;
          font-weight: bold;
          letter-spacing: 0.3em;
          color: var(--wx-gitlab-modal-text, #333);
          user-select: all;
        }
        .session-code-copy-hint {
          display: block;
          font-size: 12px;
          color: var(--wx-gitlab-modal-hint-text, #999);
          margin-top: 4px;
        }
        .session-code-copied .session-code-copy-hint {
          color: #155724;
        }
        .session-code-expiring {
          color: #ef4444;
          font-weight: 600;
        }
      `}</style>
    </BaseDialog>
  );
}
