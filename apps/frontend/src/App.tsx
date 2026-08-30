import { useEffect, useState, useCallback } from 'react';
import { AuditTrailItem, DashboardSummary, Opportunity } from './types';
import { fetchAuditTrail, fetchOpportunities, fetchSummary } from './services/api';
import { HeaderBanner } from './components/HeaderBanner';
import { ExecutiveSummaryCards } from './components/ExecutiveSummaryCards';
import { OpportunityQueueTable } from './components/OpportunityQueueTable';
import { OpportunityDetailModal } from './components/OpportunityDetailModal';
import { AuditTimelineModal } from './components/AuditTimelineModal';
import { MerchantPolicyModal } from './components/MerchantPolicyModal';
import { LoginModal } from './components/LoginModal';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    Boolean(localStorage.getItem('rre_token')),
  );
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [auditOppId, setAuditOppId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<AuditTrailItem[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingSummary(true);
    try {
      const [sumData, oppData] = await Promise.all([
        fetchSummary(),
        fetchOpportunities(page, 20, selectedStatus),
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
  }, [isAuthenticated, page, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = (newStatus: string) => {
    setSelectedStatus(newStatus);
    setPage(1);
  };

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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--rzp-bg)', color: 'var(--rzp-text-primary)' }}>
      {/* Top Header Banner */}
      <HeaderBanner onLogout={handleLogout} onOpenPolicyModal={() => setIsPolicyModalOpen(true)} />

      {/* Main Centered Container */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <ExecutiveSummaryCards summary={summary} loading={loadingSummary} onRefresh={loadData} />
        <OpportunityQueueTable
          opportunities={opportunities}
          total={total}
          page={page}
          selectedStatus={selectedStatus}
          onStatusChange={handleStatusChange}
          onPageChange={setPage}
          onSelectOpportunity={setSelectedOpportunity}
          onOpenAuditModal={handleOpenAuditModal}
        />
      </main>

      {/* Dialog Modals */}
      <OpportunityDetailModal
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
        onRefresh={loadData}
      />
      <AuditTimelineModal
        opportunityId={auditOppId}
        auditTrail={auditTrail}
        loading={loadingAudit}
        onClose={() => setAuditOppId(null)}
      />
      <MerchantPolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
      />
    </div>
  );
}
