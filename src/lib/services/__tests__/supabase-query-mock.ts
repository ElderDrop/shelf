export interface QueryCall {
  method: string;
  args: unknown[];
}

/**
 * Chainable PostgREST-shaped fake for service unit tests.
 * Records method calls; awaiting the builder resolves `{ data, error }`.
 */
export function createSupabaseQueryMock(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const calls: QueryCall[] = [];

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
  builder.order = record("order");
  builder.or = record("or");
  builder.insert = record("insert");
  builder.update = record("update");
  builder.maybeSingle = record("maybeSingle");
  builder.single = record("single");

  builder.then = (
    onFulfilled: (value: { data: unknown; error: unknown }) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve({ data: result.data ?? [], error: result.error ?? null }).then(onFulfilled, onRejected);

  const client = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  };

  return { client, calls, builder };
}

export function callsNamed(calls: QueryCall[], method: string): QueryCall[] {
  return calls.filter((c) => c.method === method);
}
