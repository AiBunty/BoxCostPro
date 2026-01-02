/**
 * Approvals Page - Admin User Approval Workflow
 * Review and approve/reject new user signups
 * 
 * CRITICAL WORKFLOW:
 * - New users cannot access dashboard until approved
 * - Admin reviews business details, GST, email config
 * - Admin can APPROVE or REJECT with reason
 * 
 * NEVER renders blank - always shows content
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { ApprovalCard } from '../components/ApprovalCard';
import { EmptyState } from '../components/EmptyState';

interface PendingUser {
  id: string;
  email: string;
  businessName: string;
  gstin?: string;
  phone?: string;
  signupDate: string;
  onboardingProgress: number;
  status: 'pending' | 'approved' | 'rejected';
  emailConfigured?: boolean;
  subscriptionPlan?: string;
  rejectionReason?: string;
}

// Mock data for development - will be replaced with API calls
const mockPendingUsers: PendingUser[] = [
  {
    id: '1',
    email: 'manufacturer@example.com',
    businessName: 'ABC Packaging Ltd',
    gstin: '27AABCT1234F1ZH',
    phone: '+91 98765 43210',
    signupDate: '2026-01-01T10:30:00Z',
    onboardingProgress: 100,
    status: 'pending',
    emailConfigured: true,
    subscriptionPlan: 'Professional',
  },
  {
    id: '2',
    email: 'boxmaker@gmail.com',
    businessName: 'XYZ Corrugators',
    gstin: '29AABCT5678G2ZK',
    phone: '+91 87654 32109',
    signupDate: '2026-01-01T14:45:00Z',
    onboardingProgress: 85,
    status: 'pending',
    emailConfigured: false,
    subscriptionPlan: 'Starter',
  },
];

type ViewMode = 'cards' | 'table';
type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function Approvals() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fetch pending approvals
  const { data: pendingUsers = [], isLoading, error } = useQuery({
    queryKey: ['admin', 'approvals', statusFilter],
    queryFn: async () => {
      const response = await fetch(`/api/admin/approvals?status=${statusFilter}`);
      if (!response.ok) {
        // Return mock data for development
        return mockPendingUsers.filter(u => 
          statusFilter === 'all' ? true : u.status === statusFilter
        );
      }
      return response.json();
    },
    staleTime: 30000,
  });

  // Approve user mutation
  const approveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/approvals/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to approve user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] });
      setSelectedUser(null);
    },
  });

  // Reject user mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const response = await fetch(`/api/admin/approvals/${userId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        throw new Error('Failed to reject user');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'approvals'] });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedUser(null);
    },
  });

  const handleApprove = (userId: string) => {
    if (confirm('Are you sure you want to approve this user? They will gain full dashboard access.')) {
      approveMutation.mutate(userId);
    }
  };

  const handleRejectClick = (userId: string) => {
    const user = pendingUsers.find((u: PendingUser) => u.id === userId);
    setSelectedUser(user || null);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = () => {
    if (selectedUser && rejectReason.trim()) {
      rejectMutation.mutate({ userId: selectedUser.id, reason: rejectReason });
    }
  };

  const handleViewDetails = (userId: string) => {
    const user = pendingUsers.find((u: PendingUser) => u.id === userId);
    setSelectedUser(user || null);
    setShowDetailsModal(true);
  };

  // Stats calculation
  const stats = {
    pending: pendingUsers.filter((u: PendingUser) => u.status === 'pending').length,
    approved: pendingUsers.filter((u: PendingUser) => u.status === 'approved').length,
    rejected: pendingUsers.filter((u: PendingUser) => u.status === 'rejected').length,
    total: pendingUsers.length,
  };

  // Table columns for table view
  const columns = [
    {
      key: 'businessName',
      header: 'Business',
      render: (user: PendingUser) => (
        <div>
          <p className="font-medium text-gray-900">{user.businessName || 'Not Provided'}</p>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN',
      render: (user: PendingUser) => (
        <span className="font-mono text-sm text-gray-700">
          {user.gstin || '-'}
        </span>
      ),
    },
    {
      key: 'signupDate',
      header: 'Signup Date',
      render: (user: PendingUser) => (
        <span className="text-sm text-gray-600">
          {new Date(user.signupDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'onboardingProgress',
      header: 'Onboarding',
      render: (user: PendingUser) => (
        <div className="flex items-center gap-2">
          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full ${user.onboardingProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${user.onboardingProgress}%` }}
            />
          </div>
          <span className="text-sm font-medium">{user.onboardingProgress}%</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user: PendingUser) => (
        <StatusBadge 
          status={user.status.charAt(0).toUpperCase() + user.status.slice(1)} 
          variant={user.status as 'pending' | 'approved' | 'rejected'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (user: PendingUser) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewDetails(user.id)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            Details
          </button>
          {user.status === 'pending' && (
            <>
              <button
                onClick={() => handleRejectClick(user.id)}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(user.id)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 transition-colors"
              >
                Approve
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6" data-testid="approvals-page">
      {/* Page Header - ALWAYS visible */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">
          User Approvals
        </h1>
        <p className="text-gray-600 mt-1">
          Review and approve new user signups. Users cannot access the dashboard until approved.
        </p>
      </div>

      {/* Alert Banner - Pending approvals */}
      {stats.pending > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="font-medium text-orange-800">
              {stats.pending} user{stats.pending > 1 ? 's' : ''} awaiting approval
            </p>
            <p className="text-sm text-orange-600">
              These users have completed onboarding and are waiting for admin review.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Pending</p>
          <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Approved</p>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500 mb-1">Total Reviewed</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 text-sm font-medium rounded ${
              viewMode === 'cards' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
            }`}
          >
            Cards
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-sm font-medium rounded ${
              viewMode === 'table' ? 'bg-white shadow text-gray-900' : 'text-gray-600'
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Failed to load approvals</p>
          <p className="text-sm text-red-600">Please try refreshing the page.</p>
        </div>
      )}

      {/* Content - NEVER blank */}
      {viewMode === 'cards' ? (
        // Cards View
        isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-100 rounded w-1/2" />
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-20" />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j}>
                      <div className="h-3 bg-gray-100 rounded w-16 mb-1" />
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </div>
                  ))}
                </div>
                <div className="h-2 bg-gray-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : pendingUsers.length === 0 ? (
          <EmptyState
            title="No users pending approval"
            description={
              statusFilter === 'pending' 
                ? "All caught up! There are no new users waiting for approval."
                : `No ${statusFilter} users found.`
            }
            icon={
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingUsers.map((user: PendingUser) => (
              <ApprovalCard
                key={user.id}
                user={user}
                onApprove={handleApprove}
                onReject={handleRejectClick}
                onViewDetails={handleViewDetails}
                isProcessing={approveMutation.isPending || rejectMutation.isPending}
              />
            ))}
          </div>
        )
      ) : (
        // Table View
        <DataTable
          columns={columns}
          data={pendingUsers}
          isLoading={isLoading}
          emptyTitle="No users pending approval"
          emptyDescription={
            statusFilter === 'pending'
              ? "All caught up! There are no new users waiting for approval."
              : `No ${statusFilter} users found.`
          }
          keyExtractor={(user: PendingUser) => user.id}
          testId="approvals-table"
        />
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Reject User Application
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              You are about to reject the application for <strong>{selectedUser.businessName}</strong>.
              Please provide a reason that will be shown to the user.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedUser(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  User Application Details
                </h2>
                <p className="text-sm text-gray-500">
                  Review complete information before approving or rejecting.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedUser(null);
                }}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Business Information */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Business Information
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Business Name</p>
                    <p className="font-medium text-gray-900">{selectedUser.businessName || 'Not Provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="font-medium text-gray-900">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">GSTIN</p>
                    <p className="font-mono font-medium text-gray-900">{selectedUser.gstin || 'Not Provided'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Phone</p>
                    <p className="font-medium text-gray-900">{selectedUser.phone || 'Not Provided'}</p>
                  </div>
                </div>
              </div>

              {/* Onboarding Status */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Onboarding Status
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Progress</span>
                    <span className="text-sm font-semibold">{selectedUser.onboardingProgress}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
                    <div 
                      className={`h-full ${selectedUser.onboardingProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                      style={{ width: `${selectedUser.onboardingProgress}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-2 rounded text-center text-xs ${
                      selectedUser.businessName ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {selectedUser.businessName ? '✓' : '○'} Profile
                    </div>
                    <div className={`p-2 rounded text-center text-xs ${
                      selectedUser.gstin ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {selectedUser.gstin ? '✓' : '○'} GST
                    </div>
                    <div className={`p-2 rounded text-center text-xs ${
                      selectedUser.emailConfigured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {selectedUser.emailConfigured ? '✓' : '○'} Email
                    </div>
                  </div>
                </div>
              </div>

              {/* Subscription */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                  Subscription
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-900">{selectedUser.subscriptionPlan || 'No subscription'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Signup: {new Date(selectedUser.signupDate).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {selectedUser.status === 'pending' && (
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleRejectClick(selectedUser.id);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleApprove(selectedUser.id);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Approve User
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Approvals;
