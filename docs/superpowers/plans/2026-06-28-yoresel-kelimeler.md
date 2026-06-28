# Yöresel Kelime ve Deyim Haritası — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Türkiye'nin 81 iline ait yöresel kelimeleri, deyimleri ve atasözlerini harita üzerinde topluluk katkısıyla büyüyen bir kültürel arşiv olarak sunmak.

**Architecture:** Vanilla TypeScript + Vite tek sayfa uygulaması, Leaflet harita, Firebase (Auth + Firestore + Hosting + Functions) backend. 9 aşamalı kademeli geliştirme; her aşama kendi içinde çalışan, doğrulanabilir bir çıktı verir.

**Tech Stack:** Vite 5.x, TypeScript 5.x (strict), Vanilla TS, Leaflet 1.9.x, OpenStreetMap, Firebase 11.x (modular SDK), Cloud Functions (Node 20), Firebase Emulator Suite.

---

## Global Constraints

Spec'ten gelen ve tüm görevlere uygulanacak kurallar (değiştirilemez):

- **Dil:** UI tamamen Türkçe. Tüm kullanıcıya görünen metinler Türkçe yazılır. Yorum, log, commit mesajları İngilizce olabilir.
- **Tip güvenliği:** TypeScript `strict: true`. `any` kullanımı yasak; gerekirse `unknown` + type guard.
- **Framework yok:** React/Vue/Svelte eklenmez. Vanilla TS + Web Components.
- **Harita:** Sadece Leaflet + OpenStreetMap. Mapbox/MapLibre yok.
- **Güvenlik:** API anahtarları `.env.local` (git'e gitmez). Firestore rules sıkı. Public `apiKey` Console'da referrer kısıtlı.
- **Bağımlılıklar:** Minimum — sadece ihtiyaç duyulan paketler.
- **Commit sıklığı:** Her görev en az 1 commit. Mesaj formatı: `type(scope): subject` (Conventional Commits).
- **Branches:** `main` (production), `develop` (integration). Tüm çalışma `develop` üzerinden.
- **YAGNI:** Like dışı etkileşim, yorum, medya, çoklu dil eklenmez.

---

## Dosya Yapısı (Plana Başlamadan Önce Bak)

```
yoresel-kelimeler/
├── public/
│   ├── favicon.svg
│   └── data/turkey-provinces.geojson
├── src/
│   ├── main.ts
│   ├── styles/{main,variables}.css
│   ├── config/{firebase,constants}.ts
│   ├── services/{auth,entries,regions,reports,moderation}.service.ts
│   ├── components/{Header,MapView,EntryCard,EntryDetail,EntryForm,SearchBar,AuthModal,ProfileMenu,ReportButton}.ts
│   ├── pages/{HomePage,ContributePage,ProfilePage,ModerationPage}.ts
│   ├── store/store.ts
│   ├── utils/{validation,sanitize,search,geo}.ts
│   └── types/models.ts
├── functions/src/{index,onEntryCreate,onEntryLike,adminBootstrap}.ts
├── scripts/seed.ts
├── tests/rules/{entries,users,reports}.test.ts
├── .env.example
├── .gitignore
├── .firebaserc
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── README.md
```

---

## Faz 0 — Hazırlık

### Task 1: Git repo ve branch stratejisi

**Files:**
- Create: `.gitignore`

**Steps:**

- [ ] **Step 1.1: `main` branch'i oluştur ve `develop` branch'ine geç**

```bash
cd /Users/erhanmeydan/Desktop/YouTube/149\ -\ MiniMax-M3/web-projesi
git checkout -b main
git checkout -b develop
git push -u origin main develop   # GitHub remote varsa; yoksa repo'yu GitHub'da oluştur, sonra push
```

- [ ] **Step 1.2: `.gitignore` oluştur**

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Build
dist/
build/
.vite/

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log
ui-debug.log

# Env
.env
.env.local
.env.*.local

# Editor
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Coverage
coverage/
*.lcov

# Functions
functions/lib/
functions/node_modules/
```

- [ ] **Step 1.3: Commit**

```bash
git add .gitignore
git commit -m "chore: initial gitignore"
git push -u origin develop
```

---

### Task 2: Vite + TypeScript scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`

**Steps:**

- [ ] **Step 2.1: `package.json` oluştur**

```json
{
  "name": "yoresel-kelimeler",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "emulators": "firebase emulators:start",
    "deploy": "npm run build && firebase deploy",
    "seed": "tsx scripts/seed.ts",
    "test:rules": "firebase emulators:exec --only firestore 'vitest run tests/rules'"
  },
  "dependencies": {
    "firebase": "^11.0.0",
    "leaflet": "^1.9.4"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.12",
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0",
    "@firebase/rules-unit-testing": "^3.0.0"
  }
}
```

- [ ] **Step 2.2: `tsconfig.json` oluştur**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "include": ["src", "scripts", "tests"]
}
```

- [ ] **Step 2.3: `vite.config.ts` oluştur**

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          leaflet: ['leaflet'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
```

- [ ] **Step 2.4: `index.html` oluştur**

```html
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Türkiye'nin yöresel kelime ve deyimlerini harita üzerinde keşfedin." />
    <title>Yöresel Kelimeler Haritası</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2.5: `src/main.ts` minimal scaffold**

```typescript
console.log('Yöresel Kelimeler - bootstrap başladı');
const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  app.innerHTML = '<h1>Yöresel Kelimeler</h1><p>Yükleniyor...</p>';
}
```

- [ ] **Step 2.6: Bağımlılıkları kur ve çalıştığını doğrula**

```bash
npm install
npm run dev
```

Beklenen: `http://localhost:5173` adresinde "Yöresel Kelimeler" başlığı görünür.

- [ ] **Step 2.7: Commit**

```bash
git add .
git commit -m "chore: Vite + TypeScript scaffold"
```

---

### Task 3: Firebase projesi oluştur ve CLI kur

**Files:**
- Create: `.firebaserc`, `.env.example`

**Steps:**

- [ ] **Step 3.1: Firebase CLI'yi global kur**

```bash
npm install -g firebase-tools
firebase login
```

- [ ] **Step 3.2: Firebase Console'dan proje oluştur**

URL: https://console.firebase.google.com → "Proje Ekle" → `yoresel-kelimeler` (ID benzersiz olmalı, gerekirse `yoresel-kelimeler-{suffix}`).

- [ ] **Step 3.3: `.firebaserc` oluştur**

```json
{
  "projects": {
    "default": "yoresel-kelimeler"
  }
}
```

> Kendi proje ID'nizi kullanın.

- [ ] **Step 3.4: `.env.example` oluştur**

```bash
# Firebase Web Config (public; referrer kısıtlı olacak)
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:abcdef
VITE_USE_EMULATORS=true
```

- [ ] **Step 3.5: `.env.local` oluştur ve gerçek değerleri yaz**

Firebase Console → Project Settings → Your apps → Web app config'den kopyala. `.env.local` git'e gitmez.

- [ ] **Step 3.6: Commit**

```bash
git add .firebaserc .env.example
git commit -m "chore: Firebase proje yapılandırması"
```

---

### Task 4: Firebase init (Hosting, Firestore, Emulators, Functions)

**Files:**
- Create: `firebase.json`, `firestore.indexes.json`

**Steps:**

- [ ] **Step 4.1: Firebase servislerini başlat**

```bash
firebase init
```

Seçimler:
- Firestore: Rules ve indexes dosyalarını oluştur
- Functions: TypeScript, ESLint hayır
- Hosting: `dist` klasörü, SPA rewrite `** → /index.html`
- Emulators: Auth, Firestore, Functions, Hosting

- [ ] **Step 4.2: `firebase.json` kontrol et / düzenle**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "runtime": "nodejs20"
    }
  ],
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 4.3: `firestore.indexes.json`**

