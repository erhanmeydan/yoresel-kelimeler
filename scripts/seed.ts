import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, GeoPoint } from 'firebase-admin/firestore';
import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

// Service account: env var veya service-account.json dosyasından
function loadServiceAccount(): Record<string, unknown> {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (fromEnv && fromEnv.trim().length > 0) {
    try {
      return JSON.parse(fromEnv);
    } catch (err) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON parse hatası:', err);
      process.exit(1);
    }
  }
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? resolve(__dirname, '../service-account.json');
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`${filePath} okuma hatası:`, err);
      process.exit(1);
    }
  }
  console.error('Service account bulunamadı.');
  process.exit(1);
}

const serviceAccount = loadServiceAccount() as Record<string, string>;

const app = initializeApp({
  credential: cert(serviceAccount as Parameters<typeof cert>[0]),
});

const db = getFirestore(app);

interface ProvinceFeature {
  type: 'Feature';
  properties: {
    name: string;
    plate?: string;
    parentRegion?: string;
  };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
}

function centroid(coords: number[][][][]): GeoPoint {
  // coords: MultiPolygon yapısı - tüm polygonların tüm ringlerinin tüm noktalarını düzleştir
  const allPoints: number[][] = [];
  for (const polygon of coords) {
    for (const ring of polygon) {
      for (const point of ring) {
        allPoints.push(point);
      }
    }
  }
  const lngs = allPoints.map((p) => p[0]).filter((n): n is number => typeof n === 'number' && !isNaN(n));
  const lats = allPoints.map((p) => p[1]).filter((n): n is number => typeof n === 'number' && !isNaN(n));
  if (lngs.length === 0 || lats.length === 0) {
    throw new Error('centroid: geçerli koordinat bulunamadı');
  }
  return new GeoPoint(
    lats.reduce((a, b) => a + b, 0) / lats.length,
    lngs.reduce((a, b) => a + b, 0) / lngs.length,
  );
}

async function seedRegions(): Promise<void> {
  const geojsonPath = resolve(__dirname, '../public/data/turkey-provinces.geojson');
  const data = JSON.parse(readFileSync(geojsonPath, 'utf-8')) as {
    features: ProvinceFeature[];
  };

  const batch = db.batch();
  let count = 0;

  for (const feature of data.features) {
    const ref = db.collection('regions').doc(feature.properties.plate ?? feature.properties.name);
    const geom = feature.geometry;
    const coords =
      geom.type === 'MultiPolygon'
        ? (geom.coordinates as number[][][][])
        : ([geom.coordinates] as number[][][][]);

    batch.set(ref, {
      name: feature.properties.name,
      plateCode: feature.properties.plate ?? '',
      parentRegion: feature.properties.parentRegion ?? '',
      geoPoint: centroid(coords),
      createdAt: new Date(),
    });
    count++;
  }

  await batch.commit();
  console.log(`✓ ${count} il yüklendi`);
}

seedRegions().catch((err: unknown) => {
  console.error('Seed hatası:', err);
  process.exit(1);
});
