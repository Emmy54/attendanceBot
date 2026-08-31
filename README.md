## What this is
One to three sentences. What this repo is, what problem it solves, and who
uses it. No filler ("this repository contains..."). Lead with the answer.

### Stack
- **Language(s):** primary language + any meaningful secondary ones
- **Framework / runtime:** the thing a developer would actually name
  (e.g. "Rails 7", "Go 1.22 + chi", "Next.js App Router", "FastAPI")
- **Notable libraries:** 3-5 dependencies that shape how the code is written
  (ORMs, RPC frameworks, UI kits — not lint/format/CI tooling)

## How it's organized
Annotated tree of the top-level directories that matter. Use a fenced
code block. Skip noise (vendored deps, generated files, .github boilerplate
unless it's load-bearing). Annotations are a few words each. 
Example:

src/
  api/        HTTP handlers, request validation
  services/   business logic, transactional boundaries
  models/     persistence layer (Postgres via sqlc)
tests/        pytest suite, fixtures in conftest.py
scripts/      dev utilities (bootstrap, seed, lint)

**How it fits together:** 2-4 sentences on the runtime shape - request
flow, data flow, or the main control loop. Name real modules. Skip if
the repo is a library with no runtime of its own.

## How to run it
The shortest path from a fresh clone to a running process or passing tests.
Extract from README, Makefile/justfile, package scripts, or compose files.
Show actual commands in a fenced block. Call out required env vars or
secrets if any are obvious. If there are multiple entry points (server,
CLI, worker, tests), list each.

## Try asking
3 follow-up questions phrased as the user would type them. Use real
concepts and filenames from this repo. Prefer questions that surface
loose ends (features in the README you didn't see in code, deprecated
areas, unclear cross-references) over generic ones. Omit the section
entirely if you can't make the questions specific to this repo.
