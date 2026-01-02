/**
 * Billing Page - Enterprise Subscription & Revenue Management
 * Monitor subscriptions & revenue lifecycle
 * NEVER renders blank
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Payment status badge
function PaymentStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    refunded: 'bg-purple-100 text-purple-800',
    cancelled: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Gateway badge
function GatewayBadge({ gateway }: { gateway: string }) {
  const colors: Record<string, string> = {
    razorpay: 'bg-blue-100 text-blue-800',
    stripe: 'bg-indigo-100 text-indigo-800',
    manual: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[gateway] || colors.manual}`}>
      {gateway.charAt(0).toUpperCase() + gateway.slice(1)}
    </span>
  );
}

export default function Billing() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30d');
  const pageSize = 10;

  // Fetch billing records
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-billing', page, statusFilter, gatewayFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(gatewayFilter !== 'all' && { gateway: gatewayFilter }),
        dateRange,
      });
      const res = await fetch(`/api/admin/billing?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch billing data');
      return res.json();
    },
    staleTime: 30000,
  });

  const payments = data?.payments || [];
  const totalPages = Math.ceil((data?.total || 0) / pageSize);
  const stats = data?.stats || {};

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Billing</h1>
        <p className="text-gray-600 mt-1">
          Monitor subscriptions, track payments, and manage revenue lifecycle.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {isLoading ? '...' : formatCurrency(stats.totalRevenue || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Successful Payments</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {isLoading ? '...' : stats.successfulPayments || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Pending Payments</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {isLoading ? '...' : stats.pendingPayments || 0}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Failed Payments</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {isLoading ? '...' : stats.failedPayments || 0}
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
            <option value="all">All time</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>

          {/* Gateway Filter */}
          <select
            value={gatewayFilter}
            onChange={(e) => { setGatewayFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Gateways</option>
            <option value="razorpay">Razorpay</option>
            <option value="stripe">Stripe</option>
            <option value="manual">Manual</option>
          </select>

          <div className="flex-1"></div>

          {/* Manual Reconciliation */}
          <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
            Manual Reconciliation
          </button>
        </div>
      </div>

      {/* Billing Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading billing records...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">Failed to load billing data</p>
            <p className="text-gray-500 text-sm mt-1">Please try again or check your permissions.</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No billing records yet</h3>
            <p className="text-gray-500 text-sm">
              Payment records will appear here as subscriptions are activated.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Gateway</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Renewal</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment: any) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{payment.customerName || 'Unknown'}</p>
                          <p className="text-sm text-gray-500">{payment.customerEmail}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">{payment.planName || 'Standard'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900">{formatCurrency(payment.amount)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PaymentStatusBadge status={payment.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <GatewayBadge gateway={payment.gateway || 'razorpay'} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.renewalDate ? formatDate(payment.renewalDate) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          View Details
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
                  Showing page {page} of {totalPages} ({data?.total || 0} total records)
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
    </div>
  );
}
