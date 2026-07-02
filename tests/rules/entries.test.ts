import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { doc, setDoc, getDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

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
  // Seed reference data the rules now depend on: a real region (exists check)
  // and user profiles (role lookups + displayName anti-spoofing).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    await setDoc(doc(fs, 'regions/34'), { name: 'İstanbul', plateCode: '34', parentRegion: 'Marmara' });
    await setDoc(doc(fs, 'users/user1'), {
      uid: 'user1', displayName: 'u', email: 'u1@example.com', role: 'user',
      contributionCount: 0, approvedCount: 0, removedCount: 0,
    });
    await setDoc(doc(fs, 'users/user2'), {
      uid: 'user2', displayName: 'u2', email: 'u2@example.com', role: 'user',
      contributionCount: 0, approvedCount: 0, removedCount: 0,
    });
  });
});

function validEntry(uid: string, contributorName: string): Record<string, unknown> {
  return {
    word: 'test', meaning: 'test anlam', exampleSentence: '',
    type: 'kelime', regionId: '34', slug: 'test-slug',
    contributorId: uid, contributorName, status: 'active', likeCount: 0,
    searchTokens: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    removedReason: null, removedBy: null, removedAt: null,
  };
}

async function seedEntry(id: string, data: Record<string, unknown>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `entries/${id}`), {
      word: 'w', meaning: 'm', exampleSentence: '', type: 'kelime', regionId: '34',
      slug: 's', contributorId: 'user1', contributorName: 'u', status: 'active',
      likeCount: 0, searchTokens: [], createdAt: new Date(), updatedAt: new Date(),
      removedReason: null, removedBy: null, removedAt: null, ...data,
    });
  });
}

describe('entries rules', () => {
  it('anon aktif kaydı okuyabilir', async () => {
    await seedEntry('e1', { status: 'active' });
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'entries/e1')));
  });

  it('anon kaldırılmış kaydı okuyamaz', async () => {
    await seedEntry('e1r', { status: 'removed' });
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'entries/e1r')));
  });

  it('giriş yapmış kullanıcı geçerli kayıt oluşturabilir', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertSucceeds(setDoc(doc(ctx.firestore(), 'entries/e2'), validEntry('user1', 'u')));
  });

  it('başka kullanıcı oluşturamaz (contributorId != uid)', async () => {
    const ctx = env.authenticatedContext('user2');
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/e3'), validEntry('user1', 'u')));
  });

  it('sahte contributorName (kimlik taklidi) reddedilir', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/e4'),
      validEntry('user1', 'Site Yöneticisi (SAHTE)')));
  });

  it('sahte createdAt ile oluşturma reddedilir', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/e5'),
      { ...validEntry('user1', 'u'), createdAt: new Date('9999-12-31') }));
  });

  it('var olmayan regionId ile oluşturma reddedilir', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/e6'),
      { ...validEntry('user1', 'u'), regionId: 'BU_IL_YOK_9999' }));
  });

  it('açılı parantez içeren içerik reddedilir', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/e7'),
      { ...validEntry('user1', 'u'), word: '<img onerror=x>' }));
  });

  it('önceden doldurulmuş searchTokens reddedilir', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/e8'),
      { ...validEntry('user1', 'u'), searchTokens: ['hile'] }));
  });

  it('owner kendi kaydını silebilir', async () => {
    await seedEntry('owned', { contributorId: 'user1' });
    const ctx = env.authenticatedContext('user1');
    await assertSucceeds(deleteDoc(doc(ctx.firestore(), 'entries/owned')));
  });

  it('başkasının kaydı silinemez', async () => {
    await seedEntry('owned2', { contributorId: 'user1' });
    const ctx = env.authenticatedContext('user2');
    await assertFails(deleteDoc(doc(ctx.firestore(), 'entries/owned2')));
  });

  it('likeCount doğrudan yazılamaz', async () => {
    await seedEntry('le', { contributorId: 'user1', likeCount: 5 });
    const ctx = env.authenticatedContext('user1');
    await assertFails(updateDoc(doc(ctx.firestore(), 'entries/le'), { likeCount: 999 }));
  });
});

describe('likes rules', () => {
  it('kullanıcı bir kez beğenebilir, ikinci kez beğenemez', async () => {
    await seedEntry('lk', {});
    const ctx = env.authenticatedContext('user1');
    await assertSucceeds(setDoc(doc(ctx.firestore(), 'entries/lk/likes/user1'),
      { createdAt: serverTimestamp() }));
    // İkinci yazım (zaten var) reddedilir.
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/lk/likes/user1'),
      { createdAt: serverTimestamp() }));
  });

  it('başkası adına beğeni dokümanı oluşturulamaz', async () => {
    await seedEntry('lk2', {});
    const ctx = env.authenticatedContext('user2');
    await assertFails(setDoc(doc(ctx.firestore(), 'entries/lk2/likes/user1'),
      { createdAt: serverTimestamp() }));
  });
});

describe('users rules', () => {
  it('auth\'suz kullanıcı dokümanı okunamaz (PII sızıntısı)', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'users/user1')));
  });

  it('kullanıcı kendi dokümanını okuyabilir', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users/user1')));
  });

  it('kullanıcı başkasının dokümanını okuyamaz', async () => {
    const ctx = env.authenticatedContext('user2');
    await assertFails(getDoc(doc(ctx.firestore(), 'users/user1')));
  });
});

describe('comments rules', () => {
  async function seedComment(): Promise<void> {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'comments/c1'), {
        entryId: 'e1', authorId: 'user1', authorName: 'u', text: 'merhaba',
        createdAt: new Date(),
      });
    });
  }

  it('yalnızca text güncellenebilir', async () => {
    await seedComment();
    const ctx = env.authenticatedContext('user1');
    await assertSucceeds(updateDoc(doc(ctx.firestore(), 'comments/c1'), { text: 'güncellendi' }));
  });

  it('text dışında alan güncellenemez', async () => {
    await seedComment();
    const ctx = env.authenticatedContext('user1');
    await assertFails(updateDoc(doc(ctx.firestore(), 'comments/c1'), { authorName: 'sahte' }));
  });

  it('sahte authorName ile yorum oluşturulamaz', async () => {
    const ctx = env.authenticatedContext('user1');
    await assertFails(setDoc(doc(ctx.firestore(), 'comments/c2'), {
      entryId: 'e1', authorId: 'user1', authorName: 'Site Yöneticisi (SAHTE)',
      text: 'merhaba', createdAt: serverTimestamp(),
    }));
  });
});
