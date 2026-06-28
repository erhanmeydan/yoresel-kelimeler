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
