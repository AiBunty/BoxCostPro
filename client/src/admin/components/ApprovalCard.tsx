/**
 * ApprovalCard Component - User Approval Review Card
 * Displays user information for admin approval/rejection
 * NEVER renders blank - always shows complete card
 */

import { StatusBadge } from './StatusBadge';

interface ApprovalUser {
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
  submittedAt?: string;
  businessComplete?: boolean;
}

interface ApprovalCardProps {
  user: ApprovalUser;
  onApprove: (userId: string) => void;
  onReject: (userId: string) => void;
  onViewDetails: (userId: string) => void;
  isProcessing?: boolean;
  testId?: string;
}

export function ApprovalCard({
  user,
  onApprove,
  onReject,
  onViewDetails,
  isProcessing = false,
  testId = 'approval-card',
}: ApprovalCardProps) {
  const progressColor = 
    user.onboardingProgress >= 100 ? 'bg-green-500' :
    user.onboardingProgress >= 75 ? 'bg-blue-500' :
    user.onboardingProgress >= 50 ? 'bg-yellow-500' :
    'bg-red-500';

  return (
    <div 
      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
      data-testid={testId}
      data-user-id={user.id}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {user.businessName || 'Business Name Not Provided'}
          </h3>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>
        <StatusBadge 
          status={user.status.charAt(0).toUpperCase() + user.status.slice(1)} 
          variant={user.status}
        />
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">GSTIN</p>
          <p className="text-sm font-medium text-gray-900">{user.gstin || 'Not Provided'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Phone</p>
          <p className="text-sm font-medium text-gray-900">{user.phone || 'Not Provided'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Signup Date</p>
          <p className="text-sm font-medium text-gray-900">
            {new Date(user.signupDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Subscription</p>
          <p className="text-sm font-medium text-gray-900">{user.subscriptionPlan || 'None'}</p>
        </div>
      </div>

      {/* Onboarding Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Onboarding Progress</p>
          <span className="text-sm font-semibold text-gray-900">{user.onboardingProgress}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full ${progressColor} transition-all duration-300`}
            style={{ width: `${user.onboardingProgress}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
          user.businessComplete ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {user.businessComplete ? '✓' : '○'} Business Profile (required)
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
          user.submittedAt ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {user.submittedAt ? '✓ Submitted' : '○ Not Submitted'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={() => onViewDetails(user.id)}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={isProcessing}
          data-testid={`${testId}-view-details`}
        >
          View Details
        </button>
        {user.status === 'pending' && (
          <>
            <button
              onClick={() => onReject(user.id)}
              className="flex-1 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
              disabled={isProcessing}
              data-testid={`${testId}-reject`}
            >
              {isProcessing ? 'Processing...' : 'Reject'}
            </button>
            <button
              onClick={() => onApprove(user.id)}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              disabled={isProcessing}
              data-testid={`${testId}-approve`}
            >
              {isProcessing ? 'Processing...' : 'Approve'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ApprovalCard;