```json
{
  "indexes": [
    {
      "collectionGroup": "entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "regionId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "likeCount", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "searchTokens", "arrayConfig": "CONTAINS" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "entries",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "contributorId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "reports",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

- [ ] **Step 4.4: Functions için klasör hazırla**

```bash
cd functions
npm init -y
npm install firebase-functions firebase-admin
npm install -D typescript @types/node
```

`functions/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "lib"
  },
  "include": ["src"]
}
```

- [ ] **Step 4.5: Emulator başlat ve doğrula**

```bash
cd ..
firebase emulators:start
```

UI: http://localhost:4000 — Auth, Firestore, Functions, Hosting emülatörleri görünmeli.

- [ ] **Step 4.6: Commit**

```bash
git add firebase.json firestore.indexes.json functions/
git commit -m "chore: Firebase Hosting, Firestore, Functions ve emulators yapılandırması"
```

---

## Faz 1 — Temel Altyapı

### Task 5: Firestore rules v0 (boş koleksiyonlar)

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 5.1: Geçici olarak her şeyi reddet, sonra Task 6'da sıkılaştır**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 5.2: Commit**

```bash
git add firestore.rules
git commit -m "chore(firestore): initial deny-all rules"
```

---

### Task 6: Tam Firestore rules (final)

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 6.1: Spec bölüm 6.2'deki tam kuralları yaz**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isModerator() {
      return isSignedIn() && getUserRole() in ['moderator', 'admin'];
    }

    function isAdmin() {
      return isSignedIn() && getUserRole() == 'admin';
    }

    function isValidEntry(data) {
      return data.word is string
          && data.word.size() > 0 && data.word.size() <= 100
          && data.meaning is string
          && data.meaning.size() > 0 && data.meaning.size() <= 500
          && data.exampleSentence is string
          && data.exampleSentence.size() <= 500
          && data.type in ['kelime', 'deyim', 'atasözü']
          && data.regionId is string
          && data.status in ['active', 'removed'];
    }

    match /regions/{regionId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /users/{uid} {
      allow read: if true;
      allow create: if isOwner(uid)
                     && request.resource.data.role == 'user';
      allow update: if isOwner(uid)
                     && request.resource.data.role == resource.data.role
                     || isAdmin();
      allow delete: if isAdmin();
    }

    match /entries/{entryId} {
      allow read: if resource.data.status == 'active'
                   || (isSignedIn() && resource.data.contributorId == request.auth.uid)
                   || isModerator();
      allow create: if isSignedIn()
                     && isValidEntry(request.resource.data)
                     && request.resource.data.contributorId == request.auth.uid
                     && request.resource.data.status == 'active';
      allow update: if isSignedIn() &&
                     (
                       (resource.data.contributorId == request.auth.uid
                        && isValidEntry(request.resource.data)
                        && request.resource.data.contributorId == resource.data.contributorId)
                       || isModerator()
                     );
      allow delete: if isModerator();
    }

    match /reports/{reportId} {
      allow create: if isSignedIn()
                     && request.resource.data.reporterId == request.auth.uid;
      allow read: if isModerator();
      allow update, delete: if isModerator();
    }

    match /moderationLog/{logId} {
      allow read: if isModerator();
      allow write: if false;
    }
  }
}
```

- [ ] **Step 6.2: Commit**

```bash
git add firestore.rules
git commit -m "feat(firestore): complete security rules with role-based access"
```

---

### Task 7: Tip tanımları (`types/models.ts`)

**Files:**
- Create: `src/types/models.ts`

- [ ] **Step 7.1: Tüm Firestore model tiplerini tanımla**

```typescript
import { Timestamp, GeoPoint } from 'firebase/firestore';

export type UserRole = 'user' | 'moderator' | 'admin';
export type EntryType = 'kelime' | 'deyim' | 'atasözü';
export type EntryStatus = 'active' | 'removed';
export type ReportStatus = 'open' | 'resolved' | 'dismissed';
export type ModerationAction = 'remove' | 'restore' | 'edit';

export interface Region {
  id: string;
  name: string;
  plateCode: string;
  parentRegion: string;
  geoPoint: GeoPoint;
  createdAt: Timestamp;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  contributionCount: number;
  approvedCount: number;
  removedCount: number;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
}

export interface Entry {
  id: string;
  word: string;
  type: EntryType;
  meaning: string;
  exampleSentence: string;
  regionId: string;
  contributorId: string;
  contributorName: string;
  status: EntryStatus;
  removedReason: string | null;
  removedBy: string | null;
  removedAt: Timestamp | null;
  likeCount: number;
  searchTokens: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Report {
  id: string;
  entryId: string;
  reporterId: string;
  reason: string;
  status: ReportStatus;
  resolvedBy: string | null;
  createdAt: Timestamp;
}

export interface ModerationLog {
  id: string;
  entryId: string;
  moderatorId: string;
  action: ModerationAction;
  reason: string;
  prevValue: Record<string, unknown> | null;
  createdAt: Timestamp;
}

export interface AppError {
  code: string;
  message: string;
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: AppError };
```

- [ ] **Step 7.2: Commit**

```bash
git add src/types/models.ts
git commit -m "feat(types): Firestore model type definitions"
```

---

### Task 8: Sabitler ve Firebase config

**Files:**
- Create: `src/config/constants.ts`, `src/config/firebase.ts`

- [ ] **Step 8.1: `src/config/constants.ts`**

```typescript
export const COLLECTIONS = {
  REGIONS: 'regions',
  USERS: 'users',
  ENTRIES: 'entries',
  REPORTS: 'reports',
  MODERATION_LOG: 'moderationLog',
} as const;

export const TURKISH_PARENT_REGIONS = [
  'Marmara',
  'Ege',
  'Akdeniz',
  'Karadeniz',
  'İç Anadolu',
  'Doğu Anadolu',
  'Güneydoğu Anadolu',
] as const;

export const ENTRY_TYPE_LABELS: Record<'kelime' | 'deyim' | 'atasözü', string> = {
  kelime: 'Kelime',
  deyim: 'Deyim',
  atasözü: 'Atasözü',
};

export const VALIDATION = {
  WORD_MAX: 100,
  MEANING_MAX: 500,
  EXAMPLE_MAX: 500,
  REASON_MAX: 200,
  ENTRIES_PER_MINUTE: 5,
} as const;
```

- [ ] **Step 8.2: `src/config/firebase.ts`**

```typescript
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app: FirebaseApp = initializeApp(config);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';
if (useEmulators) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', 8080);
}
```

- [ ] **Step 8.3: `tsconfig.json`'a `vite/client` types ekle**

```json
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

- [ ] **Step 8.4: Derleme hatası yokluğunu doğrula**

```bash
npm run build
```

- [ ] **Step 8.5: Commit**

```bash
git add src/config/
git commit -m "feat(config): Firebase init ve sabitler"
```

---

### Task 9: Regions seed script

**Files:**
- Create: `scripts/seed.ts`

**Önkoşul:** `public/data/turkey-provinces.geojson` dosyası (aşağıdaki kaynaktan indirilir):
- https://github.com/ozdemirburak/il-iller (veya eşdeğeri açık kaynak)

- [ ] **Step 9.1: GeoJSON'u indir ve `public/data/` altına koy**

```bash
curl -L -o public/data/turkey-provinces.geojson https://raw.githubusercontent.com/ozdemirburak/il-iller/master/turkey.json
```

> Eğer URL farklıysa, GitHub'dan ham JSON'u indir.

- [ ] **Step 9.2: `scripts/seed.ts` oluştur**

```typescript
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
```

- [ ] **Step 9.3: `package.json`'a `seed` script ekle**

```json
{
  "scripts": {
    "seed:regions": "tsx scripts/seed.ts"
  },
  "devDependencies": {
    "firebase-admin": "^12.0.0",
    "dotenv": "^16.4.0"
  }
}
```

- [ ] **Step 9.4: Service account JSON'unu indir ve `.env.local`'e ekle**

Firebase Console → Project Settings → Service Accounts → "Generate new private key". JSON içeriğini tek satır string olarak `.env.local`'e ekle:

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

- [ ] **Step 9.5: Seed'i çalıştır (production)**

```bash
npm run seed:regions
```

Beklenen: `✓ 81 il yüklendi`.

- [ ] **Step 9.6: Commit**

```bash
git add scripts/seed.ts public/data/turkey-provinces.geojson package.json
git commit -m "feat(seed): 81 il bölge seed scripti"
```

---

## Faz 2 — Harita

### Task 10: Regions service

**Files:**
- Create: `src/services/regions.service.ts`

- [ ] **Step 10.1: Service'i yaz**

```typescript
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
```

- [ ] **Step 10.2: Commit**

```bash
git add src/services/regions.service.ts
git commit -m "feat(services): regions.service"
```

---

### Task 11: Entries service (okuma)

**Files:**
- Create: `src/services/entries.service.ts`

- [ ] **Step 11.1: Read-only fonksiyonlar**

```typescript
import {
  collection, query, where, orderBy, limit, getDocs,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Entry, ServiceResult } from '../types/models';

export async function listEntriesByRegion(
  db: Firestore, regionId: string, max = 50,
): Promise<ServiceResult<Entry[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.ENTRIES),
      where('regionId', '==', regionId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry) };
  } catch {
    return { ok: false, error: { code: 'entries/list-failed', message: 'Kayıtlar yüklenemedi.' } };
  }
}

export async function listTrendingEntries(
  db: Firestore, max = 20,
): Promise<ServiceResult<Entry[]>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.ENTRIES),
      where('status', '==', 'active'),
      orderBy('likeCount', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry) };
  } catch {
    return { ok: false, error: { code: 'entries/trending-failed', message: 'Trend kayıtlar yüklenemedi.' } };
  }
}
```

- [ ] **Step 11.2: Commit**

```bash
git add src/services/entries.service.ts
git commit -m "feat(services): entries read operations"
```

---

### Task 12: CSS değişkenleri ve ana stil

**Files:**
- Create: `src/styles/variables.css`, `src/styles/main.css`

- [ ] **Step 12.1: `src/styles/variables.css`**

```css
:root {
  --color-bg: #faf7f2;
  --color-surface: #ffffff;
  --color-primary: #b8492c;
  --color-primary-hover: #9a3d24;
  --color-text: #2b2118;
  --color-muted: #6b5d4f;
  --color-border: #e8e0d4;
  --color-success: #4a7c59;
  --color-danger: #b3361c;
  --color-warning: #c89432;

  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Inter', system-ui, -apple-system, sans-serif;

  --radius-sm: 4px;
  --radius: 8px;
  --radius-lg: 12px;

  --shadow-sm: 0 1px 3px rgba(43, 33, 24, 0.08);
  --shadow-md: 0 4px 12px rgba(43, 33, 24, 0.10);
  --shadow-lg: 0 12px 28px rgba(43, 33, 24, 0.16);

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  --header-height: 64px;
  --max-content-width: 1280px;
}
```

- [ ] **Step 12.2: `src/styles/main.css`**

```css
@import './variables.css';
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@600;700&display=swap');
@import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  height: 100%;
  font-family: var(--font-body);
  background: var(--color-bg);
  color: var(--color-text);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

