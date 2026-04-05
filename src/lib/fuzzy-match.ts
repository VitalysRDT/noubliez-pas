function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

export function matchAnswer(
  input: string,
  expected: string
): { match: boolean; score: number } {
  const a = normalize(input);
  const b = normalize(expected);

  if (a === b) return { match: true, score: 1.0 };
  if (a.length === 0) return { match: false, score: 0 };

  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const ratio = 1 - dist / maxLen;

  return { match: ratio >= 0.8, score: ratio };
}
