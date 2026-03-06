// src/components/session/RedeemSessionCode.jsx
//
// Single-step modal for redeeming a session login code on a shared/meeting-room device.
// Uses BaseDialog for consistent modal behavior (Escape, overlay click, close button).
//
// User enters 6-char code → Worker returns PAT + GitLab URL → testConnection() verifies
// → addSessionCredential() stores in sessionStorage → onSuccess(cred) fires.
//
// If connection fails, the user can retry (code is already consumed, but PAT + URL
// are held in local state so retries don't need a new code).

import { useState, useRef } from 'react';
import { redeemSessionCode } from '../../utils/sessionWorkerClient';
import {
  gitlabCredentialManager,
  GitLabCredentialManager,
} from '../../config/GitLabCredentialManager';
import { BaseDialog } from '../shared/dialogs/BaseDialog';

// Matches characters NOT in the session code alphabet (no 0/O/1/I to avoid visual confusion)
const NON_CODE_CHAR = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;

/**
 * @param {Object} props
 * @param {Function} props.onSuccess - Called with the new GitLabCredential on success
 * @param {Function} props.onClose - Called when user cancels
 */
export function RedeemSessionCode({ onSuccess, onClose }) {
  const [code, setCode] = useState('');
  // After code redemption, PAT + URL are held in state for connection retries
  // without consuming a new code.
  const [redeemed, setRedeemed] = useState(null); // { pat, gitlabUrl }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.toUpperCase().replace(NON_CODE_CHAR, '').slice(0, 6);
      if (cleaned) setCode(cleaned);
    } catch {
      // Clipboard API denied — focus input so user can Ctrl+V manually
      inputRef.current?.focus();
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Redeem code (or reuse previously redeemed data on retry)
      let data = redeemed;
      if (!data) {
        if (code.trim().length !== 6) {
          setError('Code must be 6 characters');
          setLoading(false);
          return;
        }
        data = await redeemSessionCode(code);
        setRedeemed(data);
      }

      // Step 2: Test connection with the PAT + URL from the code
      const test = await GitLabCredentialManager.testConnection({
        gitlabUrl: data.gitlabUrl,
        token: data.pat,
      });
      if (!test.success) {
        // Truncate HTML-heavy errors (e.g. Cloudflare error pages) to keep UI usable
        const msg =
          test.error?.length > 200
            ? test.error
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 200) + '…'
            : test.error;
        setError(`Connection failed: ${msg}`);
        return;
      }

      // Step 3: Save session credential
      const cred = gitlabCredentialManager.addSessionCredential({
        name: `Session (${test.username})`,
        gitlabUrl: data.gitlabUrl,
        token: data.pat,
      });
      onSuccess(cred);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || (!redeemed && code.length !== 6);

  const footer = (
    <>
      <button onClick={onClose} className="dialog-btn dialog-btn-secondary">
        Cancel
      </button>
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className="dialog-btn dialog-btn-primary"
      >
        {loading
          ? redeemed
            ? 'Connecting…'
            : 'Redeeming…'
          : redeemed
            ? 'Retry'
            : 'Sign In'}
      </button>
    </>
  );

  return (
    <BaseDialog
      isOpen={true}
      onClose={onClose}
      title="Use Login Code"
      width={400}
      className="redeem-code-dialog"
      footer={footer}
    >
      <p className="dialog-hint">
        Enter the 6-character code from your other device. Your credentials
        are loaded for this session only and cleared when you close this tab.
      </p>

      <div className="dialog-form-group">
        <label>Login Code</label>
        <div className="redeem-code-input-row">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(NON_CODE_CHAR, ''),
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isDisabled) handleSubmit();
            }}
            placeholder="AB3K9X"
            maxLength={6}
            autoFocus
            disabled={!!redeemed}
            className="dialog-input redeem-code-input"
          />
          {!redeemed && (
            <button
              onClick={handlePaste}
              className="dialog-btn dialog-btn-secondary redeem-code-paste-btn"
              title="Paste from clipboard"
              type="button"
            >
              Paste
            </button>
          )}
        </div>
        <span className="dialog-hint">Letters A–Z (no O or I) and digits 2–9</span>
      </div>

      {error && (
        <div className="dialog-error" style={{ maxHeight: '80px', overflowY: 'auto', wordBreak: 'break-word' }}>
          {error}
        </div>
      )}

      <style>{`
        .redeem-code-input-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .redeem-code-input {
          flex: 1;
          min-width: 0;
          font-family: monospace !important;
          font-size: 20px !important;
          letter-spacing: 0.2em !important;
          text-align: center !important;
        }
        .redeem-code-input:disabled {
          opacity: 0.5;
        }
        .redeem-code-paste-btn {
          white-space: nowrap;
        }
      `}</style>
    </BaseDialog>
  );
}
