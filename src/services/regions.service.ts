import { collection, getDocs, query, orderBy, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Region, ServiceResult } from '../types/models';

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