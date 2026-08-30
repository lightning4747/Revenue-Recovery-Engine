import React from 'react';
import { Opportunity } from '../types';
import { ExternalLink, History, Eye } from 'lucide-react';

interface Props {
  opportunities: Opportunity[];
  total: number;
  page: number;
  onPageChange: (newPage: number) => void;
  onSelectOpportunity: (opp: Opportunity) => void;
  onOpenAuditModal: (oppId: string) => void;
}

const statusColorMap: Record<string, { bg: string; color: string }> = {
  OBSERVED: { bg: '#334155', color: '#94a3b8' },
  DIAGNOSED: { bg: '#1e3a8a', color: '#60a5fa' },
  VALUED: { bg: '#312e81', color: '#818cf8' },
  PRIORITIZED: { bg: '#581c87', color: '#c084fc' },
  ACTION_DISPATCHED: { bg: '#0369a1', color: '#38bdf8' },
  PARTIALLY_RECOVERED: { bg: '#854d0e', color: '#facc15' },
  RECOVERED: { bg: '#065f46', color: '#34d399' },
  POLICY_BLOCKED: { bg: '#9f1239', color: '#fb7185' },
  EXPIRED: { bg: '#475569', color: '#cbd5e1' },
  FAILED: { bg: '#881337', color: '#fda4af' },
};

const formatINR = (paise: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
};

export const OpportunityQueueTable: React.FC<Props> = ({
  opportunities,
  total,
  page,
  onPageChange,
  onSelectOpportunity,
  onOpenAuditModal,
}) => {
  return (
    <div style={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', border: '1px solid #334155', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Recovery Opportunities Queue</h3>
        <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total: {total}</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155', color: '#94a3b8' }}>
              <th style={{ padding: '0.75rem 1rem' }}>Opportunity ID</th>
              <th style={{ padding: '0.75rem 1rem' }}>Type</th>
              <th style={{ padding: '0.75rem 1rem' }}>Amount</th>
              <th style={{ padding: '0.75rem 1rem' }}>Status</th>
              <th style={{ padding: '0.75rem 1rem' }}>Priority Score</th>
              <th style={{ padding: '0.75rem 1rem' }}>Recovered</th>
              <th style={{ padding: '0.75rem 1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  No recovery opportunities found.
                </td>
              </tr>
            ) : (
              opportunities.map((opp) => {
                const style = statusColorMap[opp.status] || { bg: '#334155', color: '#94a3b8' };
                return (
                  <tr key={opp.id} style={{ borderBottom: '1px solid #334155', backgroundColor: '#1e293b' }}>
                    <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 500, color: '#f8fafc' }}>
                      {opp.id.substring(0, 16)}...
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#cbd5e1' }}>{opp.sourceType}</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{formatINR(opp.amount)}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.625rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: style.bg,
                          color: style.color,
                        }}
                      >
                        {opp.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#c084fc', fontWeight: 600 }}>
                      {opp.priorityScore ? formatINR(opp.priorityScore) : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#34d399', fontWeight: 600 }}>
                      {formatINR(opp.recoveredAmount || 0)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => onSelectOpportunity(opp)}
                        style={{
                          padding: '0.375rem 0.625rem',
                          backgroundColor: '#334155',
                          color: '#f8fafc',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        <Eye size={14} /> View
                      </button>
                      <button
                        onClick={() => onOpenAuditModal(opp.id)}
                        style={{
                          padding: '0.375rem 0.625rem',
                          backgroundColor: '#312e81',
                          color: '#a5b4fc',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          fontSize: '0.75rem',
                        }}
                      >
                        <History size={14} /> Audit
                      </button>
                      {opp.lastPaymentLinkUrl && (
                        <a
                          href={opp.lastPaymentLinkUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '0.375rem 0.625rem',
                            backgroundColor: '#0284c7',
                            color: '#ffffff',
                            borderRadius: '0.25rem',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          <ExternalLink size={14} /> Launch
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#0f172a', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          style={{ padding: '0.375rem 0.75rem', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '0.25rem', cursor: 'pointer' }}
        >
          Previous
        </button>
        <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Page {page}</span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={opportunities.length < 20}
          style={{ padding: '0.375rem 0.75rem', backgroundColor: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: '0.25rem', cursor: 'pointer' }}
        >
          Next
        </button>
      </div>
    </div>
  );
};
