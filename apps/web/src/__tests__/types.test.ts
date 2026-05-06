/**
 * Type-level and structural unit tests for shared frontend types.
 * These are compile-time guarantees expressed as runtime checks.
 */

import type { User, Friend, Message, Chat, ChatRole, UserStatus, AppTheme, PollData, ReactionGroup, ReplyTo } from '../types';

// ─── ChatRole ─────────────────────────────────────────────────────────────────

describe('ChatRole type values', () => {
  const validRoles: ChatRole[] = ['owner', 'moderator', 'trusted', 'member'];

  it('has exactly 4 roles', () => {
    expect(validRoles).toHaveLength(4);
  });

  it('includes owner', () => expect(validRoles).toContain('owner'));
  it('includes moderator', () => expect(validRoles).toContain('moderator'));
  it('includes trusted', () => expect(validRoles).toContain('trusted'));
  it('includes member', () => expect(validRoles).toContain('member'));
});

// ─── UserStatus ───────────────────────────────────────────────────────────────

describe('UserStatus type values', () => {
  const statuses: UserStatus[] = ['online', 'away', 'dnd', 'offline'];
  it('has 4 statuses', () => expect(statuses).toHaveLength(4));
  statuses.forEach(s => it(`includes ${s}`, () => expect(statuses).toContain(s)));
});

// ─── AppTheme ─────────────────────────────────────────────────────────────────

describe('AppTheme type values', () => {
  const themes: AppTheme[] = ['dark', 'gray', 'light'];
  it('has 3 themes', () => expect(themes).toHaveLength(3));
  themes.forEach(t => it(`includes ${t}`, () => expect(themes).toContain(t)));
});

// ─── Object shape checks ──────────────────────────────────────────────────────

describe('User object shape', () => {
  const user: User = {
    id: 1,
    username: 'alice',
    email: 'alice@test.com',
    role: 'USER',
    avatar_url: null,
    is_banned: false,
    status: 'online',
    theme: 'dark',
  };

  it('has required id field', () => expect(user.id).toBe(1));
  it('has required username field', () => expect(user.username).toBe('alice'));
  it('accepts null avatar_url', () => expect(user.avatar_url).toBeNull());
  it('supports optional friends array', () => {
    const withFriends: User = { ...user, friends: [{ id: 2, username: 'bob', avatar_url: null }] };
    expect(withFriends.friends).toHaveLength(1);
  });
  it('supports all optional style fields', () => {
    const styled: User = {
      ...user,
      profile_bg: 'url(bg.jpg)',
      username_color: '#fff',
      username_anim: 'pulse',
      profile_badge: 'star',
      bubble_color: '#abc',
      social_link: 'https://x.com',
      accent_color: '#f00',
    };
    expect(styled.username_color).toBe('#fff');
  });
});

describe('Friend object shape', () => {
  const friend: Friend = { id: 2, username: 'bob', avatar_url: 'http://img/bob.png' };
  it('has id, username, avatar_url', () => {
    expect(friend.id).toBe(2);
    expect(friend.username).toBe('bob');
    expect(friend.avatar_url).toBeDefined();
  });
});

describe('ReactionGroup shape', () => {
  const r: ReactionGroup = { emoji: '👍', count: 3, users: [1, 2, 3] };
  it('has emoji, count, users', () => {
    expect(r.emoji).toBe('👍');
    expect(r.count).toBe(3);
    expect(r.users).toHaveLength(3);
  });
});

describe('ReplyTo shape', () => {
  const reply: ReplyTo = { id: 10, text: 'original msg', sender_name: 'alice' };
  it('has id, text, sender_name', () => {
    expect(reply.id).toBe(10);
    expect(reply.text).toBe('original msg');
    expect(reply.sender_name).toBe('alice');
  });
});

describe('PollData shape', () => {
  const poll: PollData = {
    id: 1,
    question: 'Best color?',
    options: ['Red', 'Blue', 'Green'],
    votes: { '0': [1, 2], '1': [3] },
    closed: false,
  };
  it('has question and options', () => {
    expect(poll.question).toBe('Best color?');
    expect(poll.options).toHaveLength(3);
  });
  it('votes is a record mapping option index to user arrays', () => {
    expect(poll.votes['0']).toHaveLength(2);
  });
  it('can be marked closed', () => {
    const closed: PollData = { ...poll, closed: true };
    expect(closed.closed).toBe(true);
  });
});
