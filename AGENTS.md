# Repository Guidelines

## Project Structure & Module Organization

- `src/` holds TypeScript source: `lib/` contains JXA, screencapture, handler, schema, and temp file utilities; `index.ts` wires the MCP server; `cli.ts` starts it via stdio.
- `test/` mirrors the library layout with Vitest specs (`*.test.ts`) using mocks for `execa`, timers, and MCP responses.
- `.kiro/specs/` stores spec-driven development artifacts (requirements, design, tasks); update them whenever workflow phases advance.

## Build, Test, and Development Commands

- `pnpm run build` — bundle ESM outputs with tsdown into `dist/` for CLI distribution.
- `pnpm run dev` — watch-mode rebuild for rapid iteration.
- `pnpm run test` / `pnpm run test -- <pattern>` — execute Vitest suites (default all, pattern filters).
- `pnpm run lint` / `pnpm run format[:check]` — enforce Flat ESLint + Prettier rules.
- `pnpm run ci` — sequentially runs format, typecheck, lint, and tests; use before every PR push.

## Coding Style & Naming Conventions

- TypeScript (ESM) with strict mode; no `any` unless justified. Prefer `type` aliases over interfaces/classes.
- Files use kebab-case within `src/lib/` and snake-case for MCP JSON fields. Keep indentation at two spaces.
- Always export pure functions; side-effects belong in `index.ts`/`cli.ts`.
- Run `pnpm run format` before committing to align with Prettier settings (single quotes, trailing commas, 100 char width).

## Testing Guidelines

- Vitest is the standard. Place tests beside functionality in `test/` with matching filenames (`foo.test.ts`).
- Mock external commands (`execa`) and timers; never hit real `osascript`/`screencapture` in unit tests.
- Aim to cover validation, error branches, and TTL cleanup paths. Add new specs when adding modules.

## Commit & Pull Request Guidelines

- Follow existing history: subject line in sentence case, optional body with bullet details.
- Group related changes; avoid mixing spec artifacts and unrelated refactors.
- Before PR: ensure `pnpm run ci` passes, update `.kiro/specs/` state, and describe testing in PR body. Link issues and include screenshots/log excerpts when UI or output changes.

## Security & Configuration Tips

- macOS screen recording permissions are required; document manual setup when touching permission logic.
- Protect secrets: never commit actual bundle IDs or user paths. Use placeholders in examples and tests.
