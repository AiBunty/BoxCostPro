/**
 * StatusBadge Component - Enterprise Status Indicator
 * Displays status with color-coded badges
 * NEVER renders blank - always shows a badge
 */

type BadgeVariant = 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'neutral' 
  | 'pending' 
  | 'active' 
  | 'inactive'
  | 'approved'
  | 'rejected';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  testId?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200',
  pending: 'bg-orange-100 text-orange-800 border-orange-200',
  active: 'bg-green-100 text-green-800 border-green-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  approved: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

const dotStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-500',
  pending: 'bg-orange-500',
  active: 'bg-green-500',
  inactive: 'bg-gray-400',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
};

const sizeStyles: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

/**
 * Auto-detect variant from status string
 */
function autoDetectVariant(status: string): BadgeVariant {
  const lowerStatus = status.toLowerCase();
  
  // Success states
  if (['active', 'completed', 'success', 'paid', 'approved', 'verified', 'online', 'healthy'].some(s => lowerStatus.includes(s))) {
    return 'success';
  }
  
  // Warning states
  if (['pending', 'waiting', 'processing', 'in progress', 'review'].some(s => lowerStatus.includes(s))) {
    return 'warning';
  }
  
  // Error states
  if (['error', 'failed', 'rejected', 'suspended', 'blocked', 'offline', 'unhealthy', 'overdue'].some(s => lowerStatus.includes(s))) {
    return 'error';
  }
  
  // Info states
  if (['info', 'new', 'draft', 'created'].some(s => lowerStatus.includes(s))) {
    return 'info';
  }
  
  // Inactive states
  if (['inactive', 'disabled', 'archived', 'expired'].some(s => lowerStatus.includes(s))) {
    return 'inactive';
  }
  
  return 'neutral';
}

export function StatusBadge({ 
  status, 
  variant, 
  size = 'md', 
  dot = true,
  testId = 'status-badge'
}: StatusBadgeProps) {
  const resolvedVariant = variant || autoDetectVariant(status);
  
  return (
    <span 
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variantStyles[resolvedVariant]} ${sizeStyles[size]}`}
      data-testid={testId}
      data-status={status}
      data-variant={resolvedVariant}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[resolvedVariant]}`} />
      )}
      {status}
    </span>
  );
}

export default StatusBadge;
