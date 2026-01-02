/**
 * DataTable Component - Enterprise Reusable Table
 * Displays tabular data with loading states and empty states
 * NEVER renders blank - always shows content
 */

import { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  testId?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  isLoading = false,
  emptyTitle = 'No data found',
  emptyDescription = 'There are no records to display.',
  emptyAction,
  emptyIcon,
  keyExtractor,
  onRowClick,
  testId = 'data-table',
}: DataTableProps<T>) {
  // Loading state - ALWAYS visible
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid={`${testId}-loading`}>
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
            <div className="flex gap-4">
              {columns.map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded flex-1"></div>
              ))}
            </div>
          </div>
          {/* Row skeletons */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="px-6 py-4 border-b border-gray-100">
              <div className="flex gap-4">
                {columns.map((_, j) => (
                  <div key={j} className="h-4 bg-gray-100 rounded flex-1"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state - ALWAYS visible when no data
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid={`${testId}-empty`}>
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  // Table with data - ALWAYS visible
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid={testId}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider ${column.className || ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((item, index) => {
              const key = keyExtractor ? keyExtractor(item, index) : String(index);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(item)}
                  className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-6 py-4 whitespace-nowrap text-sm ${column.className || ''}`}
                    >
                      {column.render
                        ? column.render(item, index)
                        : String((item as Record<string, unknown>)[column.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
