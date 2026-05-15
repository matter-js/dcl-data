export type SeedSource<T> = {
    builtAt: string; // ISO 8601 UTC — passed through from manifest
    expectedCount: number;
    entries: AsyncIterable<T>;
};

export type CertEntry = {
    subjectKeyId: string; // lowercase hex, no colons
    derHex: string; // raw DER as lowercase hex
    kind: "production" | "test";
    subject?: string; // X.509 subject DN — informational only
    issuer?: string; // X.509 issuer DN — informational only
    notBefore?: string; // ISO 8601
    notAfter?: string;
};

export type PaaRootEntry = CertEntry & { role: "paa" };
export type CdSignerEntry = CertEntry & { role: "cd-signer" };

export type VendorEntry = {
    vendorId: number;
    vendorName: string;
    companyLegalName?: string;
    companyPreferredName?: string;
    vendorLandingPageURL?: string;
    creator?: string;
    /**
     * Currently always "production". DCL exposes no test-net vendor source — `DclVendorInfoService`
     * fetches prod only. Field kept for API symmetry with cert entries; may classify Matter-reserved
     * test vendor IDs (0xFFF1–0xFFF4) in the future.
     */
    kind: "production" | "test";
    [extra: string]: unknown; // preserve unknown DCL fields — forward-compat
};

export type Manifest = {
    builtAt: string; // ISO 8601 UTC
    schemaVersion: number;
    sources: {
        dcl: { url: string; latestBlockHeight?: number };
        github: { repo: string; ref: string; commit: string };
    };
    counts: {
        paaRoots: number;
        paaRootsTest: number;
        cdSigners: number;
        cdSignersTest: number;
        vendors: number;
        /** Currently always 0 — see {@link VendorEntry.kind}. */
        vendorsTest: number;
    };
};

export class DclDataCorruptError extends Error {
    constructor(
        readonly file: string,
        readonly lineNumber: number,
        cause: unknown,
    ) {
        super(`Corrupt entry in ${file} at line ${lineNumber}`, { cause });
        this.name = "DclDataCorruptError";
    }
}