#app {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
}

button.btn-primary {
  background: var(--color-primary);
  color: white;
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius);
  font-weight: 500;
  transition: background 0.15s;
}
button.btn-primary:hover { background: var(--color-primary-hover); }
button.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

button.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius);
}

h1, h2, h3 { font-family: var(--font-display); font-weight: 700; line-height: 1.2; }
h1 { font-size: 2rem; }
h2 { font-size: 1.5rem; }
h3 { font-size: 1.25rem; }

input, textarea, select {
  font-family: inherit;
  font-size: 1rem;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  width: 100%;
}
input:focus, textarea:focus, select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: -1px;
}

.toast-container {
  position: fixed;
  bottom: var(--space-5);
  right: var(--space-5);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.toast {
  background: var(--color-surface);
  border-left: 4px solid var(--color-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  max-width: 320px;
}
.toast.error { border-left-color: var(--color-danger); }
.toast.success { border-left-color: var(--color-success); }
```

- [ ] **Step 12.3: `main.ts`'a import ekle**

```typescript
import './styles/main.css';
```

- [ ] **Step 12.4: Commit**

```bash
git add src/styles/
git commit -m "feat(styles): design tokens ve ana stil"
```

---

### Task 13: MapView component (Leaflet)

**Files:**
- Create: `src/utils/geo.ts`, `src/components/MapView.ts`

- [ ] **Step 13.1: `src/utils/geo.ts`**

```typescript
import L from 'leaflet';

export function createMarkerIcon(active = false): L.DivIcon {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div class="marker-dot ${active ? 'active' : ''}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function createLeafletMap(container: HTMLElement): L.Map {
  return L.map(container, {
    center: [39.0, 35.0],
    zoom: 6,
    minZoom: 5,
    maxZoom: 12,
    scrollWheelZoom: true,
  });
}

export function addOsmTileLayer(map: L.Map): void {
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap, © CARTO',
    maxZoom: 19,
  }).addTo(map);
}
```

- [ ] **Step 13.2: `src/styles/components/map.css` (ek olarak)**

```css
.custom-marker { background: transparent; border: none; }
.marker-dot {
  width: 16px;
  height: 16px;
  background: var(--color-primary);
  border: 3px solid var(--color-surface);
  border-radius: 50%;
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s;
}
.marker-dot.active {
  background: var(--color-primary-hover);
  transform: scale(1.3);
}
.leaflet-container { font-family: var(--font-body); }
```

`main.css`'e ekle:

```css
@import './components/map.css';
```

- [ ] **Step 13.3: `src/components/MapView.ts`**

```typescript
import L from 'leaflet';
import { addOsmTileLayer, createLeafletMap, createMarkerIcon } from '../utils/geo';
import type { Region } from '../types/models';

export interface MapViewCallbacks {
  onRegionClick: (region: Region) => void;
}

export class MapView {
  private map: L.Map;
  private markers = new Map<string, L.Marker>();

  constructor(container: HTMLElement, private callbacks: MapViewCallbacks) {
    this.map = createLeafletMap(container);
    addOsmTileLayer(this.map);
  }

  setRegions(regions: Region[]): void {
    for (const m of this.markers.values()) m.remove();
    this.markers.clear();

    for (const region of regions) {
      const [lat, lng] = [region.geoPoint.latitude, region.geoPoint.longitude];
      const marker = L.marker([lat, lng], { icon: createMarkerIcon() })
        .addTo(this.map)
        .on('click', () => this.callbacks.onRegionClick(region));
      this.markers.set(region.id, marker);
    }
  }

  highlightRegion(regionId: string | null): void {
    for (const [id, m] of this.markers) {
      const icon = createMarkerIcon(id === regionId);
      m.setIcon(icon);
    }
    if (regionId) {
      const region = [...this.markers.entries()].find(([id]) => id === regionId)?.[1];
      if (region) region.openPopup();
    }
  }

  destroy(): void {
    this.map.remove();
  }
}
```

- [ ] **Step 13.4: Commit**

```bash
git add src/utils/geo.ts src/components/MapView.ts src/styles/
git commit -m "feat(map): Leaflet MapView component"
```

---

### Task 14: HomePage + bölgeye tıklayınca liste

**Files:**
- Create: `src/store/store.ts`, `src/components/EntryCard.ts`, `src/components/EntryDetail.ts`, `src/pages/HomePage.ts`

- [ ] **Step 14.1: `src/store/store.ts` (minimal)**

```typescript
import type { Region } from '../types/models';

export interface AppState {
  selectedRegion: Region | null;
}

type Listener = (state: AppState) => void;

class Store {
  private state: AppState = { selectedRegion: null };
  private listeners = new Set<Listener>();

  getState(): AppState {
    return this.state;
  }

