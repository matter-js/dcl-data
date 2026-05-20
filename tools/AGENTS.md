# tools/

`tools/src/` is compiled by nacho-build (triggered by `tools/package.json`) into `tools/dist/esm/`.

Entry points are invoked directly as TypeScript via nacho-run (e.g., `nacho-run tools/src/build-run.ts`), which auto-builds before running.

## Intentional duplication

`tools/src/package-builder.ts` and `tools/src/count-verifier.ts` are intentional copies of `test/tools/build/package.ts` and `test/tools/verify/counts.ts`. The copies exist because matter-test only compiles `test/**/*.ts` into `build/esm/` — cross-package imports would break test resolution. If you fix a bug in one, apply the same fix to the counterpart.
