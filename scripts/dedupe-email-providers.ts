/**
 * Deduplicate email providers by fromEmail (case-insensitive)
 * Keeps a single best provider per email and deletes the rest.
 * Criteria (in order):
 *  - isActive true
 *  - lowest priorityOrder
 *  - earliest createdAt
 */

import { storage } from '../server/storage';

function toKey(email?: string): string {
  return (email || '').trim().toLowerCase();
}

function pickBest(providers: any[]): any {
  // Prefer active
  const activeFirst = providers.sort((a, b) => Number(b.isActive) - Number(a.isActive));
  // Then by priorityOrder ascending
  activeFirst.sort((a, b) => {
    const pa = (a.priorityOrder ?? 100);
    const pb = (b.priorityOrder ?? 100);
    return pa - pb;
  });
  // Then by createdAt ascending
  activeFirst.sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });
  return activeFirst[0];
}

async function main() {
  console.log('🧹 Starting email providers dedupe...');
  const providers = await storage.getAllEmailProviders();
  const groups = new Map<string, any[]>();

  for (const p of providers) {
    const key = toKey(p.fromEmail);
    if (!key) continue;
    const arr = groups.get(key) || [];
    arr.push(p);
    groups.set(key, arr);
  }

  let totalDeleted = 0;
  for (const [email, group] of groups.entries()) {
    if (group.length <= 1) continue;
    const keep = pickBest(group);
    const deleteList = group.filter((p) => p.id !== keep.id);

    console.log(`\n📧 ${email} has ${group.length} providers -> keeping ${keep.id}`);
    for (const d of deleteList) {
      const ok = await storage.deleteEmailProvider(d.id);
      if (ok) {
        console.log(`   - Deleted duplicate provider ${d.id}`);
        totalDeleted++;
      } else {
        console.warn(`   - Failed to delete ${d.id}`);
      }
    }

    // Normalize kept provider email to lowercase for future uniqueness
    if (keep.fromEmail !== email) {
      await storage.updateEmailProvider(keep.id, { fromEmail: email });
      console.log(`   - Normalized kept provider ${keep.id} fromEmail -> ${email}`);
    }
  }

  console.log(`\n✅ Dedupe complete. Deleted ${totalDeleted} duplicate provider(s).`);
}

main().catch((err) => {
  console.error('❌ Dedupe failed:', err?.message || err);
  process.exit(1);
});