  setSelectedRegion(region: Region | null): void {
    this.state = { ...this.state, selectedRegion: region };
    this.listeners.forEach((l) => l(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const store = new Store();
```

- [ ] **Step 14.2: `src/components/EntryCard.ts`**

```typescript
import type { Entry } from '../types/models';
import { ENTRY_TYPE_LABELS } from '../config/constants';

export function renderEntryCard(entry: Entry): HTMLElement {
  const card = document.createElement('article');
  card.className = 'entry-card';
  card.innerHTML = `
    <header>
      <span class="entry-type">${ENTRY_TYPE_LABELS[entry.type]}</span>
      <h3 class="entry-word"></h3>
    </header>
    <p class="entry-meaning"></p>
    <footer>
      <span class="entry-region"></span>
      <span class="entry-likes">♥ ${entry.likeCount}</span>
    </footer>
  `;
  card.querySelector('.entry-word')!.textContent = entry.word;
  card.querySelector('.entry-meaning')!.textContent = entry.meaning;
  card.querySelector('.entry-region')!.textContent = entry.regionId;
  return card;
}
```

- [ ] **Step 14.3: `src/styles/components/entry.css`**

```css
.entry-card {
  background: var(--color-surface);
  border-radius: var(--radius);
  padding: var(--space-4);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}
.entry-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.entry-card header { display: flex; justify-content: space-between; align-items: baseline; }
.entry-type { font-size: 0.75rem; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.05em; }
.entry-word { color: var(--color-primary); }
.entry-meaning { color: var(--color-text); }
.entry-card footer { display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--color-muted); }
```

`main.css`'e `@import './components/entry.css';` ekle.

- [ ] **Step 14.4: `src/pages/HomePage.ts`**

```typescript
import { db } from '../config/firebase';
import { listRegions } from '../services/regions.service';
import { listEntriesByRegion } from '../services/entries.service';
import { store } from '../store/store';
import { MapView } from '../components/MapView';
import { renderEntryCard } from '../components/EntryCard';
import type { Region, Entry } from '../types/models';

export async function renderHomePage(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <main class="home-page">
      <section class="map-section"><div id="map" class="map"></div></section>
      <aside class="entries-panel">
        <h2 id="panel-title">Türkiye Yöresel Kelimeleri</h2>
        <p id="panel-subtitle">Bir ile tıklayarak o yörenin kelimelerini görün.</p>
        <div id="entries-list" class="entries-list"></div>
      </aside>
    </main>
  `;

  const mapEl = container.querySelector<HTMLDivElement>('#map')!;
  const listEl = container.querySelector<HTMLDivElement>('#entries-list')!;
  const titleEl = container.querySelector<HTMLHeadingElement>('#panel-title')!;
  const subtitleEl = container.querySelector<HTMLParagraphElement>('#panel-subtitle')!;

  const mapView = new MapView(mapEl, {
    onRegionClick: (region) => handleRegionClick(region),
  });

  const regionsResult = await listRegions(db);
  if (regionsResult.ok) {
    mapView.setRegions(regionsResult.data);
  }

  async function handleRegionClick(region: Region): Promise<void> {
    store.setSelectedRegion(region);
    mapView.highlightRegion(region.id);
    titleEl.textContent = region.name;
    subtitleEl.textContent = `${region.parentRegion} Bölgesi`;
    listEl.innerHTML = '<p class="loading">Yükleniyor...</p>';

    const result = await listEntriesByRegion(db, region.id);
    if (result.ok) {
      renderEntries(result.data, listEl);
    } else {
      listEl.innerHTML = `<p class="error">${result.error.message}</p>`;
    }
  }

  function renderEntries(entries: Entry[], target: HTMLElement): void {
    if (entries.length === 0) {
      target.innerHTML = '<p class="empty">Bu bölgeden henüz kayıt yok. İlk siz ekleyin!</p>';
      return;
    }
    target.innerHTML = '';
    for (const entry of entries) target.appendChild(renderEntryCard(entry));
  }
}
```

- [ ] **Step 14.5: `src/styles/components/home.css`**

```css
.home-page { display: grid; grid-template-columns: 1fr 400px; flex: 1; }
.map-section { position: relative; }
.map { height: 100%; width: 100%; }
.entries-panel {
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
  padding: var(--space-5);
  overflow-y: auto;
}
.entries-panel h2 { margin-bottom: var(--space-2); }
.entries-panel p { color: var(--color-muted); margin-bottom: var(--space-4); }
.entries-list { display: flex; flex-direction: column; gap: var(--space-3); }
@media (max-width: 768px) {
  .home-page { grid-template-columns: 1fr; grid-template-rows: 50vh 1fr; }
  .entries-panel { border-left: none; border-top: 1px solid var(--color-border); }
}
```

- [ ] **Step 14.6: `main.ts` güncelle**

```typescript
import './styles/main.css';
import { renderHomePage } from './pages/HomePage';

const app = document.querySelector<HTMLDivElement>('#app');
if (app) {
  void renderHomePage(app);
}
```

- [ ] **Step 14.7: Emulator'da doğrula**

```bash
firebase emulators:start &
npm run dev
```

http://localhost:5173 — harita açılmalı, 81 il işaretli olmalı (henüz kayıt yok, panelde "Bu bölgeden henüz kayıt yok" mesajı çıkmalı).

- [ ] **Step 14.8: Commit**

```bash
git add .
git commit -m "feat(home): HomePage with map and entries panel"
```

---

## Faz 3 — Authentication

### Task 15: Auth service

**Files:**
- Create: `src/services/auth.service.ts`

- [ ] **Step 15.1: Service'i yaz**

```typescript
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, updateProfile,
  type User, type Auth,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { UserProfile, ServiceResult } from '../types/models';

const errorMessages: Record<string, string> = {
  'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı.',
  'auth/invalid-email': 'Geçersiz e-posta adresi.',
  'auth/user-not-found': 'Bu e-postaya sahip bir hesap yok.',
  'auth/wrong-password': 'Hatalı şifre.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/too-many-requests': 'Çok fazla deneme. Lütfen sonra tekrar deneyin.',
};

function mapAuthError(code: string): string {
  return errorMessages[code] ?? 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

export async function register(
  auth: Auth, db: Firestore, email: string, password: string, displayName: string,
): Promise<ServiceResult<UserProfile>> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    const profile: Omit<UserProfile, 'createdAt' | 'lastActiveAt'> & { createdAt: unknown; lastActiveAt: unknown } = {
      uid: cred.user.uid,
      displayName,
      email,
      role: 'user',
      contributionCount: 0,
      approvedCount: 0,
      removedCount: 0,
      createdAt: serverTimestamp(),
      lastActiveAt: serverTimestamp(),
    };
    await setDoc(doc(db, COLLECTIONS.USERS, cred.user.uid), profile);
    return { ok: true, data: { ...profile, createdAt: null as never, lastActiveAt: null as never } };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    return { ok: false, error: { code, message: mapAuthError(code) } };
  }
}

export async function login(
  auth: Auth, email: string, password: string,
): Promise<ServiceResult<User>> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, data: cred.user };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'unknown';
    return { ok: false, error: { code, message: mapAuthError(code) } };
  }
}

export async function logout(auth: Auth): Promise<ServiceResult<null>> {
  try {
    await fbSignOut(auth);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'auth/logout-failed', message: 'Çıkış yapılamadı.' } };
  }
}

export function observeAuth(auth: Auth, callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function getProfile(db: Firestore, uid: string): Promise<ServiceResult<UserProfile | null>> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.USERS, uid));
    return { ok: true, data: snap.exists() ? (snap.data() as UserProfile) : null };
  } catch {
    return { ok: false, error: { code: 'auth/profile-failed', message: 'Profil yüklenemedi.' } };
  }
}
```

- [ ] **Step 15.2: Commit**

```bash
git add src/services/auth.service.ts
git commit -m "feat(auth): auth service with email/password"
```

---

### Task 16: AuthModal component

**Files:**
- Create: `src/components/AuthModal.ts`

- [ ] **Step 16.1: Modal'ı yaz**

```typescript
import { auth, db } from '../config/firebase';
import { login, register } from '../services/auth.service';

export function showAuthModal(onSuccess: () => void): void {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <header class="modal-header">
        <h2 id="auth-title">Giriş Yap</h2>
        <button class="modal-close" aria-label="Kapat">×</button>
      </header>
      <div class="modal-body">
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Giriş</button>
          <button class="auth-tab" data-tab="register">Kayıt</button>
        </div>
        <form id="auth-form" class="auth-form">
          <label class="auth-field" data-field="displayName" hidden>
            <span>Ad</span>
            <input name="displayName" required minlength="2" maxlength="40" />
          </label>
          <label class="auth-field">
            <span>E-posta</span>
            <input name="email" type="email" required autocomplete="email" />
          </label>
          <label class="auth-field">
            <span>Şifre</span>
            <input name="password" type="password" required minlength="6" autocomplete="current-password" />
          </label>
          <p class="auth-error" role="alert" hidden></p>
          <button type="submit" class="btn-primary">Gönder</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  let mode: 'login' | 'register' = 'login';
  const title = modal.querySelector<HTMLHeadingElement>('#auth-title')!;
  const errorEl = modal.querySelector<HTMLParagraphElement>('.auth-error')!;
  const nameField = modal.querySelector<HTMLLabelElement>('[data-field="displayName"]')!;

  const close = (): void => modal.remove();
  modal.querySelector('.modal-close')!.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelectorAll<HTMLButtonElement>('.auth-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      mode = tab.dataset.tab as 'login' | 'register';
      modal.querySelectorAll('.auth-tab').forEach((t) => t.classList.toggle('active', t === tab));
      title.textContent = mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol';
      nameField.hidden = mode === 'login';
      errorEl.hidden = true;
    });
  });

  modal.querySelector<HTMLFormElement>('#auth-form')!.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '');
    const password = String(fd.get('password') ?? '');

    const result = mode === 'login'
      ? await login(auth, email, password)
      : await register(auth, db, email, password, String(fd.get('displayName') ?? ''));

    if (result.ok) {
      close();
      onSuccess();
    } else {
      errorEl.textContent = result.error.message;
      errorEl.hidden = false;
    }
  });
}
```

- [ ] **Step 16.2: `src/styles/components/modal.css`**

```css
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(43, 33, 24, 0.5);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}
.modal {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  max-width: 420px; width: 100%;
  box-shadow: var(--shadow-lg);
}
.modal-header { display: flex; justify-content: space-between; align-items: center; padding: var(--space-5); border-bottom: 1px solid var(--color-border); }
.modal-close { font-size: 1.5rem; color: var(--color-muted); padding: var(--space-2); }
.modal-body { padding: var(--space-5); }
.auth-tabs { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); }
.auth-tab { padding: var(--space-2) var(--space-4); border-radius: var(--radius); color: var(--color-muted); }
.auth-tab.active { background: var(--color-bg); color: var(--color-text); font-weight: 500; }
.auth-form { display: flex; flex-direction: column; gap: var(--space-4); }
.auth-field { display: flex; flex-direction: column; gap: var(--space-1); }
.auth-field span { font-size: 0.875rem; color: var(--color-muted); }
.auth-error { color: var(--color-danger); font-size: 0.875rem; }
```

- [ ] **Step 16.3: Commit**

```bash
git add src/components/AuthModal.ts src/styles/
git commit -m "feat(auth): AuthModal component"
```

---

### Task 17: Header + auth state observer

**Files:**
- Create: `src/components/Header.ts`

- [ ] **Step 17.1: Header'ı yaz**

```typescript
import { auth } from '../config/firebase';
import { logout, observeAuth } from '../services/auth.service';
import { showAuthModal } from './AuthModal';

export function renderHeader(container: HTMLElement): void {
  container.innerHTML = `
    <header class="app-header">
      <a href="#/" class="brand">
        <span class="brand-mark">YK</span>
        <span class="brand-text">Yöresel Kelimeler</span>
      </a>
      <nav class="header-nav">
        <a href="#/">Harita</a>
        <a href="#/contribute">Katkı</a>
      </nav>
      <div class="header-auth" id="auth-slot"></div>
    </header>
  `;

  const authSlot = container.querySelector<HTMLDivElement>('#auth-slot')!;

  observeAuth(auth, (user) => {
    if (user) {
      authSlot.innerHTML = `
        <div class="profile-menu">
          <button class="profile-button">${user.displayName ?? user.email}</button>
          <div class="profile-dropdown" hidden>
            <a href="#/profile">Profilim</a>
            <button id="logout-btn">Çıkış Yap</button>
          </div>
        </div>
      `;
      const button = authSlot.querySelector<HTMLButtonElement>('.profile-button')!;
      const dropdown = authSlot.querySelector<HTMLDivElement>('.profile-dropdown')!;
      button.addEventListener('click', () => { dropdown.hidden = !dropdown.hidden; });
      authSlot.querySelector<HTMLButtonElement>('#logout-btn')!.addEventListener('click', async () => {
        await logout(auth);
        dropdown.hidden = true;
      });
    } else {
      authSlot.innerHTML = '<button class="btn-primary" id="login-btn">Giriş Yap</button>';
      authSlot.querySelector<HTMLButtonElement>('#login-btn')!.addEventListener('click', () => {
        showAuthModal(() => {});
      });
    }
  });
}
```

- [ ] **Step 17.2: `src/styles/components/header.css`**

```css
.app-header {
  height: var(--header-height);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-5);
  gap: var(--space-6);
  position: sticky;
  top: 0;
  z-index: 100;
}
.brand { display: flex; align-items: center; gap: var(--space-3); text-decoration: none; color: inherit; }
.brand-mark {
  width: 36px; height: 36px;
  background: var(--color-primary); color: white;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--radius); font-family: var(--font-display); font-weight: 700;
}
.brand-text { font-family: var(--font-display); font-weight: 700; font-size: 1.125rem; }
.header-nav { display: flex; gap: var(--space-4); flex: 1; }
.header-nav a { color: var(--color-text); text-decoration: none; padding: var(--space-2) var(--space-3); border-radius: var(--radius); }
.header-nav a:hover { background: var(--color-bg); }
.profile-menu { position: relative; }
.profile-button { padding: var(--space-2) var(--space-3); border-radius: var(--radius); }
.profile-dropdown {
  position: absolute; right: 0; top: 100%; margin-top: var(--space-1);
  background: var(--color-surface); border: 1px solid var(--color-border);
  border-radius: var(--radius); box-shadow: var(--shadow-md);
  min-width: 180px; padding: var(--space-2);
  display: flex; flex-direction: column; gap: var(--space-1);
}
.profile-dropdown a, .profile-dropdown button {
  padding: var(--space-2) var(--space-3); text-align: left;
  border-radius: var(--radius-sm); text-decoration: none; color: inherit; width: 100%;
}
.profile-dropdown a:hover, .profile-dropdown button:hover { background: var(--color-bg); }
```

- [ ] **Step 17.3: Commit**

```bash
git add src/components/Header.ts src/styles/
git commit -m "feat(header): Header with auth state observer"
```

---

### Task 18: Routing + main.ts integration

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 18.1: Hash routing**

```typescript
import './styles/main.css';
import { renderHeader } from './components/Header';
import { renderHomePage } from './pages/HomePage';

type Page = 'home' | 'contribute' | 'profile' | 'moderation';

function parseRoute(): Page {
  const hash = window.location.hash.replace('#/', '').split('/')[0] ?? 'home';
  if (hash === 'contribute' || hash === 'profile' || hash === 'moderation') return hash;
  return 'home';
}

async function render(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  app.innerHTML = '<div id="header-slot"></div><div id="page-slot"></div>';
  renderHeader(document.getElementById('header-slot')!);

  const slot = document.getElementById('page-slot')!;
  const page = parseRoute();
  if (page === 'home') await renderHomePage(slot);
  // contribute / profile / moderation ileride eklenecek
}

window.addEventListener('hashchange', () => void render());
void render();
```

- [ ] **Step 18.2: Login → register akışını test et**

`npm run dev` + emulator. Kayıt olunca profile dropdown görünmeli.

- [ ] **Step 18.3: Commit**

```bash
git add src/main.ts
git commit -m "feat(routing): hash routing ve header integration"
```

---

## Faz 4 — Katkı

### Task 19: Validation utils

**Files:**
- Create: `src/utils/validation.ts`

- [ ] **Step 19.1: Doğrulama kuralları**

```typescript
import { VALIDATION } from '../config/constants';
import type { EntryType } from '../types/models';

export interface ValidationError { field: string; message: string; }
export type ValidationResult = { ok: true } | { ok: false; errors: ValidationError[] };

export function validateEntry(input: {
  word: string; meaning: string; exampleSentence: string; type: EntryType; regionId: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.word.trim()) errors.push({ field: 'word', message: 'Kelime gerekli.' });
  else if (input.word.length > VALIDATION.WORD_MAX) errors.push({ field: 'word', message: `Maksimum ${VALIDATION.WORD_MAX} karakter.` });

  if (!input.meaning.trim()) errors.push({ field: 'meaning', message: 'Anlam gerekli.' });
  else if (input.meaning.length > VALIDATION.MEANING_MAX) errors.push({ field: 'meaning', message: `Maksimum ${VALIDATION.MEANING_MAX} karakter.` });

  if (input.exampleSentence.length > VALIDATION.EXAMPLE_MAX) errors.push({ field: 'exampleSentence', message: `Maksimum ${VALIDATION.EXAMPLE_MAX} karakter.` });

  if (!input.regionId) errors.push({ field: 'regionId', message: 'İl seçilmeli.' });
  if (!['kelime', 'deyim', 'atasözü'].includes(input.type)) errors.push({ field: 'type', message: 'Geçerli bir tür seçin.' });

  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateRegister(input: { email: string; password: string; displayName: string }): ValidationResult {
  const errors: ValidationError[] = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push({ field: 'email', message: 'Geçersiz e-posta.' });
  if (input.password.length < 6) errors.push({ field: 'password', message: 'Şifre en az 6 karakter.' });
  if (input.displayName.trim().length < 2) errors.push({ field: 'displayName', message: 'Ad en az 2 karakter.' });
  return errors.length ? { ok: false, errors } : { ok: true };
}
```

- [ ] **Step 19.2: Commit**

```bash
git add src/utils/validation.ts
git commit -m "feat(validation): form validation utilities"
```

---

### Task 20: Sanitize utils

**Files:**
- Create: `src/utils/sanitize.ts`

- [ ] **Step 20.1: HTML escape**

```typescript
export function escapeHtml(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

export function sanitizeText(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}
```

- [ ] **Step 20.2: Commit**

```bash
git add src/utils/sanitize.ts
git commit -m "feat(utils): HTML escape utilities"
```

---

### Task 21: Entries service (yazma)

**Files:**
- Modify: `src/services/entries.service.ts`

- [ ] **Step 21.1: Create/update/delete fonksiyonları ekle**

```typescript
import { addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment, type Firestore, type DocumentData } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Entry, ServiceResult } from '../types/models';

export async function createEntry(
  db: Firestore, input: {
    word: string; meaning: string; exampleSentence: string;
    type: Entry['type']; regionId: string; contributorId: string; contributorName: string;
  },
): Promise<ServiceResult<string>> {
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.ENTRIES), {
      ...input,
      status: 'active',
      removedReason: null,
      removedBy: null,
      removedAt: null,
      likeCount: 0,
      searchTokens: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } satisfies DocumentData);
    return { ok: true, data: ref.id };
  } catch (err) {
    return { ok: false, error: { code: 'entries/create-failed', message: 'Kayıt oluşturulamadı.', detail: String(err) } };
  }
}

export async function updateOwnEntry(
  db: Firestore, entryId: string, patch: Partial<Pick<Entry, 'word' | 'meaning' | 'exampleSentence' | 'type'>>,
): Promise<ServiceResult<null>> {
  try {
    await updateDoc(doc(db, COLLECTIONS.ENTRIES, entryId), { ...patch, updatedAt: serverTimestamp() });
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'entries/update-failed', message: 'Güncellenemedi.' } };
  }
}

export async function deleteOwnEntry(db: Firestore, entryId: string): Promise<ServiceResult<null>> {
  try {
    await deleteDoc(doc(db, COLLECTIONS.ENTRIES, entryId));
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'entries/delete-failed', message: 'Silinemedi.' } };
  }
}

export async function incrementLike(db: Firestore, entryId: string, delta: 1 | -1): Promise<ServiceResult<null>> {
  try {
    await updateDoc(doc(db, COLLECTIONS.ENTRIES, entryId), { likeCount: increment(delta) });
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: { code: 'entries/like-failed', message: 'Beğeni işlemi başarısız.' } };
  }
}
```

- [ ] **Step 21.2: Commit**

```bash
git add src/services/entries.service.ts
git commit -m "feat(entries): CRUD operations"
```

---

### Task 22: Search tokens Cloud Function

**Files:**
- Create: `functions/src/onEntryCreate.ts`, `functions/src/index.ts`

- [ ] **Step 22.1: `functions/src/onEntryCreate.ts`**

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';

function generateTokens(text: string): string[] {
  const normalized = text.toLocaleLowerCase('tr-TR').trim();
  const tokens = new Set<string>();

  // Kelime token'ları
  for (const word of normalized.split(/\s+/)) {
    if (word.length >= 2) tokens.add(word);
    // Prefix (autocomplete için)
    for (let i = 2; i <= Math.min(word.length, 10); i++) {
      tokens.add(word.slice(0, i));
    }
  }

  return [...tokens];
}

export const onEntryCreate = onDocumentCreated('entries/{entryId}', async (event) => {
  const data = event.data?.data();
  if (!data) return;

  const tokens = generateTokens(`${data.word} ${data.meaning} ${data.exampleSentence}`);
  await getFirestore().doc(`entries/${event.params.entryId}`).update({ searchTokens: tokens });
});
```

- [ ] **Step 22.2: `functions/src/index.ts`**

```typescript
export { onEntryCreate } from './onEntryCreate';
```

- [ ] **Step 22.3: Commit**

```bash
git add functions/src/
git commit -m "feat(functions): searchTokens generation on entry create"
```

---

### Task 23: EntryForm component

**Files:**
- Create: `src/components/EntryForm.ts`, `src/pages/ContributePage.ts`

- [ ] **Step 23.1: `src/components/EntryForm.ts`**

```typescript
import { db, auth } from '../config/firebase';
import { createEntry } from '../services/entries.service';
import { listRegions } from '../services/regions.service';
import { validateEntry } from '../utils/validation';
import { sanitizeText } from '../utils/sanitize';
import type { EntryType, Region } from '../types/models';

export async function renderEntryForm(container: HTMLElement): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    container.innerHTML = '<p>Katkıda bulunmak için giriş yapmalısınız.</p>';
    return;
  }

  const regionsResult = await listRegions(db);
  if (!regionsResult.ok) {
    container.innerHTML = `<p class="error">${regionsResult.error.message}</p>`;
    return;
  }
  const regions = regionsResult.data;

  container.innerHTML = `
    <form class="entry-form" novalidate>
      <h2>Yeni Kelime / Deyim Ekle</h2>

      <label class="form-field">
        <span>Tür *</span>
        <select name="type" required>
          <option value="kelime">Kelime</option>
          <option value="deyim">Deyim</option>
          <option value="atasözü">Atasözü</option>
        </select>
      </label>

      <label class="form-field">
        <span>Kelime / Deyim *</span>
        <input name="word" required maxlength="100" />
        <small class="char-counter">0 / 100</small>
      </label>

      <label class="form-field">
        <span>Anlam *</span>
        <textarea name="meaning" required maxlength="500" rows="3"></textarea>
        <small class="char-counter">0 / 500</small>
      </label>

      <label class="form-field">
        <span>Örnek Cümle</span>
        <textarea name="exampleSentence" maxlength="500" rows="2"></textarea>
        <small class="char-counter">0 / 500</small>
      </label>

      <label class="form-field">
        <span>İl *</span>
        <select name="regionId" required>
          <option value="">Seçin...</option>
          ${regions.map((r: Region) => `<option value="${r.id}">${r.name} (${r.parentRegion})</option>`).join('')}
        </select>
      </label>

      <p class="form-error" role="alert" hidden></p>
      <button type="submit" class="btn-primary">Gönder</button>
    </form>
  `;

  const form = container.querySelector<HTMLFormElement>('.entry-form')!;
  const errorEl = container.querySelector<HTMLParagraphElement>('.form-error')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('button[type=submit]')!;

  // Karakter sayaçları
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[maxlength]').forEach((input) => {
    const counter = input.parentElement!.querySelector('.char-counter')!;
    input.addEventListener('input', () => { counter.textContent = `${input.value.length} / ${input.maxLength}`; });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;

    const fd = new FormData(form);
    const input = {
      type: String(fd.get('type')) as EntryType,
      word: sanitizeText(String(fd.get('word') ?? '')),
      meaning: sanitizeText(String(fd.get('meaning') ?? '')),
      exampleSentence: sanitizeText(String(fd.get('exampleSentence') ?? '')),
      regionId: String(fd.get('regionId') ?? ''),
    };

    const validation = validateEntry(input);
    if (!validation.ok) {
      errorEl.textContent = validation.errors.map((er) => er.message).join(' ');
      errorEl.hidden = false;
      submitBtn.disabled = false;
      return;
    }

    const result = await createEntry(db, {
      ...input,
      contributorId: user.uid,
      contributorName: user.displayName ?? user.email ?? 'Anonim',
    });

    if (result.ok) {
      form.reset();
      errorEl.classList.add('success');
      errorEl.textContent = '✓ Kayıt eklendi! Haritadan görebilirsiniz.';
      errorEl.hidden = false;
    } else {
      errorEl.textContent = result.error.message;
      errorEl.hidden = false;
    }
    submitBtn.disabled = false;
  });
}
```

- [ ] **Step 23.2: `src/pages/ContributePage.ts`**

```typescript
import { renderEntryForm } from '../components/EntryForm';

