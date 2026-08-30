import React from 'react';
import { DashboardSummary } from '../types';
import { ShieldAlert, CheckCircle2, TrendingUp, RefreshCw } from 'lucide-react';

interface Props {
  summary: DashboardSummary | null;
  loading: boolean;
  onRefresh: () => void;
}

const formatINR = (paise: number) => {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
};

export const ExecutiveSummaryCards: React.FC<Props> = ({ summary, loading, onRefresh }) => {
  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--rzp-text-primary)' }}>
            Overview
          </h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--rzp-text-secondary)' }}>
            Real-time revenue loss monitoring & recovery performance
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#ffffff',
              color: 'var(--rzp-blue)',
              border: '1px solid var(--rzp-border)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8125rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'background 0.2s',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Hero Card: Total Collected & Verified Revenue */}
      <div
        style={{
          backgroundColor: 'var(--rzp-card)',
          borderRadius: '0.5rem',
          border: '1px solid var(--rzp-border)',
          padding: '1.5rem',
          marginBottom: '1.25rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--rzp-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Total Verified Recovered Revenue
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.375rem', color: 'var(--rzp-green)' }}>
            {summary ? formatINR(summary.verifiedRecoveredPaise) : '₹0.00'}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--rzp-text-secondary)', marginTop: '0.25rem' }}>
            Authoritative proof from Razorpay payment webhooks & ledger state
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--rzp-green-bg)',
            padding: '1rem 1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--rzp-green-border)',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--rzp-green)', textTransform: 'uppercase' }}>
            Active Opportunities
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--rzp-green)', marginTop: '0.125rem' }}>
            {summary?.activeOpportunitiesCount || 0}
          </div>
        </div>
      </div>

      {/* 3-Column Metric Summary Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        {/* Card 1: Expected ERV (Blue Border) */}
        <div
          style={{
            backgroundColor: 'var(--rzp-card)',
            padding: '1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--rzp-border)',
            borderLeft: '4px solid var(--rzp-blue)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rzp-text-secondary)' }}>
              EXPECTED RECOVERABLE (ERV)
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--rzp-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} color="var(--rzp-blue)" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--rzp-text-primary)' }}>
            {summary ? formatINR(summary.expectedRecoverablePaise) : '₹0.00'}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--rzp-text-secondary)' }}>Probability-weighted valuation</span>
          </div>
        </div>

        {/* Card 2: Revenue at Risk (Red Border) */}
        <div
          style={{
            backgroundColor: 'var(--rzp-card)',
            padding: '1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--rzp-border)',
            borderLeft: '4px solid var(--rzp-red)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rzp-text-secondary)' }}>
              REVENUE AT RISK
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--rzp-red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={16} color="var(--rzp-red)" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--rzp-red)' }}>
            {summary ? formatINR(summary.revenueAtRiskPaise) : '₹0.00'}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--rzp-text-secondary)' }}>
              {summary?.activeOpportunitiesCount || 0} active open leakage cases
            </span>
          </div>
        </div>

        {/* Card 3: Recovery Rate (Green Border) */}
        <div
          style={{
            backgroundColor: 'var(--rzp-card)',
            padding: '1.25rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--rzp-border)',
            borderLeft: '4px solid var(--rzp-green)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--rzp-text-secondary)' }}>
              RECOVERY RATE
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--rzp-green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="var(--rzp-green)" />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: 'var(--rzp-green)' }}>
            {summary ? `${summary.recoveryRatePercentage}%` : '0%'}
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--rzp-text-secondary)' }}>
              Total: {summary?.totalOpportunitiesCount || 0} evaluated cases
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
