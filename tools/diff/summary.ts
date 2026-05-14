import type { CdSignerEntry, Manifest, PaaRootEntry, VendorEntry } from "../../src/types.js";

export type DataSet = {
    paaRoots: PaaRootEntry[];
    cdSigners: CdSignerEntry[];
    vendors: VendorEntry[];
};

export type DiffSummary = {
    paaRoots: { added: string[]; removed: string[]; changed: string[] };
    cdSigners: { added: string[]; removed: string[]; changed: string[] };
    vendors: {
        added: { vendorId: number; vendorName: string }[];
        removed: { vendorId: number; vendorName: string }[];
        changed: { vendorId: number; vendorName: string }[];
    };
    hasChanges: boolean;
};

function sortedJson(obj: object): string {
    const rec = obj as Record<string, unknown>;
    return JSON.stringify(
        Object.fromEntries(
            Object.keys(rec)
                .sort()
                .map(k => [k, rec[k]]),
        ),
    );
}

function diffCerts(
    prev: Array<{ subjectKeyId: string; derHex: string }>,
    next: Array<{ subjectKeyId: string; derHex: string }>,
): { added: string[]; removed: string[]; changed: string[] } {
    const prevMap = new Map(prev.map(e => [e.subjectKeyId, e.derHex]));
    const nextMap = new Map(next.map(e => [e.subjectKeyId, e.derHex]));
    return {
        added: [...nextMap.keys()].filter(id => !prevMap.has(id)).sort(),
        removed: [...prevMap.keys()].filter(id => !nextMap.has(id)).sort(),
        changed: [...nextMap.entries()]
            .filter(([id, der]) => prevMap.has(id) && prevMap.get(id) !== der)
            .map(([id]) => id)
            .sort(),
    };
}

export function diffDataSets(previous: DataSet, next: DataSet): DiffSummary {
    const paaRoots = diffCerts(previous.paaRoots, next.paaRoots);
    const cdSigners = diffCerts(previous.cdSigners, next.cdSigners);

    const prevVendorMap = new Map(previous.vendors.map(v => [v.vendorId, v] as const));
    const nextVendorMap = new Map(next.vendors.map(v => [v.vendorId, v] as const));

    const vendors = {
        added: [...nextVendorMap.entries()]
            .filter(([id]) => !prevVendorMap.has(id))
            .sort(([a], [b]) => a - b)
            .map(([, v]) => ({ vendorId: v.vendorId, vendorName: v.vendorName })),
        removed: [...prevVendorMap.entries()]
            .filter(([id]) => !nextVendorMap.has(id))
            .sort(([a], [b]) => a - b)
            .map(([, v]) => ({ vendorId: v.vendorId, vendorName: v.vendorName })),
        changed: [...nextVendorMap.entries()]
            .filter(([id, nv]) => prevVendorMap.has(id) && sortedJson(prevVendorMap.get(id)!) !== sortedJson(nv))
            .sort(([a], [b]) => a - b)
            .map(([, v]) => ({ vendorId: v.vendorId, vendorName: v.vendorName })),
    };

    const hasChanges =
        paaRoots.added.length > 0 ||
        paaRoots.removed.length > 0 ||
        paaRoots.changed.length > 0 ||
        cdSigners.added.length > 0 ||
        cdSigners.removed.length > 0 ||
        cdSigners.changed.length > 0 ||
        vendors.added.length > 0 ||
        vendors.removed.length > 0 ||
        vendors.changed.length > 0;

    return { paaRoots, cdSigners, vendors, hasChanges };
}

export function formatSummary(summary: DiffSummary, manifest: Manifest): string {
    const lines = [
        `Built at: ${manifest.builtAt}`,
        `PAA roots: ${manifest.counts.paaRoots} (${manifest.counts.paaRootsTest} test)`,
        `CD signers: ${manifest.counts.cdSigners} (${manifest.counts.cdSignersTest} test)`,
        `Vendors: ${manifest.counts.vendors} (${manifest.counts.vendorsTest} test)`,
        "",
    ];

    const appendCerts = (label: string, diff: { added: string[]; removed: string[]; changed: string[] }) => {
        if (!diff.added.length && !diff.removed.length && !diff.changed.length) return;
        lines.push(`### ${label}`);
        if (diff.added.length) lines.push(`- Added: ${diff.added.join(", ")}`);
        if (diff.removed.length) lines.push(`- Removed: ${diff.removed.join(", ")}`);
        if (diff.changed.length) lines.push(`- Changed: ${diff.changed.join(", ")}`);
        lines.push("");
    };

    appendCerts("PAA Roots", summary.paaRoots);
    appendCerts("CD Signers", summary.cdSigners);

    const { added: va, removed: vr, changed: vc } = summary.vendors;
    if (va.length || vr.length || vc.length) {
        lines.push("### Vendors");
        if (va.length) lines.push(`- Added: ${va.map(v => `${v.vendorId} (${v.vendorName})`).join(", ")}`);
        if (vr.length) lines.push(`- Removed: ${vr.map(v => `${v.vendorId} (${v.vendorName})`).join(", ")}`);
        if (vc.length) lines.push(`- Changed: ${vc.map(v => `${v.vendorId} (${v.vendorName})`).join(", ")}`);
        lines.push("");
    }

    if (!summary.hasChanges) lines.push("No data changes.");

    return lines.join("\n");
}
