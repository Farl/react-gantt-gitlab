// src/components/session/RedeemSessionCode.jsx
//
// Two-step modal for redeeming a session login code on a shared/meeting-room device.
//
// Step A (code): User enters the 6-char code → PAT fetched from Worker (KV entry deleted)
//   PAT is held in local state from this point — never re-fetched.
// Step B (url):  User confirms GitLab URL → testConnection() verifies PAT+URL.
//   If connection fails, the URL can be corrected and retried without a new code.
//   On success, addSessionCredential() is called and onSuccess(cred) fires.

import { useState } from 'react';
import { redeemSessionCode } from '../../utils/sessionWorkerClient';
import {
  gitlabCredentialManager,
  GitLabCredentialManager,
} from '../../config/GitLabCredentialManager';

/**
 * @param {Object} props
 * @param {string} [props.initialGitlabUrl] - Pre-filled GitLab URL (from first persistent credential)
 * @param {Function} props.onSuccess - Called with the new GitLabCredential on success
 * @param {Function} props.onClose - Called when user cancels
 */
export function RedeemSessionCode({ initialGitlabUrl = '', onSuccess, onClose }) {
  const [step, setStep] = useState('code'); // 'code' | 'url'
  const [code, setCode] = useState('');
  const [gitlabUrl, setGitlabUrl] = useState(initialGitlabUrl);
  // PAT is fetched once in step 'code' and retained for step 'url' retries.
  // testConnection failures do NOT consume a new code.
  const [fetchedPat, setFetchedPat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFetchPat = async () => {
    if (code.trim().length !== 6) {
      setError('Code must be 6 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pat = await redeemSessionCode(code);
      setFetchedPat(pat);
      setStep('url');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!fetchedPat) {
      // Shouldn't happen in normal flow, but guard against component remount losing state
      setError('Session expired. Please go back and enter the code again.');
      setStep('code');
      return;
    }
    if (!gitlabUrl.trim()) {
      setError('GitLab URL is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const test = await GitLabCredentialManager.testConnection({
        gitlabUrl: gitlabUrl.trim(),
        token: fetchedPat,
      });
      if (!test.success) {
        // Truncate HTML-heavy errors (e.g. Cloudflare error pages) to keep UI usable
        const msg = test.error?.length > 200
          ? test.error.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) + '…'
          : test.error;
        setError(`Connection failed: ${msg}`);
        return;
      }
      const cred = gitlabCredentialManager.addSessionCredential({
        name: `Session (${test.username})`,
        gitlabUrl: gitlabUrl.trim(),
        token: fetchedPat,
      });
      onSuccess(cred);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20000,
  };

  const cardStyle = {
    background: 'var(--wx-gitlab-modal-background, #fff)',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    maxWidth: '360px',
    width: '90%',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--wx-gitlab-modal-text, #333)',
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid var(--wx-gitlab-filter-input-border, #ccc)',
    borderRadius: '6px',
    background: 'var(--wx-gitlab-filter-input-background, #fff)',
    color: 'var(--wx-gitlab-modal-text, #333)',
    fontSize: '14px',
    boxSizing: 'border-box',
    marginBottom: '16px',
  };

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: 'var(--wx-gitlab-modal-text, #333)' }}>
          Use Login Code
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '13px', color: 'var(--wx-gitlab-modal-hint-text, #666)' }}>
          {step === 'code'
            ? 'Enter the 6-character code from your other device.'
            : 'Confirm your GitLab URL to complete sign-in. Your credentials are loaded for this session only and cleared when you close this tab.'}
        </p>

        {step === 'code' && (
          <>
            <label style={labelStyle}>Login Code</label>
            <input
              type="text"
              value={code}
              onChange={(e) =>
                // Strip chars not in CHARS alphabet (no 0/O/1/I to avoid visual confusion)
                setCode(e.target.value.toUpperCase().replace(/[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g, ''))
              }
              placeholder="AB3K9X"
              maxLength={6}
              autoFocus
              style={{
                ...inputStyle,
                fontFamily: 'monospace',
                fontSize: '24px',
                letterSpacing: '0.3em',
                textAlign: 'center',
              }}
            />
            <p style={{ fontSize: '12px', color: 'var(--wx-gitlab-modal-hint-text, #999)', marginTop: '-12px', marginBottom: '16px', textAlign: 'center' }}>
              Letters A–Z (no O or I) and digits 2–9
            </p>
          </>
        )}

        {step === 'url' && (
          <>
            <label style={labelStyle}>GitLab URL</label>
            <input
              type="url"
              value={gitlabUrl}
              onChange={(e) => setGitlabUrl(e.target.value)}
              placeholder="https://gitlab.company.com"
              autoFocus
              style={inputStyle}
            />
          </>
        )}

        {error && (
          <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '16px', maxHeight: '80px', overflowY: 'auto', wordBreak: 'break-word' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              background: 'none',
              fontSize: '14px',
              cursor: 'pointer',
              color: 'var(--wx-gitlab-modal-text, #333)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={step === 'code' ? handleFetchPat : handleVerify}
            disabled={loading || (step === 'code' && code.length !== 6)}
            style={{
              flex: 1,
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              background: '#3b82f6',
              color: '#fff',
              fontSize: '14px',
              cursor: 'pointer',
              opacity: loading || (step === 'code' && code.length !== 6) ? 0.5 : 1,
            }}
          >
            {loading ? 'Loading…' : step === 'code' ? 'Next' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
