import React, { useState } from 'react';
import { loginMerchant } from '../services/api';
import { Lock, Mail } from 'lucide-react';

interface Props {
  onSuccess: () => void;
}

export const LoginModal: React.FC<Props> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await loginMerchant(email, password);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Authentication failed. Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
      <div style={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155', width: '100%', maxWidth: '400px', padding: '2rem', color: '#f8fafc' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', textAlign: 'center', color: '#38bdf8' }}>Merchant Sign In</h2>
        <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#94a3b8', textAlign: 'center' }}>
          Access Control Tower Dashboard
        </p>

        {error && (
          <div style={{ backgroundColor: '#9f1239', color: '#fda4af', padding: '0.75rem', borderRadius: '0.25rem', fontSize: '0.8125rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Email</label>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.25rem', padding: '0.5rem' }}>
              <Mail size={16} style={{ color: '#64748b', marginRight: '0.5rem' }} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="merchant@example.com"
                style={{ background: 'none', border: 'none', color: '#f8fafc', width: '100%', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Password</label>
            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '0.25rem', padding: '0.5rem' }}>
              <Lock size={16} style={{ color: '#64748b', marginRight: '0.5rem' }} />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ background: 'none', border: 'none', color: '#f8fafc', width: '100%', outline: 'none' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.25rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};