export async function renderContributePage(container: HTMLElement): Promise<void> {
  container.innerHTML = '<div class="page-container"></div>';
  await renderEntryForm(container.querySelector<HTMLDivElement>('.page-container')!);
}
```

- [ ] **Step 23.3: `src/styles/components/form.css`**

```css
.page-container { max-width: 640px; margin: var(--space-6) auto; padding: 0 var(--space-5); }
.entry-form { background: var(--color-surface); border-radius: var(--radius-lg); padding: var(--space-6); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: var(--space-4); }
.entry-form h2 { margin-bottom: var(--space-2); }
.form-field { display: flex; flex-direction: column; gap: var(--space-1); }
.form-field span { font-size: 0.875rem; color: var(--color-muted); font-weight: 500; }
.char-counter { font-size: 0.75rem; color: var(--color-muted); align-self: flex-end; }
.form-error { color: var(--color-danger); font-size: 0.875rem; }
.form-error.success { color: var(--color-success); }
```

- [ ] **Step 23.4: `src/main.ts`'a contribute route ekle**

```typescript
if (page === 'contribute') {
  const { renderContributePage } = await import('./pages/ContributePage');
  await renderContributePage(slot);
}
```

- [ ] **Step 23.5: Test et — kayıt ekle, haritada göründüğünü doğrula**

- [ ] **Step 23.6: Commit**

```bash
git add .
git commit -m "feat(contribute): entry form ve sayfası"
```

---

### Task 24: Seed ~80 örnek entry

**Files:**
- Modify: `scripts/seed.ts`

- [ ] **Step 24.1: `scripts/seed-entries.ts` (yeni dosya)**

```typescript
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
const app = initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
const db = getFirestore(app);

