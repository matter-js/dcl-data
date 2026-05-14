import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PaaRootEntry, CdSignerEntry, VendorEntry, Manifest } from "../../../src/types.js";

type BuildInput = {
    paaRoots: PaaRootEntry[];
    cdSigners: CdSignerEntry[];
    vendors: VendorEntry[];
    outDir: string;
    builtAt: string;
    sources: Manifest["sources"];
};

function sortedJsonLine(obj: object): string {
    const rec = obj as Record<string, unknown>;
    return JSON.stringify(Object.fromEntries(Object.keys(rec).sort().map(k => [k, rec[k]])));
}

function toJsonl(entries: object[]): string {
    return entries.map(e => sortedJsonLine(e)).join("\n") + "\n";
}

export async function buildPackage(input: BuildInput): Promise<Manifest> {
    const dataDir = join(input.outDir, "data");
    await mkdir(dataDir, { recursive: true });

    const paa = [...input.paaRoots].sort((a, b) => a.subjectKeyId.localeCompare(b.subjectKeyId));
    const cd = [...input.cdSigners].sort((a, b) => a.subjectKeyId.localeCompare(b.subjectKeyId));
    const vnd = [...input.vendors].sort((a, b) => a.vendorId - b.vendorId);

    const manifest: Manifest = {
        builtAt: input.builtAt,
        schemaVersion: 1,
        sources: input.sources,
        counts: {
            paaRoots: paa.length,
            paaRootsTest: paa.filter(e => e.kind === "test").length,
            cdSigners: cd.length,
            cdSignersTest: cd.filter(e => e.kind === "test").length,
            vendors: vnd.length,
            vendorsTest: vnd.filter(e => e.kind === "test").length,
        },
    };

    await Promise.all([
        writeFile(join(dataDir, "paa-roots.jsonl"), toJsonl(paa)),
        writeFile(join(dataDir, "cd-signers.jsonl"), toJsonl(cd)),
        writeFile(join(dataDir, "vendors.json"), JSON.stringify(vnd, null, 2) + "\n"),
        writeFile(join(input.outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n"),
    ]);

    return manifest;
}
