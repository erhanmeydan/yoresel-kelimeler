import {
  collection, getDocs, query, orderBy, limit, type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Region, RegionWeeklyStat, ServiceResult } from '../types/models';

export async function listRegions(db: Firestore): Promise<ServiceResult<Region[]>> {
  try {
    const snap = await getDocs(query(collection(db, COLLECTIONS.REGIONS), orderBy('plateCode')));
    const regions = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Region);
    return { ok: true, data: regions };
  } catch (err) {
    return { ok: false, error: { code: 'regions/list-failed', message: 'Bölgeler yüklenemedi.' } };
  }
}

export async function getRegion(db: Firestore, id: string): Promise<ServiceResult<Region | null>> {
  try {
    const snap = await import('firebase/firestore').then((m) => m.getDoc(m.doc(db, COLLECTIONS.REGIONS, id)));
    return { ok: true, data: snap.exists() ? ({ id: snap.id, ...snap.data() } as Region) : null };
  } catch {
    return { ok: false, error: { code: 'regions/get-failed', message: 'Bölge yüklenemedi.' } };
  }
}

export async function listTopRegionsByWeeklyEntries(
  db: Firestore,
  max = 10,
): Promise<ServiceResult<RegionWeeklyStat[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.REGION_STATS),
      orderBy('entryCount', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    const stats = snap.docs.map((d) => ({ ...(d.data() as RegionWeeklyStat) }));

    // Defensive: ensure sampleWord/sampleMeaning are non-null strings
    return {
      ok: true,
      data: stats.map((s) => ({
        ...s,
        sampleWord: s.sampleWord ?? '',
        sampleMeaning: s.sampleMeaning ?? '',
      })),
    };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    console.error('[listTopRegionsByWeeklyEntries] firestore error:', code, err);
    return {
      ok: false,
      error: {
        code: `regions/top-failed:${code}`,
        message: 'İl sıralaması yüklenemedi.',
      },
    };
  }
}
