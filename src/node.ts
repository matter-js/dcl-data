import { createReadStream } from "node:fs";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import type { PaaRootEntry, CdSignerEntry, VendorEntry, Manifest, SeedSource } from "./types.js";
import { DclDataCorruptError } from "./types.js";

const defaultPackageRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

export function readManifest(packageRoot: string = defaultPackageRoot): Manifest {
    return JSON.parse(readFileSync(join(packageRoot, "manifest.json"), "utf8")) as Manifest;
}

async function* streamJsonl<T>(filePath: string, filter?: (entry: T) => boolean): AsyncGenerator<T> {
    const stream = createReadStream(filePath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let lineNumber = 0;
    try {
        for await (const line of rl) {
            lineNumber++;
            if (line.trim() === "") continue;
            let entry: T;
            try {
                entry = JSON.parse(line) as T;
            } catch (e) {
                throw new DclDataCorruptError(filePath, lineNumber, e);
            }
            if (!filter || filter(entry)) yield entry;
        }
    } finally {
        rl.close();
        stream.destroy();
    }
}

type Opts = { packageRoot?: string; includeTest?: boolean };

export function paaRoots(opts?: Opts): SeedSource<PaaRootEntry> {
    const root = opts?.packageRoot ?? defaultPackageRoot;
    const manifest = readManifest(root);
    const includeTest = opts?.includeTest ?? false;
    return {
        builtAt: manifest.builtAt,
        expectedCount: manifest.counts.paaRoots - (includeTest ? 0 : manifest.counts.paaRootsTest),
        entries: streamJsonl<PaaRootEntry>(
            join(root, "data", "paa-roots.jsonl"),
            includeTest ? undefined : e => e.kind !== "test",
        ),
    };
}

export function cdSigners(opts?: Opts): SeedSource<CdSignerEntry> {
    const root = opts?.packageRoot ?? defaultPackageRoot;
    const manifest = readManifest(root);
    const includeTest = opts?.includeTest ?? false;
    return {
        builtAt: manifest.builtAt,
        expectedCount: manifest.counts.cdSigners - (includeTest ? 0 : manifest.counts.cdSignersTest),
        entries: streamJsonl<CdSignerEntry>(
            join(root, "data", "cd-signers.jsonl"),
            includeTest ? undefined : e => e.kind !== "test",
        ),
    };
}

export function vendors(opts?: Opts): SeedSource<VendorEntry> {
    const root = opts?.packageRoot ?? defaultPackageRoot;
    const manifest = readManifest(root);
    const includeTest = opts?.includeTest ?? false;
    const all = JSON.parse(readFileSync(join(root, "data", "vendors.json"), "utf8")) as VendorEntry[];
    return {
        builtAt: manifest.builtAt,
        expectedCount: manifest.counts.vendors - (includeTest ? 0 : manifest.counts.vendorsTest),
        entries: (async function* () {
            for (const v of all) {
                if (includeTest || v.kind !== "test") yield v;
            }
        })(),
    };
}
