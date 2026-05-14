import type { CdSignerEntry, Manifest, PaaRootEntry, VendorEntry } from "../../src/types.js";

export type DataSet = {
    paaRoots: PaaRootEntry[];
    cdSigners: CdSignerEntry[];
    vendors: VendorEntry[];
};

export type DiffSummary = {
    paaRoots: { added: string[]; removed: string[] };
    cdSigners: { added: string[]; removed: string[] };
    vendors: {
        added: { vendorId: number; vendorName: string }[];
        removed: { vendorId: number; vendorName: string }[];
    };
    hasChanges: boolean;
};

function diffCerts(
    prev: Array<{ subjectKeyId: string }>,
    next: Array<{ subjectKeyId: string }>,
): { added: string[]; removed: string[] } {
    const prevIds = new Set(prev.map(e => e.subjectKeyId));
    const nextIds = new Set(next.map(e => e.subjectKeyId));
    return {
        added: [...nextIds].filter(id => !prevIds.has(id)).sort(),
        removed: [...prevIds].filter(id => !nextIds.has(id)).sort(),
    };
}

export function diffDataSets(previous: DataSet, next: DataSet): DiffSummary {
    const paaRoots = diffCerts(previous.paaRoots, next.paaRoots);
    const cdSigners = diffCerts(previous.cdSigners, next.cdSigners);

    const prevVendors = new Map(previous.vendors.map(v => [v.vendorId, v.vendorName]));
    const nextVendors = new Map(next.vendors.map(v => [v.vendorId, v.vendorName]));

    const vendors = {
        added: [...nextVendors.entries()]
            .filter(([id]) => !prevVendors.has(id))
            .sort(([a], [b]) => a - b)
            .map(([vendorId, vendorName]) => ({ vendorId, vendorName })),
        removed: [...prevVendors.entries()]
            .filter(([id]) => !nextVendors.has(id))
            .sort(([a], [b]) => a - b)
            .map(([vendorId, vendorName]) => ({ vendorId, vendorName })),
    };

    const hasChanges =
        paaRoots.added.length > 0 ||
        paaRoots.removed.length > 0 ||
        cdSigners.added.length > 0 ||
        cdSigners.removed.length > 0 ||
        vendors.added.length > 0 ||
        vendors.removed.length > 0;

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

    const appendCerts = (label: string, diff: { added: string[]; removed: string[] }) => {
        if (!diff.added.length && !diff.removed.length) return;
        lines.push(`### ${label}`);
        if (diff.added.length) lines.push(`- Added: ${diff.added.join(", ")}`);
        if (diff.removed.length) lines.push(`- Removed: ${diff.removed.join(", ")}`);
        lines.push("");
    };

    appendCerts("PAA Roots", summary.paaRoots);
    appendCerts("CD Signers", summary.cdSigners);

    const { added: va, removed: vr } = summary.vendors;
    if (va.length || vr.length) {
        lines.push("### Vendors");
        if (va.length) lines.push(`- Added: ${va.map(v => `${v.vendorId} (${v.vendorName})`).join(", ")}`);
        if (vr.length) lines.push(`- Removed: ${vr.map(v => `${v.vendorId} (${v.vendorName})`).join(", ")}`);
        lines.push("");
    }

    if (!summary.hasChanges) lines.push("No data changes.");

    return lines.join("\n");
}
