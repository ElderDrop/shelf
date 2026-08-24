export interface RecommendationItemFields {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
}

export type RecommendationSeed = RecommendationItemFields;
export type RecommendationCandidate = RecommendationItemFields;

export interface ScoredRecommendation {
  candidate: RecommendationCandidate;
  tagScore: number;
  descBoost: number;
  totalScore: number;
}

export interface CandidateScore {
  tagScore: number;
  descBoost: number;
  totalScore: number;
}

export function buildLibraryTagSet(seeds: RecommendationSeed[]): Set<string> {
  const tags = new Set<string>();
  for (const seed of seeds) {
    for (const tag of seed.tags) {
      tags.add(tag);
    }
  }
  return tags;
}

export function countTaggedLibraryItems(seeds: RecommendationSeed[]): number {
  return seeds.filter((seed) => seed.tags.length >= 1).length;
}

function searchableText(candidate: RecommendationCandidate): string {
  const description = candidate.description ?? "";
  return `${candidate.title} ${description}`;
}

export function scoreCandidate(candidate: RecommendationCandidate, libraryTagSet: Set<string>): CandidateScore {
  const candidateTagSet = new Set(candidate.tags);

  let tagScore = 0;
  for (const tag of candidate.tags) {
    if (libraryTagSet.has(tag)) {
      tagScore += 1;
    }
  }

  const haystack = searchableText(candidate).toLowerCase();
  let descBoost = 0;
  for (const tag of libraryTagSet) {
    if (candidateTagSet.has(tag)) {
      continue;
    }
    if (haystack.includes(tag.toLowerCase())) {
      descBoost += 1;
    }
  }

  return {
    tagScore,
    descBoost,
    totalScore: tagScore + descBoost,
  };
}

export function rankCandidates(
  candidates: RecommendationCandidate[],
  libraryTagSet: Set<string>,
  limit = 10,
): ScoredRecommendation[] {
  return candidates
    .map((candidate) => {
      const score = scoreCandidate(candidate, libraryTagSet);
      return {
        candidate,
        ...score,
      };
    })
    .filter((item) => item.totalScore > 0)
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      if (b.tagScore !== a.tagScore) {
        return b.tagScore - a.tagScore;
      }
      return a.candidate.title.localeCompare(b.candidate.title, undefined, { sensitivity: "base" });
    })
    .slice(0, limit);
}
