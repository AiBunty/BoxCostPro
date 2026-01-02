import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { describe, it, beforeEach, vi } from 'vitest';
import App from '@/App';
import { queryClient } from '@/lib/queryClient';

// Integration-style test that simulates the onboarding redirect sequence by
// mocking fetch responses for the relevant API endpoints.

describe('Onboarding redirect sequence', () => {
  let phase = 0;

  beforeEach(() => {
    phase = 0;
    // Simple fetch mock that returns different payloads based on URL and phase
    global.fetch = vi.fn(async (...args: any[]) => {
      const input = args[0];
      const init = args[1] || {};
      const url = typeof input === 'string' ? input : (input as Request).url;
      const method = (init && init.method) || (typeof input !== 'string' && (input as Request).method) || 'GET';
      const body = init && init.body;

      // Auth user
      if (url.endsWith('/api/auth/user')) {
        if (phase === 0) {
          return new Response(JSON.stringify({ id: 'u1', email: 'a@b.com', firstName: null }), { status: 200 });
        }
        // after complete profile
        if (phase >= 1) {
          return new Response(JSON.stringify({ id: 'u1', email: 'a@b.com', firstName: 'John', mobileNo: '9999999999' }), { status: 200 });
        }
      }

      // Default company profile
      if (url.endsWith('/api/company-profiles/default')) {
        if (phase === 1) {
          return new Response('', { status: 404, statusText: 'Not Found' });
        }
        if (phase >= 2) {
          return new Response(JSON.stringify({ id: 'cp1', companyName: 'Acme', phone: '9999999999' }), { status: 200 });
        }
      }

      // Flute settings status
      if (url.endsWith('/api/flute-settings/status')) {
        if (phase <= 2) {
          return new Response(JSON.stringify({ configured: false }), { status: 200 });
        }
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }

      // Paper setup status
      if (url.endsWith('/api/paper-setup-status')) {
        if (phase < 3) {
          return new Response(JSON.stringify({ completed: false }), { status: 200 });
        }
        return new Response(JSON.stringify({ completed: true }), { status: 200 });
      }

      // Handle POSTs for form submissions to advance phase and capture payloads
      if (url.endsWith('/api/user/complete-profile') && method === 'POST') {
        phase = 1;
        (global.fetch as any).lastUserCompleteProfile = body;
        return new Response('{}', { status: 200 });
      }

      if (url.endsWith('/api/company-profiles') && method === 'POST') {
        phase = 2;
        (global.fetch as any).lastCompanyProfile = body;
        return new Response(JSON.stringify({ id: 'cp1', companyName: 'Acme', phone: '999' }), { status: 201 });
      }

      if (url.endsWith('/api/flute-settings') && method === 'POST') {
        phase = 3;
        (global.fetch as any).lastFluteSettings = body;
        return new Response('{}', { status: 200 });
      }

      if (url.endsWith('/api/business-defaults') && method === 'POST') {
        phase = 4;
        (global.fetch as any).lastBusinessDefaults = body;
        return new Response('{}', { status: 200 });
      }

      // Fallback
      return new Response('{}', { status: 200 });
    }) as any;
  });

  it('walks through complete-profile -> settings -> masters -> app', async () => {
    render(<App />);

    // Phase 0: user missing firstName -> should show Complete Profile
    await waitFor(() => expect(screen.getByText(/Complete Your Profile/i)).toBeTruthy());

    // Fill and submit Complete Profile form
    const firstInput = screen.getByTestId('input-firstname');
    const lastInput = screen.getByTestId('input-lastname');
    const mobileInput = screen.getByTestId('input-mobile');
    const submitBtn = screen.getByTestId('button-complete-profile');

    await act(async () => {
      fireEvent.change(firstInput, { target: { value: 'John' } });
      fireEvent.change(lastInput, { target: { value: 'Doe' } });
      fireEvent.change(mobileInput, { target: { value: '9999999999' } });
      submitBtn.click();
    });

    // Wait for app to react to profile completion
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    });

    // Advance to phase 1: user completed profile but no company profile
    phase = 1;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/company-profiles/default'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/flute-settings/status'] });
    });

    // Should redirect to Master Settings (under Masters)
    await waitFor(() => expect(screen.getByText(/^Master Settings$/i)).toBeTruthy());

    // Fill and save Business Profile on Settings
    const companyInput = screen.getByTestId('input-company') as HTMLInputElement;
    const saveBusinessBtn = screen.getByTestId('button-save-business');

    await act(async () => {
      fireEvent.change(companyInput, { target: { value: 'Acme Corp' } });
      saveBusinessBtn.click();
    });

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/company-profiles/default'] });
    });

    // Assert POST payload for complete-profile
    await waitFor(() => {
      const last = (global.fetch as any).lastUserCompleteProfile;
      expect(last).toBeTruthy();
      const parsed = JSON.parse(last);
      expect(parsed.firstName).toBe('John');
      expect(parsed.lastName).toBe('Doe');
      expect(parsed.mobileNumber).toBe('9999999999');
    });

    // Assert POST payload for company profile
    await waitFor(() => {
      const last = (global.fetch as any).lastCompanyProfile;
      expect(last).toBeTruthy();
      const parsed = JSON.parse(last);
      expect(parsed.companyName).toBe('Acme Corp');
    });

    // Advance to phase 2: company exists but machine not configured -> should go to Masters (flute)
    phase = 2;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/company-profiles/default'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/flute-settings/status'] });
    });

    await waitFor(() => expect(screen.getByText(/^Masters$/i)).toBeTruthy());

    // Advance to phase 3: flute configured false -> after saving settings (simulate configured true)
    phase = 3;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/flute-settings/status'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/paper-setup-status'] });
    });

    // Now paper setup incomplete, should still be on Masters (paper tab)
    await waitFor(() => expect(screen.getByText(/^Masters$/i)).toBeTruthy());

    // Advance to final phase: paper setup complete
    phase = 4;
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/paper-setup-status'] });
    });

    // Final: app should allow access to dashboard (render Dashboard content)
    await waitFor(() => expect(screen.getByText(/Dashboard/i)).toBeTruthy());
  });
});
