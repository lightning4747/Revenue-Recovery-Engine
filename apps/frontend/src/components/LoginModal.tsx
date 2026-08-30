import React, { useState } from 'react';
import { loginMerchant, registerMerchant } from '../services/api';
import { Lock, Mail, Building2, ShieldCheck } from 'lucide-react';

interface Props {
  onSuccess: () => void;
}

export const LoginModal: React.FC<Props> = ({ onSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegistering) {
        await registerMerchant(email, password, businessName || 'My Business');
      } else {
        await loginMerchant(email, password);
      }
      onSuccess();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          (isRegistering
            ? 'Registration failed. Account may already exist.'
            : 'Authentication failed. Invalid merchant credentials.'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#f4f5f8',
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
          maxWidth: '440px',
          overflow: 'hidden',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Top Dark Header */}
        <div
          style={{
            backgroundColor: 'var(--rzp-topbar)',
            padding: '1.5rem 2rem',
            textAlign: 'center',
            color: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ShieldCheck size={28} color="#2160d5" style={{ fill: '#2160d5', stroke: '#ffffff' }} />
            <span style={{ fontSize: '1.35rem', fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.5px' }}>
              Razorpay
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#ffffff' }}>
            {isRegistering ? 'Create Merchant Account' : 'Merchant Sign In'}
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
            {isRegistering ? 'Register to manage revenue recovery' : 'Revenue Recovery Engine Control Tower'}
          </p>
        </div>

        {/* Card Body */}
        <div style={{ padding: '2rem' }}>
          {error && (
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
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {isRegistering && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
                  Business Name
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--rzp-border)',
                    borderRadius: '0.375rem',
                    padding: '0.625rem 0.875rem',
                  }}
                >
                  <Building2 size={16} color="var(--rzp-text-secondary)" style={{ marginRight: '0.625rem' }} />
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Acme Corporation"
                    style={{ background: 'none', border: 'none', color: 'var(--rzp-text-primary)', width: '100%', outline: 'none', fontSize: '0.875rem' }}
                  />
                </div>
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
                Email Address
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--rzp-border)',
                  borderRadius: '0.375rem',
                  padding: '0.625rem 0.875rem',
                }}
              >
                <Mail size={16} color="var(--rzp-text-secondary)" style={{ marginRight: '0.625rem' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="merchant@example.com"
                  style={{ background: 'none', border: 'none', color: 'var(--rzp-text-primary)', width: '100%', outline: 'none', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase' }}>
                Password
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--rzp-border)',
                  borderRadius: '0.375rem',
                  padding: '0.625rem 0.875rem',
                }}
              >
                <Lock size={16} color="var(--rzp-text-secondary)" style={{ marginRight: '0.625rem' }} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ background: 'none', border: 'none', color: 'var(--rzp-text-primary)', width: '100%', outline: 'none', fontSize: '0.875rem' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: 'var(--rzp-blue)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'pointer',
                marginBottom: '1.25rem',
                boxShadow: '0 2px 4px rgba(33, 96, 213, 0.3)',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Processing...' : isRegistering ? 'Register Account' : 'Sign In to Dashboard'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: 'var(--rzp-text-secondary)' }}>
              {isRegistering ? 'Already have an account? ' : "Don't have a merchant account? "}
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError('');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--rzp-blue)', cursor: 'pointer', fontWeight: 700 }}
              >
                {isRegistering ? 'Sign In' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
