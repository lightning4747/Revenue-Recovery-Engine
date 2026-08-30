import React, { useState } from 'react';
import { Opportunity } from '../types';
import { X, ExternalLink, ShieldCheck, PlayCircle } from 'lucide-react';
import { approveOpportunity } from '../services/api';

interface Props {
  opportunity: Opportunity | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const formatINR = (paise: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
};

export const OpportunityDetailModal: React.FC<Props> = ({ opportunity, onClose, onRefresh }) => {
  const [actionLoading, setActionLoading] = useState(false);

  if (!opportunity) return null;

  const handleApprove = async () => {
    if (!opportunity) return;
    setActionLoading(true);
    try {
      await approveOpportunity(opportunity.id);
      if (onRefresh) onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to approve opportunity', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155', width: '100%', maxWidth: '600px', padding: '1.5rem', color: '#f8fafc' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Opportunity Details</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID:</span>
            <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{opportunity.id}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Status:</span>
            <div style={{ fontWeight: 600, color: '#38bdf8' }}>{opportunity.status}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Amount:</span>
            <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{formatINR(opportunity.amount)}</div>
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Verified Recovered:</span>
            <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#34d399' }}>{formatINR(opportunity.recoveredAmount || 0)}</div>
          </div>
        </div>

        {/* Manual Approval & Trigger Button */}
        {(opportunity.status === 'POLICY_BLOCKED' || opportunity.status === 'PRIORITIZED' || opportunity.status === 'VALUED') && (
          <div style={{ backgroundColor: '#1e3a8a', padding: '1rem', borderRadius: '0.375rem', marginBottom: '1rem', textAlign: 'center' }}>
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.25rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <PlayCircle size={16} /> {actionLoading ? 'Dispatching...' : 'Approve & Dispatch Recovery Link'}
            </button>
          </div>
        )}

        {/* Test Mode Link Launch Button */}
        {opportunity.lastPaymentLinkUrl && (
          <div style={{ backgroundColor: '#0284c7', padding: '1rem', borderRadius: '0.375rem', marginBottom: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: '#ffffff' }}>
              <ShieldCheck size={18} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} /> Test Mode Sandbox Launch
            </div>
            <a
              href={opportunity.lastPaymentLinkUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: '#ffffff',
                color: '#0284c7',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.25rem',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={16} /> Launch Payment Link
            </a>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#334155', color: '#ffffff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
