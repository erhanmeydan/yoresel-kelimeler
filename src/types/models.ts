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

export interface RegionWeeklyStat {
  regionId: string;
  regionName: string;
  entryCount: number;
  sampleEntryId: string;
  sampleWord: string;
  sampleMeaning: string;
  updatedAt: Timestamp;
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
  slug: string;
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

export interface Comment {
  id: string;
  entryId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Timestamp;
}

export interface AppError {
  code: string;
  message: string;
  detail?: string;
}

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: AppError };