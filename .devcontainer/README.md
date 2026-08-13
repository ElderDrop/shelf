# Dev container + Supabase

This project uses **Supabase on the Docker host**, not inside the dev container.
Nested Docker (Docker-in-Docker) does not work reliably in this environment.

## On the host (outside Cursor)

From the repo root on your machine:

```bash
npx supabase start
npx supabase status   # copy API URL + publishable/anon key
```

Keep that stack running while you develop.

## Inside the dev container

Create `.dev.vars` (gitignored) with a URL the **container** can reach — not `127.0.0.1`:

```env
SUPABASE_URL=http://host.docker.internal:54321
SUPABASE_KEY=<publishable key from supabase status>
```

`host.docker.internal` is mapped via `runArgs` in `devcontainer.json`.
If that name fails after rebuild, use the bridge gateway instead (often `172.17.0.1`):

```env
SUPABASE_URL=http://172.17.0.1:54321
```

Restart `npm run dev` after changing `.dev.vars`.

## What devcontainer.json controls

| Setting | Purpose |
| -------- | -------- |
| `--add-host=host.docker.internal:host-gateway` | Lets the app reach Supabase on the host |
| `forwardPorts: [4321]` | Astro dev server only |
| **Not** `forwardPorts: [54321]` | Supabase runs on the host; open Studio at `http://localhost:54323` in your browser |

Secrets (`SUPABASE_*`) stay in `.dev.vars`, not in `devcontainer.json`.
