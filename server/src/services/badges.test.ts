import { describe, expect, it } from 'vitest';
import { deriveBadges } from '../services/badges.js';

describe('deriveBadges', () => {
  it('awards nothing to a brand-new user', () => {
    const badges = deriveBadges({ submission_count: 0, reputation: 0, verification_count: 0, top_vote_score: 0 });
    expect(badges).toEqual([]);
  });

  it('awards first_submission after a single submission', () => {
    const slugs = deriveBadges({ submission_count: 1, reputation: 0, verification_count: 0, top_vote_score: 0 }).map((b) => b.slug);
    expect(slugs).toContain('first_submission');
    expect(slugs).not.toContain('contributor');
  });

  it('awards contributor at five submissions', () => {
    const slugs = deriveBadges({ submission_count: 5, reputation: 0, verification_count: 0, top_vote_score: 0 }).map((b) => b.slug);
    expect(slugs).toContain('first_submission');
    expect(slugs).toContain('contributor');
  });

  it('awards trusted at reputation 50', () => {
    const slugs = deriveBadges({ submission_count: 0, reputation: 50, verification_count: 0, top_vote_score: 0 }).map((b) => b.slug);
    expect(slugs).toContain('trusted');
  });

  it('awards verifier at ten verifications', () => {
    const slugs = deriveBadges({ submission_count: 0, reputation: 0, verification_count: 10, top_vote_score: 0 }).map((b) => b.slug);
    expect(slugs).toContain('verifier');
  });

  it('awards popular when a setting reaches 25 upvotes', () => {
    const slugs = deriveBadges({ submission_count: 1, reputation: 0, verification_count: 0, top_vote_score: 25 }).map((b) => b.slug);
    expect(slugs).toContain('popular');
  });

  it('stacks every badge for a power user', () => {
    const slugs = deriveBadges({ submission_count: 20, reputation: 200, verification_count: 40, top_vote_score: 99 }).map((b) => b.slug);
    expect(slugs).toEqual(['first_submission', 'contributor', 'trusted', 'verifier', 'popular']);
  });
});
