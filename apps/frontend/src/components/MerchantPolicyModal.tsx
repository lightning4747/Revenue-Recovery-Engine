import React, { useEffect, useState } from 'react';
import { fetchCredentials, fetchPolicy, updateCredentials, updatePolicy } from '../services/api';
import { MerchantCredentials, MerchantPolicy } from '../types';
import { X, Sliders, Key, Save, CheckCircle2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const MerchantPolicyModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [policy, setPolicy] = useState<MerchantPolicy>({
    minRecoveryAmountPaise: 10000,
    maxRetryCount: 3,
    autoExecutionEnabled: true,
  });
  const [credentials, setCredentials] = useState<MerchantCredentials>({});
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    Promise.all([fetchPolicy(), fetchCredentials()])
      .then(([policyData, credData]) => {
        if (policyData) setPolicy(policyData);
        if (credData) {
          setCredentials(credData);
          setKeyId(credData.keyId || '');
        }
      })
      .catch((err) => {
        console.error('Failed to load merchant settings', err);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      await updatePolicy({
        minRecoveryAmountPaise: Number(policy.minRecoveryAmountPaise),
        maxRetryCount: Number(policy.maxRetryCount),
        autoExecutionEnabled: Boolean(policy.autoExecutionEnabled),
      });

      if (keyId && (keySecret || webhookSecret)) {
        await updateCredentials({
          keyId,
          keySecret,
          webhookSecret,
        });
      }

      setSuccessMsg('Merchant policy & API credentials saved successfully!');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || 'Failed to save merchant policy configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          border: '1px solid var(--rzp-border)',
          width: '100%',
          maxWidth: '580px',
          padding: '1.75rem',
          color: 'var(--rzp-text-primary)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--rzp-border)',
            paddingBottom: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={20} color="var(--rzp-blue)" /> Merchant Policy & API Configuration
            </h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--rzp-text-secondary)' }}>
              Configure automated recovery thresholds & Razorpay API credentials
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--rzp-text-secondary)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--rzp-text-secondary)' }}>
            Loading merchant configuration...
          </div>
        ) : (
          <form onSubmit={handleSave}>
            {successMsg && (
              <div
                style={{
                  backgroundColor: 'var(--rzp-green-bg)',
                  color: 'var(--rzp-green)',
                  border: '1px solid var(--rzp-green-border)',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  marginBottom: '1.25rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle2 size={16} /> {successMsg}
              </div>
            )}

            {errorMsg && (
              <div
                style={{
                  backgroundColor: 'var(--rzp-red-bg)',
                  color: 'var(--rzp-red)',
                  border: '1px solid var(--rzp-red-border)',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  marginBottom: '1.25rem',
                  fontWeight: 500,
                }}
              >
                {errorMsg}
              </div>
            )}

            {/* Policy Thresholds */}
            <div style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--rzp-border)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--rzp-text-primary)' }}>
                Recovery Policy Guardrails
              </h4>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
                  Minimum Recovery Threshold (Rupees ₹)
                </label>
                <input
                  type="number"
                  value={policy.minRecoveryAmountPaise / 100}
                  onChange={(e) => setPolicy({ ...policy, minRecoveryAmountPaise: Math.round(Number(e.target.value) * 100) })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--rzp-border)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
                  Maximum Retry Attempts
                </label>
                <input
                  type="number"
                  value={policy.maxRetryCount}
                  onChange={(e) => setPolicy({ ...policy, maxRetryCount: Number(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--rzp-border)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--rzp-text-primary)', display: 'block' }}>
                    Automated Recovery Execution
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--rzp-text-secondary)' }}>
                    Automatically trigger payment links for prioritized opportunities
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={policy.autoExecutionEnabled}
                  onChange={(e) => setPolicy({ ...policy, autoExecutionEnabled: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>
            </div>

            {/* Razorpay API Credentials */}
            <div style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid var(--rzp-border)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--rzp-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={16} color="var(--rzp-blue)" /> Razorpay Webhook & API Credentials
              </h4>

              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', marginBottom: '0.375rem' }}>
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  value={keyId}
                  onChange={(e) => setKeyId(e.target.value)}
                  placeholder="rzp_test_..."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--rzp-border)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                  className="font-mono"
                />
              </div>

              <div style={{ marginBottom: '0.875rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', marginBottom: '0.375rem' }}>
                  Razorpay Key Secret {credentials.hasKeySecret ? '(Secret Configured)' : ''}
                </label>
                <input
                  type="password"
                  value={keySecret}
                  onChange={(e) => setKeySecret(e.target.value)}
                  placeholder={credentials.hasKeySecret ? '••••••••' : 'Enter Razorpay Key Secret'}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--rzp-border)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', marginBottom: '0.375rem' }}>
                  Webhook Secret {credentials.hasWebhookSecret ? '(Secret Configured)' : ''}
                </label>
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder={credentials.hasWebhookSecret ? '••••••••' : 'Enter Webhook Secret'}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--rzp-border)',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--rzp-border)', paddingTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#ffffff',
                  color: 'var(--rzp-text-primary)',
                  border: '1px solid var(--rzp-border)',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Close
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1.25rem',
                  backgroundColor: 'var(--rzp-blue)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                }}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
