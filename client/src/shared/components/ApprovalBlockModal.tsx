/**
 * NON-DISMISSIBLE APPROVAL BLOCK MODAL
 * 
 * CRITICAL SECURITY: This modal CANNOT be dismissed by user interaction.
 * It blocks ALL access to the application until admin approval.
 * 
 * Shown when:
 * - onboarding_status === 'pending' (submitted, awaiting approval)
 * - onboarding_status === 'rejected' (requires updates)
 * 
 * Features:
 * - No close button
 * - No backdrop click to close
 * - No escape key to close
 * - Covers entire screen with z-[9999]
 * - Only dismissible when verificationStatus === 'approved'
 */

import { Mail, Phone, Clock, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

interface ApprovalBlockModalProps {
  status: 'pending' | 'rejected' | 'submitted' | 'in_progress';
  rejectionReason?: string | null;
  submittedAt?: string | null;
  allStepsComplete?: boolean;
}

export function ApprovalBlockModal({ 
  status, 
  rejectionReason, 
  submittedAt,
  allStepsComplete = false
}: ApprovalBlockModalProps) {
  const [, navigate] = useLocation();
  
  const isPending = status === 'pending' || status === 'submitted';
  const isRejected = status === 'rejected';
  const isInProgress = status === 'in_progress';

  // Block escape key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-md"
      data-testid="approval-block-modal"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="approval-modal-title"
      aria-describedby="approval-modal-description"
      onKeyDown={handleKeyDown}
    >
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className={`p-6 ${
            isPending ? 'bg-amber-50 dark:bg-amber-950/30' : 
            isRejected ? 'bg-red-50 dark:bg-red-950/30' :
            'bg-blue-50 dark:bg-blue-950/30'
          }`}>
            <div className="flex items-center justify-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isPending 
                  ? 'bg-amber-100 dark:bg-amber-900/50' 
                  : isRejected 
                  ? 'bg-red-100 dark:bg-red-900/50'
                  : 'bg-blue-100 dark:bg-blue-900/50'
              }`}>
                {isPending ? (
                  <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                ) : isRejected ? (
                  <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                ) : (
                  <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            <div className="text-center space-y-3">
              <h1 
                id="approval-modal-title"
                className="text-2xl font-bold text-slate-900 dark:text-white"
              >
                {isPending ? 'Account Under Review' : 
                 isRejected ? 'Verification Required' :
                 'Complete Setup Required'}
              </h1>
              
              <p 
                id="approval-modal-description"
                className="text-slate-600 dark:text-slate-300 leading-relaxed"
              >
                {isPending ? (
                  <>
                    Your account setup is complete and is currently under approval.
                    <br />
                    You will be notified as soon as verification is complete.
                  </>
                ) : isRejected ? (
                  <>
                    Your account verification was not approved.
                    <br />
                    Please review the feedback and resubmit.
                  </>
                ) : (
                  <>
                    Please complete all onboarding steps and submit for verification
                    <br />
                    to access the dashboard.
                  </>
                )}
              </p>

              {/* Rejection Reason */}
              {isRejected && rejectionReason && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-left">
                      <p className="font-medium text-red-800 dark:text-red-300 text-sm">
                        Reason for rejection:
                      </p>
                      <p className="text-red-700 dark:text-red-400 text-sm mt-1">
                        {rejectionReason}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Submission timestamp */}
              {isPending && submittedAt && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Submitted on {new Date(submittedAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-200 dark:border-slate-700" />

            {/* Support Info */}
            <div className="text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                For more details, contact us:
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="mailto:saas@aibunty.com"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  saas@aibunty.com
                </a>
                
                <a
                  href="tel:+917003210880"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  +91 70032 10880
                </a>
              </div>
            </div>

            {/* Action Button (for rejected or in-progress) */}
            {(isRejected || isInProgress) && (
              <>
                <div className="border-t border-slate-200 dark:border-slate-700" />
                <div className="text-center">
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    {isRejected ? 'Update Profile & Resubmit' : 'Complete Setup'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isPending 
                ? 'Typical review time: 24-48 hours' 
                : isRejected 
                ? 'Update your information and resubmit for review'
                : 'Complete all 5 steps to submit for verification'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