const SEED_USER_ID = 'seed@system.local';

interface SeedEntry {
  word: string; type: 'kelime' | 'deyim' | 'atasözü';
  meaning: string; exampleSentence: string; plateCode: string;
}

const ENTRIES: SeedEntry[] = [
  { word: 'paldum', type: 'kelime', meaning: 'Ağaç kütüğü, tomruk.', exampleSentence: 'Paldumu baltayla yardı.', plateCode: '53' },
  { word: 'höllük', type: 'kelime', meaning: 'Vadi, dere yatağı.', exampleSentence: 'Höllüğe doğru indik.', plateCode: '61' },
  // ... (her bölgeden 8-12 entry ekleyin, toplam ~80)
  { word: 'eşek şakası', type: 'deyim', meaning: 'Abartılı, inandırıcı olmayan şaka.', exampleSentence: 'Bu eşek şakası mı?', plateCode: '34' },
  { word: 'hamdolsun', type: 'kelime', meaning: 'Şükürler olsun.', exampleSentence: 'Hamdolsun bugün de sağ salim.', plateCode: '06' },
];

async function seedEntries(): Promise<void> {
  const batch = db.batch();
  let count = 0;

  for (const entry of ENTRIES) {
    const regionRef = db.collection('regions').doc(entry.plateCode);
    const regionSnap = await regionRef.get();
    if (!regionSnap.exists) {
      console.warn(`Bölge bulunamadı: ${entry.plateCode}`);
      continue;
    }
    const regionData = regionSnap.data()!;

    const ref = db.collection('entries').doc();
    batch.set(ref, {
      word: entry.word,
      type: entry.type,
      meaning: entry.meaning,
      exampleSentence: entry.exampleSentence,
      regionId: entry.plateCode,
      contributorId: SEED_USER_ID,
      contributorName: 'Kültürel Kaynak',
      status: 'active',
      removedReason: null,
      removedBy: null,
      removedAt: null,
      likeCount: 0,
      searchTokens: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    count++;
  }

  await batch.commit();
  console.log(`✓ ${count} örnek entry yüklendi (${regionData?.name ?? '?'})`);
}

seedEntries().catch((err: unknown) => { console.error(err); process.exit(1); });
```

> **Not:** Gerçek seed verisi elle araştırılarak eklenmeli. TDK Yöresel Ağız Sözlüğü, Türkçe Sözlük'ten derlenir.

- [ ] **Step 24.2: Seed'i çalıştır**

```bash
npm run seed:entries
```

- [ ] **Step 24.3: Commit**

```bash
git add scripts/seed-entries.ts
git commit -m "feat(seed): ~80 örnek entry seed script"
```

---

## Faz 5 — Arama

### Task 25: Search service

**Files:**
- Modify: `src/services/entries.service.ts`

- [ ] **Step 25.1: `searchEntries` fonksiyonu ekle**

```typescript
import { query, where, orderBy, limit, getDocs, collection } from 'firebase/firestore';

export async function searchEntries(
  db: Firestore, query_text: string, max = 30,
): Promise<ServiceResult<Entry[]>> {
  const tokens = query_text.toLocaleLowerCase('tr-TR').split(/\s+/).filter((t) => t.length >= 2);
  if (tokens.length === 0) return { ok: true, data: [] };

  try {
    const q = query(
      collection(db, COLLECTIONS.ENTRIES),
      where('status', '==', 'active'),
      where('searchTokens', 'array-contains-any', tokens.slice(0, 10)),
      orderBy('createdAt', 'desc'),
      limit(max),
    );
    const snap = await getDocs(q);
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry) };
  } catch {
    return { ok: false, error: { code: 'entries/search-failed', message: 'Arama başarısız.' } };
  }
}
```

- [ ] **Step 25.2: Commit**

```bash
git add src/services/entries.service.ts
git commit -m "feat(search): full-text search with tokens"
```

---

### Task 26: SearchBar component

**Files:**
- Create: `src/components/SearchBar.ts`

- [ ] **Step 26.1: Arama component'i**

```typescript
import { db } from '../config/firebase';
import { searchEntries } from '../services/entries.service';
import { renderEntryCard } from './EntryCard';
import type { Entry } from '../types/models';

