/**
 * TopBar Component - Enterprise Admin Header
 * Fixed top navigation with admin info, role badge, and Sign Out
 * ALWAYS renders - never null
 */

import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Role badge colors
const roleBadgeColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
  admin: 'bg-blue-100 text-blue-800 border-blue-200',
  support: 'bg-green-100 text-green-800 border-green-200',
  default: 'bg-gray-100 text-gray-800 border-gray-200',
};

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  support: 'Support',
  default: 'User',
};

export function TopBar() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Fetch admin profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['/api/admin/auth/profile'],
    queryFn: async () => {
      const res = await fetch('/api/admin/auth/profile', { credentials: 'include' });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const role = profile?.role || 'admin';
  const badgeColor = roleBadgeColors[role] || roleBadgeColors.default;
  const roleLabel = roleLabels[role] || roleLabels.default;

  const handleSignOut = async () => {
    try {
      // Call logout endpoint
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      
      // Clear query cache
      queryClient.clear();
      
      // Redirect to login
      window.location.href = '/admin/login';
    } catch (error) {
      console.error('[TopBar] Sign out failed:', error);
      window.location.href = '/admin/login';
    }
  };

  return (
    <header 
      className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50"
      data-testid="admin-topbar"
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">BoxCostPro</h1>
          <p className="text-xs text-gray-500 -mt-0.5">Admin Panel</p>
        </div>
      </div>

      {/* Right: User Info + Role Badge + Sign Out */}
      <div className="flex items-center gap-4">
        {/* Role Badge */}
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${badgeColor}`}>
          {roleLabel}
        </span>

        {/* User info */}
        <div className="text-right hidden sm:block">
          {!isLoading && profile ? (
            <>
              <p className="text-sm font-medium text-gray-900">
                {profile.email || 'Admin'}
              </p>
              <p className="text-xs text-gray-500">{profile.displayName || 'Administrator'}</p>
            </>
          ) : (
            <>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-1"></div>
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse"></div>
            </>
          )}
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
          {profile?.profileImageUrl ? (
            <img src={profile.profileImageUrl} alt="Profile" className="w-9 h-9 object-cover" />
          ) : (
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>

        {/* SIGN OUT BUTTON - MANDATORY */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-700 text-sm font-medium rounded-lg transition-colors"
          data-testid="sign-out-button"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
