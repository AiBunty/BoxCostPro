/**
 * Support Page - Ticket-Based Customer Support
 * Manage support tickets with SLA tracking
 * NEVER renders blank
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Priority badge
function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colors[priority] || colors.medium}`}>
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

// Status badge
function TicketStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-800',
    'in-progress': 'bg-yellow-100 text-yellow-800',
    pending: 'bg-purple-100 text-purple-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };
  const labels: Record<string, string> = {
    open: 'Open',
    'in-progress': 'In Progress',
    pending: 'Pending',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.open}`}>
      {labels[status] || status}
    </span>
  );
}

// SLA Timer
function SLATimer({ deadline, status }: { deadline: string; status: string }) {
  if (status === 'resolved' || status === 'closed') {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const now = new Date();
  const due = new Date(deadline);
  const diff = due.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (diff < 0) {
    return (
      <span className="text-xs font-medium text-red-600">
        Overdue by {Math.abs(hours)}h {Math.abs(minutes)}m
      </span>
    );
  }

  if (hours < 2) {
    return (
      <span className="text-xs font-medium text-orange-600">
        {hours}h {minutes}m left
      </span>
    );
  }

  return (
    <span className="text-xs text-gray-600">
      {hours}h {minutes}m left
    </span>
  );
}

export default function Support() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const pageSize = 10;

  // Fetch tickets
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-tickets', page, statusFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(priorityFilter !== 'all' && { priority: priorityFilter }),
      });
      const res = await fetch(`/api/admin/support/tickets?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.json();
    },
    staleTime: 30000,
  });

  const tickets = data?.tickets || [];
  const totalPages = Math.ceil((data?.total || 0) / pageSize);
  const stats = data?.stats || {};

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Support</h1>
        <p className="text-gray-600 mt-1">
          Manage customer support tickets with SLA tracking and priority management.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Open Tickets</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.open || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">In Progress</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.inProgress || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">SLA Breached</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.breached || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Resolved Today</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.resolvedToday || 0}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading tickets...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">Failed to load tickets</p>
            <p className="text-gray-500 text-sm mt-1">Please try again or check your permissions.</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No support tickets</h3>
            <p className="text-gray-500 text-sm">
              {statusFilter !== 'all' || priorityFilter !== 'all' 
                ? 'No tickets match your filters.' 
                : 'Tickets will appear here when customers submit support requests.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">SLA</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tickets.map((ticket: any) => (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-mono font-medium text-gray-900">#{ticket.ticketId}</p>
                        <p className="text-xs text-gray-500 max-w-xs truncate">{ticket.subject}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">{ticket.userName}</p>
                        <p className="text-xs text-gray-500">{ticket.userEmail}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {ticket.category || 'General'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <SLATimer deadline={ticket.slaDeadline} status={ticket.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <TicketStatusBadge status={ticket.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => setSelectedTicket(ticket)}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing page {page} of {totalPages} ({data?.total || 0} total tickets)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Ticket #{selectedTicket.ticketId}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedTicket.subject}</p>
                </div>
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Status</p>
                  <TicketStatusBadge status={selectedTicket.status} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Priority</p>
                  <PriorityBadge priority={selectedTicket.priority} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">User</p>
                  <p className="text-sm text-gray-900">{selectedTicket.userName}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Created</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedTicket.createdAt)}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Conversation</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-800">{selectedTicket.description || 'No description provided.'}</p>
                    <p className="text-xs text-gray-500 mt-2">— {selectedTicket.userName}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Internal Notes</h3>
                <textarea 
                  placeholder="Add internal note (not visible to customer)..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                ></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                <option>Update Status</option>
                <option value="in-progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <div className="flex-1"></div>
              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                Add Reply
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
