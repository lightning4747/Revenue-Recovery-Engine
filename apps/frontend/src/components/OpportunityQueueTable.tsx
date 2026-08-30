import React from 'react';
import { Opportunity } from '../types';
import { ExternalLink, History, Eye, CheckCircle2, Clock, AlertTriangle, Send, TrendingUp, Cpu } from 'lucide-react';

interface Props {
  opportunities: Opportunity[];
  total: number;
  page: number;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  onPageChange: (newPage: number) => void;
  onSelectOpportunity: (opp: Opportunity) => void;
  onOpenAuditModal: (oppId: string) => void;
}

const statusBadgeConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  RECOVERED: { label: 'Captured', color: 'var(--rzp-green)', bg: 'var(--rzp-green-bg)', border: 'var(--rzp-green-border)', icon: CheckCircle2 },
  PARTIALLY_RECOVERED: { label: 'Partially Paid', color: 'var(--rzp-orange)', bg: 'var(--rzp-orange-bg)', border: 'var(--rzp-orange-border)', icon: Clock },
  ACTION_DISPATCHED: { label: 'Dispatched', color: 'var(--rzp-blue-status)', bg: 'var(--rzp-blue-status-bg)', border: 'var(--rzp-blue-status-border)', icon: Send },
  PRIORITIZED: { label: 'Prioritized', color: 'var(--rzp-purple)', bg: 'var(--rzp-purple-bg)', border: 'var(--rzp-purple-border)', icon: TrendingUp },
  VALUED: { label: 'Valued', color: 'var(--rzp-purple)', bg: 'var(--rzp-purple-bg)', border: 'var(--rzp-purple-border)', icon: TrendingUp },
  POLICY_BLOCKED: { label: 'Blocked', color: 'var(--rzp-red)', bg: 'var(--rzp-red-bg)', border: 'var(--rzp-red-border)', icon: AlertTriangle },
  FAILED: { label: 'Failed', color: 'var(--rzp-red)', bg: 'var(--rzp-red-bg)', border: 'var(--rzp-red-border)', icon: AlertTriangle },
  OBSERVED: { label: 'Observed', color: 'var(--rzp-text-secondary)', bg: '#f3f4f6', border: '#e5e7eb', icon: Eye },
  DIAGNOSED: { label: 'Diagnosed', color: 'var(--rzp-text-secondary)', bg: '#f3f4f6', border: '#e5e7eb', icon: Eye },
  EXPIRED: { label: 'Expired', color: 'var(--rzp-text-secondary)', bg: '#f3f4f6', border: '#e5e7eb', icon: Clock },
  UNRECOVERABLE: { label: 'Unrecoverable', color: 'var(--rzp-red)', bg: 'var(--rzp-red-bg)', border: 'var(--rzp-red-border)', icon: AlertTriangle },
};

const formatINR = (paise: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(paise / 100);
};

const formatCauseLabel = (cause?: string) => {
  if (!cause) return 'PENDING_DIAGNOSIS';
  switch (cause) {
    case 'CUSTOMER_AUTH_TIMEOUT':
      return 'Auth Timeout (3DS OTP)';
    case 'INSUFFICIENT_FUNDS':
      return 'Insufficient Balance';
    case 'BANK_TECHNICAL_OUTAGE':
      return 'Bank Outage';
    case 'NETWORK_TIMEOUT':
      return 'Gateway Latency';
    case 'CARD_INVALID':
      return 'Card Invalid / Hard Decline';
    default:
      return cause;
  }
};

