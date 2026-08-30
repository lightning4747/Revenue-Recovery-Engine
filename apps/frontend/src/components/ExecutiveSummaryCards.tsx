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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Executive Summary</h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#1e293b',
            color: '#38bdf8',
            border: '1px solid #334155',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {/* Card 1: Revenue at Risk */}
        <div style={{ backgroundColor: '#1e293b', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#f43f5e' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8' }}>Revenue at Risk</span>
            <ShieldAlert size={20} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem', color: '#f43f5e' }}>
            {summary ? formatINR(summary.revenueAtRiskPaise) : '₹0.00'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
            {summary?.activeOpportunitiesCount || 0} active opportunities
          </div>
        </div>

        {/* Card 2: Verified Recovered */}
        <div style={{ backgroundColor: '#1e293b', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#10b981' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8' }}>Verified Recovered</span>
            <CheckCircle2 size={20} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem', color: '#10b981' }}>
            {summary ? formatINR(summary.verifiedRecoveredPaise) : '₹0.00'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Authoritative proof</div>
        </div>

        {/* Card 3: Expected Recoverable (ERV) */}
        <div style={{ backgroundColor: '#1e293b', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#38bdf8' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8' }}>Expected ERV</span>
            <TrendingUp size={20} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem', color: '#38bdf8' }}>
            {summary ? formatINR(summary.expectedRecoverablePaise) : '₹0.00'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Probability-weighted</div>
        </div>

        {/* Card 4: Recovery Rate */}
        <div style={{ backgroundColor: '#1e293b', padding: '1.25rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#a855f7' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#94a3b8' }}>Recovery Rate</span>
            <TrendingUp size={20} />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.5rem', color: '#a855f7' }}>
            {summary ? `${summary.recoveryRatePercentage}%` : '0%'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Efficiency index</div>
        </div>
      </div>
    </div>
  );
};
