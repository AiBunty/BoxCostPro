/**
 * EmptyState Component
 * Displays a friendly message when no data is available
 * PREVENTS blank screens - always shows visible content
 */

import { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div 
      className="flex flex-col items-center justify-center py-16 px-6 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200"
      data-testid="empty-state"
    >
      {/* Icon */}
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        {icon || (
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        )}
      </div>

      {/* Title - ALWAYS visible */}
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        {title}
      </h3>

      {/* Description - ALWAYS visible */}
      <p className="text-sm text-gray-500 max-w-sm mb-6">
        {description}
      </p>

      {/* Optional action */}
      {action && <div>{action}</div>}
    </div>
  );
}

export default EmptyState;
