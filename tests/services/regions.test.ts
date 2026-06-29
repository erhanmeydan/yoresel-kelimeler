import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { listTopRegionsByWeeklyEntries } from '../../src/services/regions.service';

let testEnv: RulesTestEnvironment;

beforeEach(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: `demo-top-regions-${Date.now()}`,
    firestore: { host: '127.0.0.1', port: 8080, rules: '' },
  });
});

describe('listTopRegionsByWeeklyEntries', () => {
  it('returns top N regions sorted by entryCount desc', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore() as unknown as Firestore;

    // Seed 15 region stats
    for (let i = 1; i <= 15; i++) {
      await setDoc(doc(db, 'regionStats', `region-${i}`), {
        regionId: `region-${i}`,
        regionName: `Region ${i}`,
        entryCount: 16 - i,
        sampleEntryId: `entry-${i}`,
        sampleWord: `kelime-${i}`,
        sampleMeaning: `anlam-${i}`,
        updatedAt: { seconds: 0, nanoseconds: 0 },
      });
    }

    const result = await listTopRegionsByWeeklyEntries(db, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(10);
      expect(result.data[0]?.regionId).toBe('region-1');
      expect(result.data[0]?.entryCount).toBe(15);
      expect(result.data[9]?.regionId).toBe('region-10');
      expect(result.data[9]?.entryCount).toBe(6);
    }
  });

  it('returns empty array when no stats exist', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore() as unknown as Firestore;

    const result = await listTopRegionsByWeeklyEntries(db, 10);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('returns error result on Firestore failure', async () => {
    const ctx = testEnv.unauthenticatedContext();
    const db = ctx.firestore() as unknown as Firestore;
    // Trigger failure by closing env
    await testEnv.cleanup();

    const result = await listTopRegionsByWeeklyEntries(db, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toMatch(/^regions\/top-failed/);
    }
  });
});
