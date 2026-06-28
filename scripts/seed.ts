import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, GeoPoint } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(__dirname, '../.env.local') });

const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'
) as Record<string, string>;

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
  const flat = coords.flat(3) as number[][];
  const lngs = flat.map((c) => c[0]);
  const lats = flat.map((c) => c[1]);
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
