import { z } from "zod";

export const SYSTEM_PROMPT = `Jesteś precyzyjnym, konstruktywnym recenzentem kodu dla projektu Shelf
(Astro 6 SSR, React 19 islands, Tailwind 4, Supabase RLS, Cloudflare Workers).

Oceń diff (oraz opcjonalnie tytuł/opis PR i plan zmian) w pięciu kryteriach w skali 1–10.

## Kryteria (1 = najgorzej, 10 = wzorowo)

1. implementationCorrectness — poprawność względem deklarowanego zachowania
   - 1: zmiana nie robi tego, co deklaruje PR; zepsute kontrakty SSR/API; cichy błąd na happy path
   - 10: zachowanie zgodne z tytułem/opisem; spójne handlery API, strony Astro i ścieżki danych

2. idiomaticity — idiomatyczność względem konwencji Shelf
   - 1: walczy ze stackiem (Next.js "use client", ręczne sklejanie klas Tailwind, sekrety po stronie klienta)
   - 10: Astro + React islands tylko gdy interakcja; importy @/*; cn(); Zod na body API;
     prerender = false na API; logika w src/lib/

3. complexity — złożoność proporcjonalna do problemu
   - 1: over-engineering, zbędne abstrakcje, trudny flow
   - 10: najprostsze sensowne rozwiązanie; złożoność adekwatna do ryzyka

4. testRiskCoverage — testy względem ryzyka
   - 1: zmienione ryzykowne ścieżki (authz, RLS, share token, admin) bez testów i bez uzasadnienia
   - 10: testy (lub jawna nota ryzyka) pokrywają dotknięte ryzykowne ścieżki; tani warstwowy test OK

5. securitySafety — bezpieczeństwo
   - 1: wyciek sekretów, lekceważenie RLS, mutacja przez share-link, service-role poza wąskim serwerem
   - 10: brak sekretów w diffie; authz/RLS respektowane; privileged client tylko uzasadniony; share read-only

## Werdykt

Wydaj wiążący verdict "pass" albo "fail":
- preferuj "fail", gdy którekolwiek kryterium ≤ 3, albo gdy security/correctness jest wyraźnie złamane
- "pass" tylko gdy wszystkie score ≥ 5 i nie ma krytycznego problemu security/correctness

Dołącz summary (2–3 zdania Markdown) actionable dla autora PR.

Odpowiedz WYŁĄCZNIE jednym poprawnym obiektem JSON (bez markdown fences, bez komentarzy, bez tekstu obok)
o dokładnie tych polach:
implementationCorrectness, idiomaticity, complexity, testRiskCoverage, securitySafety, verdict, summary.
Wartości liczbowe to liczby całkowite 1–10 (nie stringi). verdict to "pass" albo "fail".
W polu summary NIE używaj znaku cudzysłowu " — zamiast tego używaj apostrofów ' albo backticków.`;

const score = (description: string) =>
  z.number().int().min(1).max(10).describe(description);

export const REVIEW_SCHEMA = z.object({
  implementationCorrectness: score(
    "Poprawność implementacji względem deklarowanego zachowania (1-10)",
  ),
  idiomaticity: score(
    "Idiomatyczność względem konwencji Shelf / Astro / React islands (1-10)",
  ),
  complexity: score("Złożoność proporcjonalna do problemu (1-10)"),
  testRiskCoverage: score(
    "Pokrycie testami proporcjonalne do ryzyka zmienianych ścieżek (1-10)",
  ),
  securitySafety: score(
    "Bezpieczeństwo: sekrety, RLS, authz, share-link, service-role (1-10)",
  ),
  verdict: z.enum(["pass", "fail"]).describe("Wiążący werdykt dla całej zmiany"),
  summary: z.string().describe("Podsumowanie w Markdown, gotowe jako komentarz do PR-a"),
});

export type Review = z.infer<typeof REVIEW_SCHEMA>;

export type ReviewPromptInput = {
  diff: string;
  title?: string;
  body?: string;
  plan?: string;
};

const MAX_BODY_CHARS = 4000;

export function buildReviewPrompt(input: ReviewPromptInput): string {
  const parts: string[] = [SYSTEM_PROMPT, "", "---", ""];

  if (input.title?.trim()) {
    parts.push(`## PR title\n${input.title.trim()}`, "");
  }

  const body = input.body?.trim();
  if (body) {
    const truncated =
      body.length > MAX_BODY_CHARS
        ? `${body.slice(0, MAX_BODY_CHARS)}\n\n[…truncated ${body.length - MAX_BODY_CHARS} chars]`
        : body;
    parts.push(`## PR description\n${truncated}`, "");
  }

  if (input.plan?.trim()) {
    parts.push(`## Implementation plan (from context/changes)\n${input.plan.trim()}`, "");
  }

  parts.push("## Diff\nZrecenzuj ten diff. Zwróć wyłącznie JSON.\n", input.diff);
  return parts.join("\n");
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model nie zwrócił obiektu JSON");
  }
  return candidate.slice(start, end + 1);
}

/** Próba naprawy typowych błędów modelu: niesparsowane " wewnątrz summary. */
function repairReviewJson(raw: string): string {
  try {
    JSON.parse(raw);
    return raw;
  } catch {
    // no-op, try repair
  }

  const summaryKey = '"summary"';
  const idx = raw.lastIndexOf(summaryKey);
  if (idx === -1) return raw;

  const colon = raw.indexOf(":", idx + summaryKey.length);
  if (colon === -1) return raw;

  let i = colon + 1;
  while (i < raw.length && /\s/.test(raw[i]!)) i++;
  if (raw[i] !== '"') return raw;
  const valueStart = i + 1;

  let valueEnd = raw.length - 1;
  while (valueEnd > valueStart && /\s/.test(raw[valueEnd]!)) valueEnd--;
  if (raw[valueEnd] === "}") {
    valueEnd--;
    while (valueEnd > valueStart && /\s/.test(raw[valueEnd]!)) valueEnd--;
  }
  if (raw[valueEnd] !== '"') return raw;

  const summary = raw.slice(valueStart, valueEnd);
  const escaped = summary.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  return `${raw.slice(0, valueStart)}${escaped}${raw.slice(valueEnd)}`;
}

/** Wyciąga pierwszy obiekt JSON z odpowiedzi modelu (czasem otacza go fence'ami). */
export function parseReviewJson(text: string): Review {
  const objectText = repairReviewJson(extractJsonObject(text));
  let raw: unknown;
  try {
    raw = JSON.parse(objectText) as unknown;
  } catch (err) {
    throw new Error(
      `Nie udało się sparsować JSON z odpowiedzi modelu: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const parsed = REVIEW_SCHEMA.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Niepoprawny structured output: ${parsed.error.message}`);
  }
  return parsed.data;
}