export const OpportunityQueueTable: React.FC<Props> = ({
  opportunities,
  total,
  page,
  selectedStatus,
  onStatusChange,
  onPageChange,
  onSelectOpportunity,
  onOpenAuditModal,
}) => {
  const statusTabs = [
    { id: 'ALL', label: 'All Opportunities' },
    { id: 'PRIORITIZED', label: 'Prioritized' },
    { id: 'ACTION_DISPATCHED', label: 'Dispatched' },
    { id: 'PARTIALLY_RECOVERED', label: 'Partially Paid' },
    { id: 'RECOVERED', label: 'Captured' },
    { id: 'POLICY_BLOCKED', label: 'Blocked' },
    { id: 'FAILED', label: 'Failed' },
  ];

  return (
    <div
      style={{
        backgroundColor: 'var(--rzp-card)',
        borderRadius: '0.5rem',
        border: '1px solid var(--rzp-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Table Header & Title Toolbar */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--rzp-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--rzp-text-primary)' }}>
            Recovery Transactions Queue
          </h3>
          <span style={{ fontSize: '0.8125rem', color: 'var(--rzp-text-secondary)' }}>
            Showing {opportunities.length} of {total} total opportunities
          </span>
        </div>
      </div>

      {/* Segmented Filter Control Bar connected directly to Backend Server-side Query */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          padding: '0.625rem 1.5rem',
          borderBottom: '1px solid var(--rzp-border)',
          display: 'flex',
          gap: '0.5rem',
          overflowX: 'auto',
        }}
      >
        {statusTabs.map((tab) => {
          const isActive = selectedStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onStatusChange(tab.id)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: isActive ? 'var(--rzp-blue-light)' : 'transparent',
                color: isActive ? 'var(--rzp-blue)' : 'var(--rzp-text-secondary)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Data Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--rzp-border)', color: 'var(--rzp-text-secondary)' }}>
              <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Opportunity ID
              </th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Diagnosed Cause
              </th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Amount
              </th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Status
              </th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Priority Score
              </th>
              <th style={{ padding: '0.75rem 1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Recovered
              </th>
              <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {opportunities.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--rzp-text-secondary)' }}>
                  No recovery opportunities found matching the selected status filter.
                </td>
              </tr>
            ) : (
              opportunities.map((opp) => {
                const config = statusBadgeConfig[opp.status] || {
                  label: opp.status,
                  color: 'var(--rzp-text-secondary)',
                  bg: '#f3f4f6',
                  border: '#e5e7eb',
                  icon: Eye,
                };
                const StatusIcon = config.icon;

                return (
                  <tr
                    key={opp.id}
                    style={{
                      borderBottom: '1px solid var(--rzp-border)',
                      backgroundColor: '#ffffff',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    {/* ID */}
                    <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--rzp-text-primary)' }} className="font-mono">
                      {opp.id.substring(0, 18)}...
                    </td>

                    {/* Diagnosed Cause */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                        }}
                      >
                        <Cpu size={12} style={{ color: 'var(--rzp-blue)' }} /> {formatCauseLabel(opp.cause)}
                      </span>
                    </td>

                    {/* Amount */}
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--rzp-text-primary)' }} className="font-mono">
                      {formatINR(opp.amount)}
                    </td>

                    {/* Status Pill Badge */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          padding: '0.25rem 0.625rem',
                          borderRadius: '9999px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: config.bg,
                          color: config.color,
                          border: `1px solid ${config.border}`,
                        }}
                      >
                        <StatusIcon size={12} /> {config.label}
                      </span>
                    </td>

                    {/* Priority Score */}
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--rzp-purple)', fontWeight: 700 }} className="font-mono">
                      {opp.priorityScore ? formatINR(opp.priorityScore) : '—'}
                    </td>

                    {/* Recovered Amount */}
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--rzp-green)', fontWeight: 700 }} className="font-mono">
                      {formatINR(opp.recoveredAmount || 0)}
                    </td>

                    {/* Row Actions */}
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                          onClick={() => onSelectOpportunity(opp)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--rzp-blue)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: 0,
                          }}
                        >
                          <Eye size={14} /> Details
                        </button>

                        <button
                          onClick={() => onOpenAuditModal(opp.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--rzp-text-secondary)',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: 0,
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
                              color: 'var(--rzp-green)',
                              fontWeight: 600,
                              textDecoration: 'none',
                              fontSize: '0.8125rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <ExternalLink size={14} /> Launch
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          padding: '0.875rem 1.5rem',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid var(--rzp-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '0.8125rem', color: 'var(--rzp-text-secondary)' }}>
          Page <strong>{page}</strong> ({opportunities.length} items)
        </span>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            style={{
              padding: '0.375rem 0.875rem',
              backgroundColor: '#ffffff',
              color: 'var(--rzp-text-primary)',
              border: '1px solid var(--rzp-border)',
              borderRadius: '0.375rem',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              opacity: page <= 1 ? 0.5 : 1,
              fontWeight: 500,
              fontSize: '0.8125rem',
            }}
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={opportunities.length < 20}
            style={{
              padding: '0.375rem 0.875rem',
              backgroundColor: '#ffffff',
              color: 'var(--rzp-text-primary)',
              border: '1px solid var(--rzp-border)',
              borderRadius: '0.375rem',
              cursor: opportunities.length < 20 ? 'not-allowed' : 'pointer',
              opacity: opportunities.length < 20 ? 0.5 : 1,
              fontWeight: 500,
              fontSize: '0.8125rem',
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
