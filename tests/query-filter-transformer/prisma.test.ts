import { execSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createGuantr } from '../../src'
import { prisma } from '../../src/query-filter-transformer/prisma'
import type { Post, PrismaClient, User } from '@prisma/client'
import type { GuantrMeta } from '../../src/types'

let prismaClient: PrismaClient

type MockResourceMap = {
  user: {
    action: 'create' | 'read' | 'update' | 'delete',
    model: User & { posts: Post[] }
  },
  post: {
    action: 'create' | 'read' | 'update' | 'delete',
    model: Post & { author: User }
  }
}

type MockMeta = GuantrMeta<MockResourceMap>

const mockContext = {
  id: 1,
  active: true,
  email: 'alice@example.com',
  name: 'Alice',
  role: 'admin',
} satisfies Omit<MockResourceMap['user']['model'], 'posts'>

beforeAll(async () => {
  execSync('npx --yes prisma db push --schema tests/query-filter-transformer/prisma/schema.prisma')
  prismaClient = new (await import('@prisma/client')).PrismaClient()
  // Ensure the database is in a clean state
  await prismaClient.$executeRaw`PRAGMA foreign_keys=OFF;`
  await prismaClient.$executeRaw`DELETE FROM "Post";`
  await prismaClient.$executeRaw`DELETE FROM "User";`
  await prismaClient.$executeRaw`PRAGMA foreign_keys=ON;`

  await prismaClient.user.createMany({
    data: [
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
      { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user', active: false },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'moderator', active: true },
      { id: 4, name: 'Diana', email: 'diana@example.com', role: 'user', active: true },
      { id: 5, name: 'John', email: 'john@example.com', role: 'user', active: false },
      // Add more mock data here if needed
    ],
  })

  await prismaClient.post.createMany({
    data: [
      { id: 1, title: 'Post 1', content: 'Content 1', published: true, authorId: 1 },
      { id: 2, title: 'Post 2', content: 'Content 2', published: false, authorId: 2 },
      { id: 3, title: 'Post 3', content: 'Content 3', published: true, authorId: 3 },
      { id: 4, title: 'Post 4', content: 'Content 4', published: false, authorId: 4 },
      // Add more mock data here if needed
    ],
  })
})

afterAll(async () => {
  await prismaClient.$disconnect()
  await rm('tests/query-filter-transformer/prisma/dev.db', { force: true })
})

describe('Query transformer - Prisma', () => {
  it('should construct the correct Prisma query for simple equality conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'post',
        condition: { published: ["equals", false] },
        inverted: true
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'post')
    const posts = await prismaClient.post.findMany({ where })

    expect(posts).toEqual([
      { id: 1, title: 'Post 1', content: 'Content 1', published: true, authorId: 1 },
      { id: 3, title: 'Post 3', content: 'Content 3', published: true, authorId: 3 },
    ])
  })

  it('should handle contextual equality conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'user',
        condition: { role: ["equals", "$context.role"] },
        inverted: false,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'user')
    const users = await prismaClient.user.findMany({ where })

    expect(users).toEqual([
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
    ])
  })

  it('should handle nested field equality conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'post',
        condition: { author: { email: ["equals", "bob@example.com"] } },
        inverted: false,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'post')
    const posts = await prismaClient.post.findMany({
      where,
      include: { author: true }
    })

    expect(posts).toEqual([
      { id: 2, title: 'Post 2', content: 'Content 2', published: false, authorId: 2, author: { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user', active: false } },
    ])
  })

  it('should handle inverted conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'user',
        condition: { active: ["equals", false] },
        inverted: true
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'user', 'read')
    const users = await prismaClient.user.findMany({ where })

    expect(users).toEqual([
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'moderator', active: true },
      { id: 4, name: 'Diana', email: 'diana@example.com', role: 'user', active: true },
    ])
  })

  it('should handle multiple conditions with AND/OR logic', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'post',
        condition: { published: ["equals", true], title: ["equals", "Post 1"] },
        inverted: false,
      },
      {
        action: 'read',
        resource: 'post',
        condition: { published: ["equals", false] },
        inverted: false,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'post')
    const posts = await prismaClient.post.findMany({ where })

    expect(posts).toEqual([
      { id: 1, title: 'Post 1', content: 'Content 1', published: true, authorId: 1 },
      { id: 2, title: 'Post 2', content: 'Content 2', published: false, authorId: 2 },
      { id: 4, title: 'Post 4', content: 'Content 4', published: false, authorId: 4 },
    ])
  })

  it('should handle greater than and less than conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'post',
        condition: { id: ["gt", 2] },
        inverted: false,
      },
      {
        action: 'read',
        resource: 'post',
        condition: { id: ["gt", 3] },
        inverted: true,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'post')
    const posts = await prismaClient.post.findMany({ where })

    expect(posts).toEqual([
      { id: 3, title: 'Post 3', content: 'Content 3', published: true, authorId: 3 },
    ])
  })

  it('should handle greater than or equal and less than or equal conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'post',
        condition: { id: ["gte", 2] },
        inverted: false,
      },
      {
        action: 'read',
        resource: 'post',
        condition: { id: ["gte", 4] },
        inverted: true,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'post')
    const posts = await prismaClient.post.findMany({ where })

    expect(posts).toEqual([
      { id: 2, title: 'Post 2', content: 'Content 2', published: false, authorId: 2 },
      { id: 3, title: 'Post 3', content: 'Content 3', published: true, authorId: 3 },
    ])
  })

  it('should handle contains and starts with conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'user',
        condition: { email: ["contains", "example"] },
        inverted: false,
      },
      {
        action: 'read',
        resource: 'user',
        condition: { name: ["startsWith", "A"] },
        inverted: false,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'user')
    const users = await prismaClient.user.findMany({ where })

    expect(users).toEqual([
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
      { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user', active: false },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'moderator', active: true },
      { id: 4, name: 'Diana', email: 'diana@example.com', role: 'user', active: true },
      { id: 5, name: 'John', email: 'john@example.com', role: 'user', active: false },
    ])
  })

  it('should handle ends with condition', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'user',
        condition: { email: ["endsWith", "example.com"] },
        inverted: false,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'user')
    const users = await prismaClient.user.findMany({ where })

    expect(users).toEqual([
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
      { id: 2, name: 'Bob', email: 'bob@example.com', role: 'user', active: false },
      { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'moderator', active: true },
      { id: 4, name: 'Diana', email: 'diana@example.com', role: 'user', active: true },
      { id: 5, name: 'John', email: 'john@example.com', role: 'user', active: false },
    ])
  })

  it('should handle complex nested conditions with AND/OR logic', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'post',
        condition: { author: { role: ["equals", "user"], active: ["equals", true] } },
        inverted: false,
      },
      {
        action: 'read',
        resource: 'post',
        condition: { author: { role: ["equals", "admin"], active: ["equals", true] } },
        inverted: false,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'post')
    const posts = await prismaClient.post.findMany({
      where,
      include: { author: true }
    })

    expect(posts).toEqual([
      { id: 1, title: 'Post 1', content: 'Content 1', published: true, authorId: 1, author: { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true } },
      { id: 4, title: 'Post 4', content: 'Content 4', published: false, authorId: 4, author: { id: 4, name: 'Diana', email: 'diana@example.com', role: 'user', active: true } },
    ])
  })

  it('should handle in conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'post',
        condition: { authorId: ["in", [1, 3, 5]] },
        inverted: false,
      },
      {
        action: 'read',
        resource: 'post',
        condition: { authorId: ["in", [1, 5]] },
        inverted: true,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'post')
    const posts = await prismaClient.post.findMany({ where })

    expect(posts).toEqual([
      { id: 3, title: 'Post 3', content: 'Content 3', published: true, authorId: 3 },
    ])
  })

  // Case insensitive filtering only supported with Postgres and MongoDB
  // https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting#case-insensitive-filtering
  //
  // it('should handle case insensitive conditions', async () => {
  //   const guantr = createGuantr<MockMeta>().withContext(mockContext)
  //   guantr.setPermissions([
  //     {
  //       action: 'read',
  //       resource: 'user',
  //       condition: { name: ["equals", "alice", { caseInsensitive: true }] },
  //       inverted: false,
  //     },
  //   ])

  //   const where = prisma(guantr.relatedPermissionsFor('read', 'user'), guantr.context)
  //   const users = await prismaClient.user.findMany({ where: {
  //     OR: [
  //       { name: { equals: 'alice',  } }
  //     ]
  //   } })

  //   expect(users).toEqual([
  //     { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
  //   ])
  // })

  it('should handle some conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'user',
        condition: { "posts": ["some", { id: ["in", [1, 3, 5]] }] },
        inverted: false,
      },
      {
        action: 'read',
        resource: 'user',
        condition: { "posts": ["some", { id: ["in", [1, 5]] }] },
        inverted: true,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'user')
    const posts = await prismaClient.user.findMany({ where })

    expect(posts).toEqual([
      { id: 3, name: 'Charlie', email: 'charlie@example.com', role: 'moderator', active: true },
    ])
  })

  it('should handle every conditions', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'user',
        condition: { "posts": ["every", { published: ['equals', true] }] },
        inverted: false,
      },
      {
        action: 'read',
        resource: 'user',
        condition: { id: ['in', [3, 5]] },
        inverted: true,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'user')
    const posts = await prismaClient.user.findMany({ where })

    expect(posts).toEqual([
      { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin', active: true },
    ])
  })

  it('should handle array length 0 checking', async () => {
    const guantr = createGuantr<MockMeta>().withContext(mockContext)
    guantr.setPermissions([
      {
        action: 'read',
        resource: 'user',
        condition: { "posts": { length: ['equals', 0] } },
        inverted: false,
      },
    ])

    const where = guantr.queryFilterFor(prisma, 'user')
    const posts = await prismaClient.user.findMany({ where })

    expect(posts).toEqual([
      { id: 5, name: 'John', email: 'john@example.com', role: 'user', active: false },
    ])
  })
})
