/**
 * Pure badge derivation. Given a snapshot of a user's contribution stats,
 * returns the list of earned badges. Kept side-effect free so it is trivially
 * unit-testable and can run on either the authed user or a public profile.
 */
export interface BadgeInput {
  submission_count: number;
  reputation: number;
  verification_count: number;
  top_vote_score: number;
}

export interface Badge {
  slug: string;
  label: string;
  description: string;
}

export function deriveBadges(input: BadgeInput): Badge[] {
  const badges: Badge[] = [];
  if (input.submission_count >= 1) {
    badges.push({
      slug: 'first_submission',
      label: 'First submission',
      description: 'Shared their first setting with the community.',
    });
  }
  if (input.submission_count >= 5) {
    badges.push({
      slug: 'contributor',
      label: 'Contributor',
      description: 'Published five or more settings.',
    });
  }
  if (input.reputation >= 50) {
    badges.push({
      slug: 'trusted',
      label: 'Trusted',
      description: 'Earned a reputation of 50 or more from community votes.',
    });
  }
  if (input.verification_count >= 10) {
    badges.push({
      slug: 'verifier',
      label: 'Verifier',
      description: 'Reported results on ten or more settings.',
    });
  }
  if (input.top_vote_score >= 25) {
    badges.push({
      slug: 'popular',
      label: 'Popular',
      description: 'Authored a setting with 25 or more upvotes.',
    });
  }
  return badges;
}