export function renderSearchBar(container: HTMLElement, onResults: (entries: Entry[]) => void): void {
  container.innerHTML = `
    <div class="search-bar">
      <input type="search" placeholder="Kelime veya anlam ara..." aria-label="Arama" />
      <div class="search-results" hidden></div>
    </div>
  `;

  const input = container.querySelector<HTMLInputElement>('input')!;
  const results = container.querySelector<HTMLDivElement>('.search-results')!;
  let debounceTimer: number | undefined;

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(async () => {
      const q = input.value.trim();
      if (q.length < 2) {
        results.hidden = true;
        onResults([]);
        return;
      }
      const result = await searchEntries(db, q);
      if (result.ok) {
        results.innerHTML = '';
        result.data.forEach((entry) => results.appendChild(renderEntryCard(entry)));
        results.hidden = result.data.length === 0;
        onResults(result.data);
      } else {
        results.hidden = true;
      }
    }, 300);
  });
}
```

- [ ] **Step 26.2: `src/styles/components/search.css`**

```css
.search-bar { position: relative; }
.search-bar input { padding-left: var(--space-5); }
.search-results {
  position: absolute; top: 100%; left: 0; right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
  margin-top: var(--space-2);
  max-height: 400px;
  overflow-y: auto;
  z-index: 50;
  padding: var(--space-2);
  display: flex; flex-direction: column; gap: var(--space-2);
}
```

- [ ] **Step 26.3: HomePage'e SearchBar ekle**

`HomePage`'in panel kısmının üstüne SearchBar ekle:

```typescript
import { renderSearchBar } from '../components/SearchBar';

// HomePage içinde, panel HTML'ine ekle:
container.querySelector<HTMLElement>('.entries-panel')!.insertAdjacentHTML(
  'afterbegin',
  '<div id="search-slot" style="margin-bottom: var(--space-4)"></div>'
);
renderSearchBar(
  document.getElementById('search-slot')!,
  (entries) => {
    if (entries.length === 0) {
      // boş state veya bölge listesi gösterilebilir
    }
  }
);
```

- [ ] **Step 26.4: Test et — "paldum" arat**

- [ ] **Step 26.5: Commit**

```bash
git add .
git commit -m "feat(search): SearchBar with full-text search"
```

---

## Faz 6 — Moderasyon

### Task 27: Reports service

**Files:**
- Create: `src/services/reports.service.ts`

- [ ] **Step 27.1: Service**

```typescript
import { addDoc, collection, getDocs, query, where, orderBy, serverTimestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import type { Report, ServiceResult } from '../types/models';

export async function createReport(
  db: Firestore, entryId: string, reporterId: string, reason: string,
): Promise<ServiceResult<string>> {
  try {
    const ref = await addDoc(collection(db, COLLECTIONS.REPORTS), {
      entryId, reporterId, reason,
      status: 'open',
      resolvedBy: null,
      createdAt: serverTimestamp(),
    });
    return { ok: true, data: ref.id };
  } catch {
    return { ok: false, error: { code: 'reports/create-failed', message: 'Rapor gönderilemedi.' } };
  }
}

export async function listOpenReports(db: Firestore): Promise<ServiceResult<Report[]>> {
  try {
    const snap = await getDocs(query(
      collection(db, COLLECTIONS.REPORTS),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
    ));
    return { ok: true, data: snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Report) };
  } catch {
    return { ok: false, error: { code: 'reports/list-failed', message: 'Raporlar yüklenemedi.' } };
  }
}
```

- [ ] **Step 27.2: Commit**

```bash
git add src/services/reports.service.ts
git commit -m "feat(reports): report service"
```

---

### Task 28: ReportButton component

**Files:**
- Create: `src/components/ReportButton.ts`

- [ ] **Step 28.1: Component**

```typescript
import { auth, db } from '../config/firebase';
import { createReport } from '../services/reports.service';
import { showAuthModal } from './AuthModal';

export function renderReportButton(container: HTMLElement, entryId: string): void {
  const button = document.createElement('button');
  button.className = 'btn-secondary report-btn';
  button.textContent = 'Bildir';

  button.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      showAuthModal(() => {});
      return;
    }
    const reason = window.prompt('Bildirim nedeni:');
    if (!reason?.trim()) return;
    const result = await createReport(db, entryId, user.uid, reason.trim());
    if (result.ok) {
      window.alert('Bildiriminiz alındı. Teşekkürler.');
    } else {
      window.alert(result.error.message);
    }
  });

  container.appendChild(button);
}
```

- [ ] **Step 28.2: Commit**

```bash
git add src/components/ReportButton.ts
git commit -m "feat(report): ReportButton component"
```

---

### Task 29: Moderation service + Cloud Function

**Files:**
- Create: `src/services/moderation.service.ts`, `functions/src/adminActions.ts`

- [ ] **Step 29.1: `src/services/moderation.service.ts` (client tarafı)**

```typescript
import { doc, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/app';

export async function removeEntryRemote(
  db: Firestore, entryId: string, reason: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const fn = httpsCallable(getFunctions(), 'moderateEntry');
    const result = await fn({ entryId, action: 'remove', reason });
    return { ok: result.data === true };
  } catch {
    return { ok: false, error: 'İşlem başarısız.' };
  }
}
```

- [ ] **Step 29.2: `functions/src/adminActions.ts`**

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

export const moderateEntry = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Giriş gerekli.');

  const db = getFirestore();
  const userDoc = await db.doc(`users/${request.auth.uid}`).get();
  const role = userDoc.data()?.role;
  if (role !== 'moderator' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'Yetkisiz.');
  }

  const { entryId, action, reason } = request.data as { entryId: string; action: string; reason: string };

  return db.runTransaction(async (tx) => {
    const entryRef = db.doc(`entries/${entryId}`);
    const entrySnap = await tx.get(entryRef);
    if (!entrySnap.exists) throw new HttpsError('not-found', 'Kayıt yok.');

    const prevValue = entrySnap.data();
    const updates: Record<string, unknown> = {};

    if (action === 'remove') {
      updates.status = 'removed';
      updates.removedReason = reason;
      updates.removedBy = request.auth!.uid;
      updates.removedAt = new Date();
    } else if (action === 'restore') {
      updates.status = 'active';
      updates.removedReason = null;
      updates.removedBy = null;
      updates.removedAt = null;
    } else {
      throw new HttpsError('invalid-argument', 'Geçersiz aksiyon.');
    }

    tx.update(entryRef, updates);
    tx.create(db.collection('moderationLog').doc(), {
      entryId,
      moderatorId: request.auth!.uid,
      action,
      reason,
      prevValue,
      createdAt: new Date(),
    });

    return true;
  });
});
```

- [ ] **Step 29.3: `functions/src/index.ts`'e ekle**

```typescript
export { onEntryCreate } from './onEntryCreate';
export { moderateEntry } from './adminActions';
```

- [ ] **Step 29.4: Commit**

```bash
git add .
git commit -m "feat(moderation): remote moderation via Cloud Function with audit log"
```

---

### Task 30: ModerationPage

**Files:**
- Create: `src/pages/ModerationPage.ts`

- [ ] **Step 30.1: Sayfa**

