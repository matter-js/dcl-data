import { expect } from "chai";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PaaRootEntry, CdSignerEntry, VendorEntry } from "../src/types.js";
import { buildPackage } from "./tools/build/package.js";

const PAA_ROOTS: PaaRootEntry[] = [
    { role: "paa", kind: "production", subjectKeyId: "cccccc", derHex: "30cc" },
    { role: "paa", kind: "production", subjectKeyId: "aaaaaa", derHex: "30aa" },
    { role: "paa", kind: "test", subjectKeyId: "bbbbbb", derHex: "30bb" },
];
const CD_SIGNERS: CdSignerEntry[] = [{ role: "cd-signer", kind: "production", subjectKeyId: "dddddd", derHex: "30dd" }];
const VENDORS: VendorEntry[] = [
    { vendorId: 4097, vendorName: "B Corp", kind: "production" },
    { vendorId: 4096, vendorName: "A Corp", kind: "production" },
    { vendorId: 65521, vendorName: "Test Vendor", kind: "test" },
];
const SOURCES = {
    dcl: { url: "https://on.dcl.csa-iot.org" },
    github: { repo: "project-chip/connectedhomeip", ref: "master", commit: "abc123" },
};

let tmpDir: string;
beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "dcl-build-"));
});
afterEach(async () => {
    await rm(tmpDir, { recursive: true });
});

describe("buildPackage", () => {
    it("paa-roots.jsonl sorted by subjectKeyId ascending", async () => {
        await buildPackage({
            paaRoots: PAA_ROOTS,
            cdSigners: CD_SIGNERS,
            vendors: VENDORS,
            outDir: tmpDir,
            builtAt: "2026-05-14T02:00:00.000Z",
            sources: SOURCES,
        });
        const lines = (await readFile(join(tmpDir, "data", "paa-roots.jsonl"), "utf8")).trim().split("\n");
        const skids = lines.map(l => (JSON.parse(l) as { subjectKeyId: string }).subjectKeyId);
        expect(skids).to.deep.equal(["aaaaaa", "bbbbbb", "cccccc"]);
    });

    it("vendors.json sorted by vendorId ascending", async () => {
        await buildPackage({
            paaRoots: PAA_ROOTS,
            cdSigners: CD_SIGNERS,
            vendors: VENDORS,
            outDir: tmpDir,
            builtAt: "2026-05-14T02:00:00.000Z",
            sources: SOURCES,
        });
        const arr = JSON.parse(await readFile(join(tmpDir, "data", "vendors.json"), "utf8")) as Array<{
            vendorId: number;
        }>;
        expect(arr.map(v => v.vendorId)).to.deep.equal([4096, 4097, 65521]);
    });

    it("manifest.json has correct split counts", async () => {
        await buildPackage({
            paaRoots: PAA_ROOTS,
            cdSigners: CD_SIGNERS,
            vendors: VENDORS,
            outDir: tmpDir,
            builtAt: "2026-05-14T02:00:00.000Z",
            sources: SOURCES,
        });
        const m = JSON.parse(await readFile(join(tmpDir, "manifest.json"), "utf8")) as {
            counts: { paaRoots: number; paaRootsTest: number; vendors: number; vendorsTest: number };
        };
        expect(m.counts).to.deep.include({ paaRoots: 3, paaRootsTest: 1, vendors: 3, vendorsTest: 1 });
    });

    it("same input → byte-identical JSONL (deterministic)", async () => {
        const opts = {
            paaRoots: PAA_ROOTS,
            cdSigners: CD_SIGNERS,
            vendors: VENDORS,
            outDir: tmpDir,
            builtAt: "2026-05-14T02:00:00.000Z",
            sources: SOURCES,
        };
        const tmpDir2 = await mkdtemp(join(tmpdir(), "dcl-build2-"));
        try {
            await buildPackage(opts);
            await buildPackage({ ...opts, outDir: tmpDir2 });
            const a = await readFile(join(tmpDir, "data", "paa-roots.jsonl"), "utf8");
            const b = await readFile(join(tmpDir2, "data", "paa-roots.jsonl"), "utf8");
            expect(a).to.equal(b);
        } finally {
            await rm(tmpDir2, { recursive: true });
        }
    });

    it("each JSONL line has alphabetically sorted JSON keys", async () => {
        await buildPackage({
            paaRoots: PAA_ROOTS,
            cdSigners: CD_SIGNERS,
            vendors: VENDORS,
            outDir: tmpDir,
            builtAt: "2026-05-14T02:00:00.000Z",
            sources: SOURCES,
        });
        const content = await readFile(join(tmpDir, "data", "paa-roots.jsonl"), "utf8");
        for (const line of content.trim().split("\n")) {
            const parsed = JSON.parse(line) as Record<string, unknown>;
            const keys = Object.keys(parsed);
            expect(keys).to.deep.equal([...keys].sort());
        }
    });
});
