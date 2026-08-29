import { useEffect, useState, useCallback } from 'react';
import { AuditTrailItem, DashboardSummary, Opportunity } from './types';
import { fetchAuditTrail, fetchOpportunities, fetchSummary } from './services/api';
import { ExecutiveSummaryCards } from './components/ExecutiveSummaryCards';
import { OpportunityQueueTable } from './components/OpportunityQueueTable';
import { OpportunityDetailModal } from './components/OpportunityDetailModal';
import { AuditTimelineModal } from './components/AuditTimelineModal';
import { LoginModal } from './components/LoginModal';
import { ShieldCheck, LogOut } from 'lucide-react';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(localStorage.getItem('rre_token')),
  );
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [auditOppId, setAuditOppId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingSummary(true);
    try {
      const [sumData, oppData] = await Promise.all([
        fetchSummary(),
        fetchOpportunities(page, 20),
      ]);
      setSummary(sumData);
      setOpportunities(oppData.data || []);
      setTotal(oppData.total || 0);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        localStorage.removeItem('rre_token');
        setIsAuthenticated(false);
      }
    } finally {
      setLoadingSummary(false);
    }
  }, [isAuthenticated, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenAuditModal = async (oppId: string) => {
    setAuditOppId(oppId);
    setLoadingAudit(true);
    try {
      const trail = await fetchAuditTrail(oppId);
      setAuditTrail(trail);
    } catch {
      setAuditTrail([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rre_token');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginModal onSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc' }}>
      {/* Header Bar */}
      <header style={{ backgroundColor: '#1e293b', borderBottom: '1px solid #334155', padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldCheck size={28} color="#38bdf8" />
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#38bdf8' }}>Revenue Recovery Engine</h1>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Control Tower & Verification Subsystem</span>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#334155',
            color: '#f8fafc',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem' }}>
        <ExecutiveSummaryCards summary={summary} loading={loadingSummary} onRefresh={loadData} />
        <OpportunityQueueTable
          opportunities={opportunities}
          total={total}
          page={page}
          onPageChange={setPage}
          onSelectOpportunity={setSelectedOpportunity}
          onOpenAuditModal={handleOpenAuditModal}
        />
      </main>

      {/* Modals */}
      <OpportunityDetailModal
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
      />
      <AuditTimelineModal
        opportunityId={auditOppId}
        auditTrail={auditTrail}
        loading={loadingAudit}
        onClose={() => setAuditOppId(null)}
      />
    </div>
  );
}
