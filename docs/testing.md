# Testing

Mockup Studio uses Vitest. This page records the configured test commands and the result of a fresh run against the current working tree.

## Commands

From [`package.json`](../package.json):

```bash
npm test          # vitest run — single complete run
npm run test:watch # vitest — watch mode
npm run typecheck  # typecheck:node + typecheck:web, separate from Vitest
```

Vitest's own typechecking is disabled (`typecheck: { enabled: false }`), so `npm run typecheck` is the TypeScript gate. There is no `test:ui` or `test:coverage` script, and [`vitest.config.ts`](../vitest.config.ts) has no coverage provider or threshold configuration.

## Test configuration

[`vitest.config.ts`](../vitest.config.ts) sets:

- `environment: 'jsdom'`
- `globals: true`
- `setupFiles: ['src/__tests__/setup.ts']`
- `include: ['src/**/*.test.{ts,tsx}']`
- Alias `@shared` → `src/shared`

There is no configured `@` alias, Node test environment, or React plugin in the test config.

## Current verified result

A fresh `npm test` run during this documentation pass produced:

```text
Test Files  76 passed (76)
Tests       1158 passed (1158)
Duration    101.08s
```

The run repeated this jsdom warning:

```text
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
```

The warning is present in the captured output; no failing test was reported. The raw log is `/tmp/opencode/mockup-tests-current.log`.

## What this result covers

The count above is the current repository result, not a permanent project metric. Historical counts in older docs or changelog entries are not canonical for the present tree. Adding, removing, or changing tests will change the numbers, so rerun `npm test` after changes rather than copying the count from this page.

## Sources

[`../package.json`](../package.json), [`../vitest.config.ts`](../vitest.config.ts), [`../src/__tests__/`](../src/__tests__/), [`../AGENTS.md`](../AGENTS.md), and the captured run at `/tmp/opencode/mockup-tests-current.log`.
