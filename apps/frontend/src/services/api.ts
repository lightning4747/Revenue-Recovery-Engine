import axios from 'axios';
import { AuditTrailItem, DashboardSummary, MerchantPolicy, Opportunity } from '../types';

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

export const registerMerchant = async (
  email: string,
  password: string,
  businessName: string,
): Promise<string> => {
  const res = await api.post('/auth/register', { email, password, businessName });
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
  if (status && status !== 'ALL') params.status = status;
  const res = await api.get('/dashboard/opportunities', { params });
  return res.data?.data || res.data;
};

export const fetchAuditTrail = async (opportunityId: string): Promise<AuditTrailItem[]> => {
  const res = await api.get(`/dashboard/audit-trail/${opportunityId}`);
  return res.data?.data || res.data;
};

export const approveOpportunity = async (opportunityId: string): Promise<Opportunity> => {
  const res = await api.post(`/dashboard/opportunities/${opportunityId}/approve`);
  return res.data?.data || res.data;
};

export const triggerRecovery = async (opportunityId: string): Promise<Opportunity> => {
  const res = await api.post(`/dashboard/opportunities/${opportunityId}/recover`);
  return res.data?.data || res.data;
};

export const fetchPolicy = async (): Promise<MerchantPolicy> => {
  const res = await api.get('/merchant/policy');
  return res.data?.data || res.data;
};

export const updatePolicy = async (policy: Partial<MerchantPolicy>): Promise<MerchantPolicy> => {
  const res = await api.patch('/merchant/policy', policy);
  return res.data?.data || res.data;
};
