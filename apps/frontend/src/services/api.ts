import axios from 'axios';
import { AuditTrailItem, DashboardSummary, Opportunity } from '../types';

const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rre_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const loginMerchant = async (email: string, password: string): Promise<string> => {
  const res = await api.post('/auth/login', { email, password });
  const token = res.data?.data?.accessToken || res.data?.accessToken;
  if (token) {
    localStorage.setItem('rre_token', token);
  }
  return token;
};

export const fetchSummary = async (): Promise<DashboardSummary> => {
  const res = await api.get('/dashboard/summary');
  return res.data?.data || res.data;
};

export const fetchOpportunities = async (
  page = 1,
  limit = 20,
  status?: string,
): Promise<{ data: Opportunity[]; total: number }> => {
  const params: Record<string, any> = { page, limit };
  if (status) params.status = status;
  const res = await api.get('/dashboard/opportunities', { params });
  return res.data?.data || res.data;
};

export const fetchAuditTrail = async (opportunityId: string): Promise<AuditTrailItem[]> => {
  const res = await api.get(`/dashboard/audit-trail/${opportunityId}`);
  return res.data?.data || res.data;
};
