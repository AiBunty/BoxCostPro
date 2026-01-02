/**
 * Login Page
 * Admin authentication using Clerk SignIn
 * Reachable at /admin/login
 * ALWAYS renders visible UI
 */

import { SignIn } from '@clerk/clerk-react';

export function Login() {
  return (
    <div 
      className="min-h-screen bg-gray-50 flex items-center justify-center p-4"
      data-testid="admin-login-page"
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">BoxCostPro Admin</h1>
          <p className="text-gray-600 mt-1">Sign in to access the admin console</p>
        </div>

        {/* Clerk SignIn */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <SignIn
            routing="path"
            path="/admin/login"
            signUpUrl="/admin/login"
            redirectUrl="/admin"
            appearance={{
              elements: {
                rootBox: 'w-full',
                card: 'shadow-none p-0 border-0',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                formButtonPrimary: 'bg-blue-600 hover:bg-blue-700',
              },
            }}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            Protected admin area. Unauthorized access is prohibited.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
