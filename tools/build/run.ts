/**
 * Nightly build entry point.
 * Fetches fresh DCL data, checks count tolerances against the previously-published package
 * (passed via BASELINE_DIR env var), diffs, writes data/ + summary.md.
 * Exits 0 with .no-changes sentinel when nothing changed (CI skips publish step).
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CdSignerEntry, Manifest, PaaRootEntry, VendorEntry } from "../../src/types.js";
import { buildPackage } from "../../test/tools/build/package.js";
import { checkCountTolerance } from "../../test/tools/verify/counts.js";
import { diffDataSets, formatSummary } from "../diff/summary.js";
import type { DataSet } from "../diff/summary.js";
import { fetchDclData } from "../fetch/services.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

async function readJsonl<T>(path: string): Promise<T[]> {
    const text = await readFile(path, "utf8");
    return text
        .trim()
        .split("\n")
        .filter(Boolean)
        .map(line => JSON.parse(line) as T);
}

async function readBaseline(): Promise<{ dataset: DataSet; manifest: Manifest | null }> {
    const baselineDir = process.env["BASELINE_DIR"];
    if (!baselineDir) {
        return { dataset: { paaRoots: [], cdSigners: [], vendors: [] }, manifest: null };
    }
    try {
        const dataDir = join(baselineDir, "data");
        const [paaRoots, cdSigners, vendorsJson, manifestJson] = await Promise.all([
            readJsonl<PaaRootEntry>(join(dataDir, "paa-roots.jsonl")),
            readJsonl<CdSignerEntry>(join(dataDir, "cd-signers.jsonl")),
            readFile(join(dataDir, "vendors.json"), "utf8"),
            readFile(join(baselineDir, "manifest.json"), "utf8"),
        ]);
        return {
            dataset: { paaRoots, cdSigners, vendors: JSON.parse(vendorsJson) as VendorEntry[] },
            manifest: JSON.parse(manifestJson) as Manifest,
        };
    } catch (err) {
        console.error("Warning: could not read baseline from BASELINE_DIR, treating as first run:", err);
        return { dataset: { paaRoots: [], cdSigners: [], vendors: [] }, manifest: null };
    }
}

const { dataset: baseline, manifest: baselineManifest } = await readBaseline();

console.log("Fetching DCL data...");
const newData = await fetchDclData();
console.log(
    `Fetched: ${newData.paaRoots.length} PAA roots, ${newData.cdSigners.length} CD signers, ${newData.vendors.length} vendors`,
);

checkCountTolerance("PAA roots", baselineManifest?.counts.paaRoots ?? 0, newData.paaRoots.length);
checkCountTolerance("CD signers", baselineManifest?.counts.cdSigners ?? 0, newData.cdSigners.length);
checkCountTolerance("Vendors", baselineManifest?.counts.vendors ?? 0, newData.vendors.length);

const diff = diffDataSets(baseline, newData);

const newManifest = await buildPackage({
    paaRoots: newData.paaRoots,
    cdSigners: newData.cdSigners,
    vendors: newData.vendors,
    outDir: packageRoot,
    builtAt: new Date().toISOString(),
    sources: {
        dcl: { url: "https://on.dcl.csa-iot.org" },
        github: {
            repo: "project-chip/connectedhomeip",
            ref: "master",
            commit: process.env["CONNECTEDHOMEIP_COMMIT"] ?? "unknown",
        },
    },
});

const summary = formatSummary(diff, newManifest);
await writeFile(join(packageRoot, "summary.md"), summary, "utf8");
console.log(`\n${summary}`);

if (!diff.hasChanges) {
    console.log("No changes — skipping publish.");
    await writeFile(join(packageRoot, ".no-changes"), "", "utf8");
}
