/**
 * Support API Hooks
 * React Query hooks for support ticket operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Ticket, 
  TicketWithMessages, 
  CreateTicketRequest, 
  ReplyTicketRequest,
  TicketFilters,
  SLAStatus,
  TicketCategory as TicketCategoryType,
  TicketPriorityOption,
} from '@/types/support';

const API_BASE = '/api/support';

// ============================================
// Ticket List & CRUD
// ============================================

export function useTickets(filters?: TicketFilters) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status?.length) params.set('status', filters.status.join(','));
      if (filters?.priority?.length) params.set('priority', filters.priority.join(','));
      if (filters?.category) params.set('category', filters.category);
      if (filters?.search) params.set('search', filters.search);
      
      const response = await fetch(`${API_BASE}/tickets?${params}`);
      if (!response.ok) throw new Error('Failed to fetch tickets');
      return response.json();
    },
  });
}

export function useTicket(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const response = await fetch(`${API_BASE}/tickets/${ticketId}`);
      if (!response.ok) throw new Error('Failed to fetch ticket');
      return response.json() as Promise<TicketWithMessages>;
    },
    enabled: !!ticketId,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateTicketRequest) => {
      const response = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create ticket');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useReplyToTicket(ticketId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ReplyTicketRequest) => {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send reply');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useResolveTicket(ticketId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (resolution: string) => {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resolve ticket');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useCloseTicket(ticketId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (reason?: string) => {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to close ticket');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

// ============================================
// SLA & Assignment
// ============================================

export function useTicketSLA(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-sla', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      const response = await fetch(`${API_BASE}/tickets/${ticketId}/sla`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.data as SLAStatus;
    },
    enabled: !!ticketId,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useSLAMetrics(startDate?: Date, endDate?: Date) {
  return useQuery({
    queryKey: ['sla-metrics', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate.toISOString());
      if (endDate) params.set('endDate', endDate.toISOString());
      
      const response = await fetch(`${API_BASE}/sla/metrics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch SLA metrics');
      const data = await response.json();
      return data.data;
    },
  });
}

export function useAgentWorkload() {
  return useQuery({
    queryKey: ['agent-workload'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/agents/workload`);
      if (!response.ok) throw new Error('Failed to fetch workload');
      const data = await response.json();
      return data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useAssignmentRecommendations(ticketId: string | null) {
  return useQuery({
    queryKey: ['assignment-recommendations', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const response = await fetch(`${API_BASE}/tickets/${ticketId}/assignment-recommendations`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.data;
    },
    enabled: !!ticketId,
  });
}

export function useAutoAssign(ticketId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (strategy?: string) => {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}/auto-assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to auto-assign');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

// ============================================
// AI Draft
// ============================================

export function useAIDraft(ticketId: string) {
  return useMutation({
    mutationFn: async (context?: { recentMessages?: any[]; userContext?: any }) => {
      const response = await fetch(`${API_BASE}/tickets/${ticketId}/ai-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context || {}),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate AI draft');
      }
      return response.json();
    },
  });
}

// ============================================
// Categories & Priorities
// ============================================

export function useTicketCategories() {
  return useQuery({
    queryKey: ['ticket-categories'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      return data.data as TicketCategoryType[];
    },
    staleTime: Infinity, // Categories don't change often
  });
}

export function useTicketPriorities() {
  return useQuery({
    queryKey: ['ticket-priorities'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/priorities`);
      if (!response.ok) throw new Error('Failed to fetch priorities');
      const data = await response.json();
      return data.data as TicketPriorityOption[];
    },
    staleTime: Infinity,
  });
}

// ============================================
// Ticket Stats
// ============================================

export function useTicketStats() {
  return useQuery({
    queryKey: ['ticket-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/tickets/stats/summary`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}
