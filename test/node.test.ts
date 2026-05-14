import { expect } from "chai";
import { writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { paaRoots, cdSigners, vendors, readManifest } from "../src/node.js";
import { DclDataCorruptError } from "../src/types.js";

// Compiled to build/esm/test/; go up 3 levels to reach package root
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const fixturesRoot = join(packageRoot, "tools/__fixtures__");

describe("readManifest", () => {
    it("parses manifest from given root", () => {
        const m = readManifest(fixturesRoot);
        expect(m.builtAt).to.equal("2026-05-14T02:00:00.000Z");
        expect(m.counts.paaRoots).to.equal(4);
        expect(m.counts.paaRootsTest).to.equal(1);
    });

    it("throws on missing manifest", () => {
        expect(() => readManifest("/nonexistent/root")).to.throw();
    });
});

describe("paaRoots", () => {
    it("SeedSource shape: builtAt + expectedCount (production only by default)", () => {
        const seed = paaRoots({ packageRoot: fixturesRoot });
        expect(seed.builtAt).to.equal("2026-05-14T02:00:00.000Z");
        expect(seed.expectedCount).to.equal(3); // 4 total − 1 test
    });

    it("excludes test entries by default", async () => {
        const entries: Array<{ kind: string }> = [];
        for await (const e of paaRoots({ packageRoot: fixturesRoot }).entries) {
            entries.push(e as { kind: string });
        }
        expect(entries).to.have.length(3);
        expect(entries.every(e => e.kind !== "test")).to.equal(true);
    });

    it("includes test entries + expectedCount = total when includeTest: true", async () => {
        const seed = paaRoots({ packageRoot: fixturesRoot, includeTest: true });
        expect(seed.expectedCount).to.equal(4);
        const entries: unknown[] = [];
        for await (const e of seed.entries) entries.push(e);
        expect(entries).to.have.length(4);
    });

    it("throws DclDataCorruptError on malformed JSONL line", async () => {
        const tmpRoot = join(tmpdir(), `dcl-test-${Date.now()}`);
        await mkdir(join(tmpRoot, "data"), { recursive: true });
        await writeFile(
            join(tmpRoot, "manifest.json"),
            JSON.stringify({
                builtAt: "2026-01-01T00:00:00.000Z",
                schemaVersion: 1,
                sources: { dcl: { url: "" }, github: { repo: "", ref: "", commit: "" } },
                counts: {
                    paaRoots: 2,
                    paaRootsTest: 0,
                    cdSigners: 0,
                    cdSignersTest: 0,
                    vendors: 0,
                    vendorsTest: 0,
                },
            }),
        );
        await writeFile(join(tmpRoot, "data", "paa-roots.jsonl"), '{"valid":true}\nnot-json\n');
        const seed = paaRoots({ packageRoot: tmpRoot, includeTest: true });
        let err: unknown;
        try {
            for await (const _ of seed.entries) {
                /* drain */
            }
        } catch (e) {
            err = e;
        } finally {
            await rm(tmpRoot, { recursive: true });
        }
        expect(err).to.be.instanceof(DclDataCorruptError);
    });

    it("closes stream on early break", async () => {
        let count = 0;
        for await (const _ of paaRoots({ packageRoot: fixturesRoot }).entries) {
            if (++count === 1) break;
        }
        expect(count).to.equal(1);
    });
});

describe("cdSigners", () => {
    it("expectedCount = production only", () => {
        expect(cdSigners({ packageRoot: fixturesRoot }).expectedCount).to.equal(2);
    });

    it("yields all entries with includeTest: true", async () => {
        const entries: unknown[] = [];
        for await (const e of cdSigners({ packageRoot: fixturesRoot, includeTest: true }).entries) entries.push(e);
        expect(entries).to.have.length(3);
    });
});

describe("vendors", () => {
    it("expectedCount = production only", () => {
        expect(vendors({ packageRoot: fixturesRoot }).expectedCount).to.equal(2);
    });

    it("yields production vendors by default", async () => {
        const entries: Array<{ kind: string }> = [];
        for await (const e of vendors({ packageRoot: fixturesRoot }).entries) {
            entries.push(e as { kind: string });
        }
        expect(entries).to.have.length(2);
        expect(entries.every(e => e.kind !== "test")).to.equal(true);
    });

    it("yields all vendors with includeTest: true", async () => {
        const entries: unknown[] = [];
        for await (const e of vendors({ packageRoot: fixturesRoot, includeTest: true }).entries) entries.push(e);
        expect(entries).to.have.length(3);
    });
});
