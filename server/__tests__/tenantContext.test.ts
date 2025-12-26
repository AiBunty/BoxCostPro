import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock db and storage before importing the module under test
vi.mock('../db', () => ({ db: { execute: vi.fn() } }));
vi.mock('../storage', () => ({ storage: { createCompanyProfile: vi.fn() } }));

import { createTenantForUser } from '../tenantContext';

describe('createTenantForUser', () => {
  beforeEach(() => {
    // reset mocked implementations
    const db = require('../db').db;
    const storage = require('../storage').storage;
    db.execute.mockReset();
    storage.createCompanyProfile.mockReset();
  });

  it('creates tenant and default company profile', async () => {
    const db = require('../db').db;
    const storage = require('../storage').storage;

    db.execute.mockResolvedValue({ rows: [{ id: 'tenant-uuid' }] });
    storage.createCompanyProfile.mockResolvedValue({ id: 'cp-1' });

    const ctx = await createTenantForUser('user-1', 'Acme Corp');

    expect(ctx).toBeTruthy();
    expect(ctx.tenantId).toBe('tenant-uuid');

    expect(storage.createCompanyProfile).toHaveBeenCalled();
    const calledWith = storage.createCompanyProfile.mock.calls[0][0];
    expect(calledWith.tenantId).toBe('tenant-uuid');
    expect(calledWith.userId).toBe('user-1');
    expect(calledWith.companyName).toBe('Acme Corp');
    expect(calledWith.isDefault).toBe(true);
  });
});
