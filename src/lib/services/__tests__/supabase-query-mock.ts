export interface QueryCall {
  method: string;
  args: unknown[];
}

export interface QueryResult {
  data?: unknown;
  error?: unknown;
}

export interface CreateSupabaseQueryMockOptions {
  /** Single await result (backward compatible). Default `{ data: [], error: null }`. */
  result?: QueryResult;
  /** Sequential await results; each `then` consumes the next entry (last repeats). */
  results?: QueryResult[];
  /** `client.auth.getUser()` — omit for default user; `null` means unauthenticated. */
  authUser?: { id: string } | null;
}

function isOptions(value: QueryResult | CreateSupabaseQueryMockOptions): value is CreateSupabaseQueryMockOptions {
  return "result" in value || "results" in value || "authUser" in value;
}

/**
 * Chainable PostgREST-shaped fake for service unit tests.
 * Records method calls; awaiting the builder resolves `{ data, error }`.
 *
 * When `results` is provided, each await consumes the next entry; if the
 * sequence is exhausted, the **last** entry repeats (document under-specified
 * multi-step tests carefully, or assert call counts).
 */
export function createSupabaseQueryMock(
  resultOrOptions: QueryResult | CreateSupabaseQueryMockOptions = { data: [], error: null },
) {
  const options: CreateSupabaseQueryMockOptions = isOptions(resultOrOptions)
    ? resultOrOptions
    : { result: resultOrOptions };

  const calls: QueryCall[] = [];
  let resultIndex = 0;

  const nextResult = (): { data: unknown; error: unknown } => {
    const sequence = options.results;
    if (sequence && sequence.length > 0) {
      const index = Math.min(resultIndex, sequence.length - 1);
      const entry = sequence[index] ?? { data: null, error: null };
      resultIndex += 1;
      return { data: entry.data ?? null, error: entry.error ?? null };
    }
    const entry = options.result ?? { data: [], error: null };
    return { data: entry.data ?? [], error: entry.error ?? null };
  };

  const builder: Record<string, unknown> = {};

  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };

  builder.from = record("from");
  builder.select = record("select");
  builder.eq = record("eq");
  builder.in = record("in");
  builder.order = record("order");
  builder.or = record("or");
  builder.insert = record("insert");
  builder.update = record("update");
  builder.delete = record("delete");
  builder.maybeSingle = record("maybeSingle");
  builder.single = record("single");

  builder.then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(nextResult()).then(onFulfilled, onRejected);

  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
    auth: {
      getUser: () => {
        calls.push({ method: "auth.getUser", args: [] });
        if (options.authUser === null) {
          return Promise.resolve({ data: { user: null }, error: { message: "not authenticated" } });
        }
        if (options.authUser === undefined) {
          return Promise.resolve({
            data: { user: { id: "00000000-0000-4000-8000-000000000099" } },
            error: null,
          });
        }
        return Promise.resolve({ data: { user: options.authUser }, error: null });
      },
    },
  };

  return { client, calls, builder };
}

export function callsNamed(calls: QueryCall[], method: string): QueryCall[] {
  return calls.filter((c) => c.method === method);
}
