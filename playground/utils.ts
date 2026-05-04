/**
 * Shared utilities for playground demos.
 */

/* ------------------------------------------------------------------ */
/*  Logging helpers                                                     */
/* ------------------------------------------------------------------ */
export function heading(title: string): void {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(72)}`);
}

export function sub(title: string): void {
  console.log(`\n  ── ${title} ──`);
}

export function pass(msg: string): void {
  console.log(`  ✅ ${msg}`);
}

export function fail(msg: string): void {
  console.log(`  ❌ ${msg}`);
}

export function info(msg: string): void {
  console.log(`  ℹ️  ${msg}`);
}

/* ------------------------------------------------------------------ */
/*  Assertion helpers                                                   */
/* ------------------------------------------------------------------ */
export function assert(condition: boolean, msg: string): asserts condition {
  if (!condition) {
    fail(msg);
    throw new Error(`Assertion failed: ${msg}`);
  }
  pass(msg);
}

export async function assertRejects(fn: () => Promise<unknown>, msg: string): Promise<void> {
  try {
    await fn();
    fail(msg);
  } catch {
    pass(msg);
  }
}

import type { GuantrRuleCondition } from '../src/index';
/* ------------------------------------------------------------------ */
/*  Test helper: type-safe matchRuleCondition wrapper                   */
/*  Avoids `as any` casts in demo files by accepting a plain object.   */
/* ------------------------------------------------------------------ */
import { matchRuleCondition } from '../src/index';

/**
 * Wraps matchRuleCondition so demo code can pass untyped condition
 * objects without requiring `as any` casts.
 */
export function testMatch(model: Record<string, unknown>, condition: GuantrRuleCondition): boolean {
  return matchRuleCondition(model, condition);
}

/* ------------------------------------------------------------------ */
/*  Sample models used across demos                                     */
/* ------------------------------------------------------------------ */

/** A simple post model used in typed demos */
export type Post = {
  id: number;
  title: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  authorId: number;
  tags: string[];
  metadata: {
    views: number;
    featured: boolean;
    category: string;
  };
  comments: Array<{
    id: number;
    userId: number;
    text: string;
    moderated: boolean;
  }>;
};

/** A user model */
export type User = {
  id: number;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  profile: {
    displayName: string;
    avatarUrl: string | null;
  };
  permissions: string[];
};

/** A comment model */
export type Comment = {
  id: number;
  postId: number;
  userId: number;
  text: string;
  flagged: boolean;
  moderated: boolean;
};

/** Application context for blog demos */
export type BlogContext = {
  userId: number;
  userRole: 'admin' | 'editor' | 'viewer';
  isAuthenticated: boolean;
  teamId?: number;
};

/** Make a sample published post */
export function publishedPost(overrides?: Partial<Post>): Post {
  return {
    id: 1,
    title: 'Hello World',
    content: 'This is a published post',
    status: 'published',
    authorId: 1,
    tags: ['news', 'tech', 'typescript'],
    metadata: { views: 100, featured: true, category: 'tech' },
    comments: [
      { id: 1, userId: 2, text: 'Great post!', moderated: true },
      { id: 2, userId: 3, text: 'Spam', moderated: false },
    ],
    ...overrides,
  };
}

/** Make a sample draft post */
export function draftPost(overrides?: Partial<Post>): Post {
  return {
    id: 2,
    title: 'Work in Progress',
    content: 'Still writing...',
    status: 'draft',
    authorId: 2,
    tags: ['draft'],
    metadata: { views: 0, featured: false, category: '' },
    comments: [],
    ...overrides,
  };
}
