import React from 'react';
import { ShieldCheck, Search, Bell, LogOut, Terminal, QrCode } from 'lucide-react';

interface Props {
  onLogout: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export const Topbar: React.FC<Props> = ({ onLogout, activeTab = 'payments', onTabChange }) => {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        backgroundColor: 'var(--rzp-topbar)',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        zIndex: 1000,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
      }}
    >
      {/* Left Branding & Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <ShieldCheck size={24} color="#2160d5" style={{ fill: '#2160d5', stroke: '#ffffff' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, fontStyle: 'italic', letterSpacing: '-0.5px' }}>
              Razorpay
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Revenue Recovery
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', gap: '1.5rem', height: '56px' }}>
          <button
            onClick={() => onTabChange && onTabChange('payments')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'payments' ? '#ffffff' : '#94a3b8',
              fontWeight: activeTab === 'payments' ? 600 : 400,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              borderBottom: activeTab === 'payments' ? '2px solid var(--rzp-blue)' : '2px solid transparent',
              padding: '0 0.25rem',
              transition: 'all 0.2s',
            }}
          >
            Payments
          </button>
          <button
            onClick={() => onTabChange && onTabChange('orders')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'orders' ? '#ffffff' : '#94a3b8',
              fontWeight: activeTab === 'orders' ? 600 : 400,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              borderBottom: activeTab === 'orders' ? '2px solid var(--rzp-blue)' : '2px solid transparent',
              padding: '0 0.25rem',
              transition: 'all 0.2s',
            }}
          >
            Recovery Opportunities
          </button>
          <button
            onClick={() => onTabChange && onTabChange('policy')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'policy' ? '#ffffff' : '#94a3b8',
              fontWeight: activeTab === 'policy' ? 600 : 400,
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              borderBottom: activeTab === 'policy' ? '2px solid var(--rzp-blue)' : '2px solid transparent',
              padding: '0 0.25rem',
              transition: 'all 0.2s',
            }}
          >
            Merchant Policy
          </button>
        </nav>
      </div>

      {/* Centered Test Mode Badge Pill */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          top: 0,
          backgroundColor: '#1f2937',
          borderBottomLeftRadius: '0.75rem',
          borderBottomRightRadius: '0.75rem',
          padding: '0.25rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          border: '1px solid #374151',
          borderTop: 'none',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', color: '#e5e7eb' }}>
            TEST MODE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #374151', paddingLeft: '0.75rem', color: '#9ca3af' }}>
          <span title="Scan QR" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            <QrCode size={14} />
          </span>
          <span title="Developer Logs" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            <Terminal size={14} />
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Global Search Input */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#1f2937',
            borderRadius: '0.375rem',
            padding: '0.375rem 0.75rem',
            width: '240px',
            border: '1px solid #374151',
          }}
        >
          <Search size={16} color="#9ca3af" style={{ marginRight: '0.5rem' }} />
          <input
            type="text"
            placeholder="Search Opportunities (Cmd+K)"
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '0.8125rem',
              outline: 'none',
              width: '100%',
            }}
          />
        </div>

        <button
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '0.375rem',
            borderRadius: '0.25rem',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* User Account / Sign Out */}
        <button
          onClick={onLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.75rem',
            backgroundColor: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 500,
            transition: 'background 0.2s',
          }}
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>
    </header>
  );
};
