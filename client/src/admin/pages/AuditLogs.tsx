/**
 * Audit Logs Page - Security & Compliance Tracking
 * Immutable audit trail for forensic analysis
 * NEVER renders blank - No delete, No edit, Ever
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

// Action type badge
function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    delete: 'bg-red-100 text-red-800',
    login: 'bg-purple-100 text-purple-800',
    logout: 'bg-gray-100 text-gray-800',
    export: 'bg-orange-100 text-orange-800',
    view: 'bg-slate-100 text-slate-800',
    'role-change': 'bg-yellow-100 text-yellow-800',
    suspend: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[action] || 'bg-gray-100 text-gray-800'}`}>
      {action.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
    </span>
  );
}

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7d');
  const [userFilter, setUserFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const pageSize = 20;

  // Fetch audit logs
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-audit-logs', page, actionFilter, dateRange, userFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        dateRange,
        ...(actionFilter !== 'all' && { action: actionFilter }),
        ...(userFilter && { user: userFilter }),
      });
      const res = await fetch(`/api/admin/audit-logs?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
    staleTime: 30000,
  });

  const logs = data?.logs || [];
  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  // Format timestamp
  const formatTimestamp = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900" data-testid="page-title">Audit Logs</h1>
        <p className="text-gray-600 mt-1">
          Immutable security and compliance tracking. All actions are logged for forensic analysis.
        </p>
      </div>

      {/* Compliance Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-900">Immutable Audit Trail</p>
            <p className="text-sm text-amber-700 mt-0.5">
              These logs cannot be edited or deleted. All actions are permanently recorded for compliance.
            </p>
          </div>
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
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="role-change">Role Change</option>
            <option value="suspend">Suspend</option>
            <option value="export">Export</option>
          </select>

          {/* User Filter */}
          <input
            type="text"
            value={userFilter}
            onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
            placeholder="Filter by user email..."
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <div className="flex-1"></div>

          {/* Export */}
          <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">
            Export Logs
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading audit logs...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">Failed to load audit logs</p>
            <p className="text-gray-500 text-sm mt-1">Please try again or check your permissions.</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No audit logs found</h3>
            <p className="text-gray-500 text-sm">
              {actionFilter !== 'all' || userFilter 
                ? 'No logs match your filters.' 
                : 'Activity logs will appear here as actions occur in the system.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actor</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Resource</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">IP Address</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-mono text-sm">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {formatTimestamp(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-gray-900">{log.actorEmail || log.actor}</p>
                        <p className="text-xs text-gray-500">{log.actorRole}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-gray-900">{log.resourceType}</p>
                        <p className="text-xs text-gray-500">{log.resourceId}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button 
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-sans"
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
                  Showing page {page} of {totalPages} ({data?.total || 0} total logs)
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

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Audit Log Details</h2>
                  <p className="text-sm text-gray-600 mt-1">{formatTimestamp(selectedLog.timestamp)}</p>
                </div>
                <button 
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Actor</p>
                  <p className="text-sm text-gray-900">{selectedLog.actorEmail || selectedLog.actor}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Action</p>
                  <ActionBadge action={selectedLog.action} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Resource</p>
                  <p className="text-sm text-gray-900">{selectedLog.resourceType}: {selectedLog.resourceId}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">IP Address</p>
                  <p className="text-sm font-mono text-gray-900">{selectedLog.ipAddress || '—'}</p>
                </div>
              </div>

              {/* Before/After Snapshot */}
              {(selectedLog.before || selectedLog.after) && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Change Snapshot</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedLog.before && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">Before</p>
                        <pre className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs overflow-x-auto">
                          {JSON.stringify(selectedLog.before, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.after && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase mb-2">After</p>
                        <pre className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs overflow-x-auto">
                          {JSON.stringify(selectedLog.after, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raw Log */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Raw Log Entry</h3>
                <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