```typescript
import { auth, db } from '../config/firebase';
import { listOpenReports } from '../services/reports.service';
import { removeEntryRemote } from '../services/moderation.service';
import { getProfile } from '../services/auth.service';
import type { Report, UserProfile } from '../types/models';

export async function renderModerationPage(container: HTMLElement): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    container.innerHTML = '<p>Yetkisiz. Giriş yapın.</p>';
    return;
  }

  const profileResult = await getProfile(db, user.uid);
  if (!profileResult.ok || !profileResult.data || !['moderator', 'admin'].includes(profileResult.data.role)) {
    container.innerHTML = '<p>Bu sayfaya erişim yetkiniz yok.</p>';
    return;
  }

  container.innerHTML = `
    <div class="page-container">
      <h2>Moderasyon Paneli</h2>
      <div id="reports-list"></div>
    </div>
  `;

  const listEl = container.querySelector<HTMLDivElement>('#reports-list')!;
  await loadReports(listEl, profileResult.data);
}

async function loadReports(target: HTMLElement, _profile: UserProfile): Promise<void> {
  const result = await listOpenReports(db);
  if (!result.ok || result.data.length === 0) {
    target.innerHTML = '<p>Açık rapor yok.</p>';
    return;
  }

  target.innerHTML = '';
  for (const report of result.data) {
    const card = document.createElement('article');
    card.className = 'report-card';
    card.innerHTML = `
      <p><strong>Kayıt:</strong> ${report.entryId}</p>
      <p><strong>Sebep:</strong> ${report.reason}</p>
      <button class="btn-primary" data-action="remove">Kaldır</button>
      <button class="btn-secondary" data-action="dismiss">Reddet</button>
    `;
    card.querySelector<HTMLButtonElement>('[data-action=remove]')!.addEventListener('click', async () => {
      await removeEntryRemote(db, report.entryId, report.reason);
      card.remove();
    });
    target.appendChild(card);
  }
}
```

- [ ] **Step 30.2: `main.ts`'a ekle**

```typescript
if (page === 'moderation') {
  const { renderModerationPage } = await import('./pages/ModerationPage');
  await renderModerationPage(slot);
}
```

- [ ] **Step 30.3: Moderator rolü ata (manuel)**

Firebase Console → Firestore → `users/{uid}` → `role: "moderator"`.

- [ ] **Step 30.4: Test et**

- [ ] **Step 30.5: Commit**

```bash
git add .
git commit -m "feat(moderation): ModerationPage for moderators"
```

---

### Task 31: Firestore rules unit test

**Files:**
- Create: `tests/rules/entries.test.ts`

- [ ] **Step 31.1: Test kurulumu**

```bash
npm install -D @firebase/rules-unit-testing
```

- [ ] **Step 31.2: `tests/rules/entries.test.ts`**

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { doc, setDoc, getDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-yoresel',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf-8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
});

describe('entries rules', () => {
  it('anon okuyamaz', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'entries/e1'), {
        word: 'test', meaning: 'test', exampleSentence: '',
        type: 'kelime', regionId: '34', contributorId: 'user1',
        contributorName: 'u', status: 'active', likeCount: 0,
        searchTokens: [], createdAt: new Date(), updatedAt: new Date(),
        removedReason: null, removedBy: null, removedAt: null,
      });
    });
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'entries/e1')));
  });

  it('giriş yapmış kullanıcı oluşturabilir', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertSucceeds(setDoc(doc(ctx.firestore(), 'entries/e2'), {
      word: 'test', meaning: 'test', exampleSentence: '',
      type: 'kelime', regionId: '34', contributorId: 'user1',
      contributorName: 'u', status: 'active', likeCount: 0,
      searchTokens: [], createdAt: new Date(), updatedAt: new Date(),
      removedReason: null, removedBy: null, removedAt: null,
    }));
  });

  it('başka kullanıcı oluşturamaz (contributorId != uid)', async () => {
    const ctx = env.authenticatedContext('user2');
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/e3'), {
      word: 'test', meaning: 'test', exampleSentence: '',
      type: 'kelime', regionId: '34', contributorId: 'user1',
      contributorName: 'u', status: 'active', likeCount: 0,
      searchTokens: [], createdAt: new Date(), updatedAt: new Date(),
      removedReason: null, removedBy: null, removedAt: null,
    }));
  });
});
```

- [ ] **Step 31.3: Testi çalıştır**

```bash
firebase emulators:exec --only firestore 'npx vitest run tests/rules'
```

- [ ] **Step 31.4: Commit**

```bash
git add tests/rules/
git commit -m "test(rules): entries security rules unit tests"
```

---

## Faz 7 — Polish

### Task 32: Mobil responsive iyileştirmeler

**Files:**
- Modify: `src/styles/components/*.css`

- [ ] **Step 32.1: Tüm component CSS'lerinde mobil breakpoint'leri kontrol et**

375px, 768px, 1024px için test et. Header, harita panel, form responsive olmalı.

- [ ] **Step 32.2: Dokunmatik hedefler ≥ 44px**

```css
button { min-height: 44px; min-width: 44px; }
```

- [ ] **Step 32.3: Lighthouse mobil raporu al**

```bash
npm run build
npm run preview &
npx lighthouse http://localhost:4173 --preset=mobile --view
```

Hedef: Performance ≥ 90, Accessibility ≥ 95.

- [ ] **Step 32.4: Commit**

```bash
git add .
git commit -m "polish: mobile responsive ve Lighthouse iyileştirmesi"
```

---

### Task 33: SEO meta tags

**Files:**
- Modify: `index.html`

- [ ] **Step 33.1: Open Graph, Twitter Cards ekle**

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Türkiye'nin 81 iline ait yöresel kelimeleri, deyimleri ve atasözlerini harita üzerinde keşfedin ve katkıda bulunun." />
  <meta name="theme-color" content="#b8492c" />

  <meta property="og:title" content="Yöresel Kelimeler Haritası" />
  <meta property="og:description" content="Türkiye'nin yöresel kelime ve deyimlerini harita üzerinde keşfedin." />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="tr_TR" />
  <meta property="og:image" content="/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Yöresel Kelimeler Haritası" />
  <meta name="twitter:description" content="Türkiye'nin yöresel kelime ve deyimlerini harita üzerinde keşfedin." />

  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <title>Yöresel Kelimeler Haritası</title>
</head>
```

- [ ] **Step 33.2: `og-image.png` ekle (1200x630)**

`public/og-image.png` olarak statik görsel ekle (tercihen 1200×630, kültürel görselle).

- [ ] **Step 33.3: Commit**

```bash
git add index.html public/
git commit -m "polish: SEO meta tags ve OG image"
```

---

### Task 34: README

**Files:**
- Create: `README.md`

- [ ] **Step 34.1: README yaz**

```markdown
# Yöresel Kelimeler Haritası

Türkiye'nin 81 iline ait yöresel kelime, deyim ve atasözlerini harita üzerinde topluluk katkısıyla büyüyen kültürel arşiv.

## Kurulum

1. Bağımlılıklar: `npm install`
2. Firebase projesi oluştur, web app config'i `.env.local`'e ekle
3. Service account JSON'u indir, `.env.local`'e `FIREBASE_SERVICE_ACCOUNT_JSON` olarak ekle
4. Emulator'leri başlat: `firebase emulators:start`
5. Geliştirme: `npm run dev`

## Seed

- `npm run seed:regions` — 81 il
- `npm run seed:entries` — ~80 örnek kelime/deyim

## Deploy

- `firebase deploy` — hosting + firestore rules + functions

## Mimari

Detaylar için `docs/superpowers/specs/2026-06-28-yoresel-kelimeler-design.md`.

## Lisans

MIT. Seed veriler TDK Yöresel Ağız Sözlüğü ve kültürel kaynaklardan derlenmiştir.
```

- [ ] **Step 34.2: Commit**

```bash
git add README.md
git commit -m "docs: README"
```

---

## Faz 8 — Deploy

### Task 35: Production build ve deploy

**Steps:**

- [ ] **Step 35.1: Production build**

```bash
npm run build
```

`dist/` klasörü oluşmalı.

- [ ] **Step 35.2: Console'da HTTP referrer kısıtlaması ekle**

Firebase Console → Project Settings → API keys → Browser key → HTTP referrers:
- `localhost:*`
- `*.web.app`
- `*.firebaseapp.com`

- [ ] **Step 35.3: Functions deploy**

```bash
firebase deploy --only functions
```

- [ ] **Step 35.4: Firestore rules + indexes deploy**

```bash
firebase deploy --only firestore
```

- [ ] **Step 35.5: Hosting deploy**

```bash
firebase deploy --only hosting
```

- [ ] **Step 35.6: Production URL'de uçtan uca test**

https://yoresel-kelimeler.web.app adresinde:
- Kayıt ol / giriş yap
- Yeni entry ekle
- Haritada gör
- Arama yap
- (moderator hesabıyla) kaldır

- [ ] **Step 35.7: Tag ve final commit**

```bash
git tag v0.1.0
git commit --allow-empty -m "release: v0.1.0 MVP launch"
git push origin develop main --tags
```

---

## Definition of Done — Son Kontrol

- [ ] Tüm 35 görev tamamlandı
- [ ] `npm run build` hatasız
- [ ] Lighthouse mobil: P ≥ 90, A ≥ 95
- [ ] Production URL'de uçtan uca akış çalışıyor
- [ ] README güncel
- [ ] GitHub'da `v0.1.0` tag'i var
- [ ] 81 il haritada görünüyor
- [ ] ~80 seed entry haritada/listede görünüyor
- [ ] Moderator kaldırma → haritadan düşme çalışıyor

---

**Plan tamamlandı.** Tahmini süre: 8-12 saat (deneyimli geliştirici). Her commit çalışan bir state bırakır; herhangi bir commit'te durup inceleme yapılabilir.