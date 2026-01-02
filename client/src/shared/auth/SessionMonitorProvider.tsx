import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useLocation } from 'wouter';

interface SessionMonitorContextType {
  lastActivity: number;
  showWarning: boolean;
  timeUntilTimeout: number;
  resetActivity: () => void;
}

const SessionMonitorContext = createContext<SessionMonitorContextType | undefined>(undefined);

export function useSessionMonitor() {
  const context = useContext(SessionMonitorContext);
  if (!context) {
    throw new Error('useSessionMonitor must be used within SessionMonitorProvider');
  }
  return context;
}

interface SessionMonitorProviderProps {
  children: ReactNode;
  idleTimeoutMinutes?: number;
  warningMinutes?: number;
  enabled?: boolean;
}

/**
 * SessionMonitorProvider - Tracks user activity and enforces session timeout
 * 
 * Features:
 * - Idle timeout detection
 * - Warning modal before timeout
 * - Automatic logout on timeout
 * - Activity tracking across the app
 * 
 * Default timeouts:
 * - Admin panel: 15 minutes idle, 2 minute warning
 * - Regular users: 30 minutes idle, 3 minute warning
 */
export function SessionMonitorProvider({
  children,
  idleTimeoutMinutes = 15,
  warningMinutes = 2,
  enabled = true,
}: SessionMonitorProviderProps) {
  const { signOut } = useAuth();
  const [, setLocation] = useLocation();
  
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [timeUntilTimeout, setTimeUntilTimeout] = useState(0);

  const IDLE_TIMEOUT = idleTimeoutMinutes * 60 * 1000; // Convert to milliseconds
  const WARNING_TIME = warningMinutes * 60 * 1000;

  // Reset activity timer
  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
  }, []);

  // Track user activity events
  useEffect(() => {
    if (!enabled) return;

    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Debounced activity reset (max once per second)
    let activityTimeout: NodeJS.Timeout;
    const debouncedReset = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(resetActivity, 1000);
    };

    events.forEach(event => {
      window.addEventListener(event, debouncedReset, { passive: true });
    });

    return () => {
      clearTimeout(activityTimeout);
      events.forEach(event => {
        window.removeEventListener(event, debouncedReset);
      });
    };
  }, [enabled, resetActivity]);

  // Check idle status periodically
  useEffect(() => {
    if (!enabled) return;

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivity;
      const timeLeft = IDLE_TIMEOUT - idleTime;

      setTimeUntilTimeout(Math.max(0, Math.floor(timeLeft / 1000)));

      // Trigger logout on timeout
      if (idleTime >= IDLE_TIMEOUT) {
        console.warn('[Session Monitor] Idle timeout reached, logging out...');
        clearInterval(checkInterval);
        
        // Sign out and redirect
        signOut().then(() => {
          setLocation('/auth?reason=session_timeout&next=' + encodeURIComponent(window.location.pathname));
        }).catch((error) => {
          console.error('[Session Monitor] Logout error:', error);
          // Force redirect even if logout fails
          setLocation('/auth?reason=session_timeout');
        });
      }
      // Show warning before timeout
      else if (idleTime >= IDLE_TIMEOUT - WARNING_TIME && !showWarning) {
        console.warn('[Session Monitor] Session expiring soon, showing warning');
        setShowWarning(true);
      }
      // Hide warning if user becomes active again
      else if (idleTime < IDLE_TIMEOUT - WARNING_TIME && showWarning) {
        setShowWarning(false);
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkInterval);
  }, [enabled, lastActivity, showWarning, IDLE_TIMEOUT, WARNING_TIME, signOut, setLocation]);

  // Log session monitoring status
  useEffect(() => {
    if (enabled) {
      console.log('[Session Monitor] Initialized', {
        idleTimeoutMinutes,
        warningMinutes,
        idleTimeoutMs: IDLE_TIMEOUT,
      });
    }
  }, [enabled, idleTimeoutMinutes, warningMinutes, IDLE_TIMEOUT]);

  const value: SessionMonitorContextType = {
    lastActivity,
    showWarning,
    timeUntilTimeout,
    resetActivity,
  };

  return (
    <SessionMonitorContext.Provider value={value}>
      {children}
      {showWarning && <SessionWarningModal />}
    </SessionMonitorContext.Provider>
  );
}

/**
 * SessionWarningModal - Warns user about impending session timeout
 */
function SessionWarningModal() {
  const { timeUntilTimeout, resetActivity } = useSessionMonitor();
  const minutes = Math.floor(timeUntilTimeout / 60);
  const seconds = timeUntilTimeout % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 max-w-md w-full mx-4 border-2 border-red-500">
        <div className="flex items-center mb-4">
          <div className="flex-shrink-0 bg-red-100 dark:bg-red-900/30 rounded-full p-3 mr-4">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Session Expiring Soon
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your session will expire due to inactivity
            </p>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
          <p className="text-center text-3xl font-mono font-bold text-red-600 dark:text-red-400">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </p>
          <p className="text-center text-sm text-gray-600 dark:text-gray-400 mt-1">
            Time remaining
          </p>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
          Click "Stay Logged In" to continue your session, or you will be automatically logged out.
        </p>

        <div className="flex gap-3">
          <button
            onClick={resetActivity}
            className="flex-1 bg-primary hover:bg-primary/90 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Stay Logged In
          </button>
          <button
            onClick={() => {
              window.location.href = '/auth?reason=manual_logout';
            }}
            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
}
