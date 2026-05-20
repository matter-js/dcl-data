# dcl-data — Matter DCL data package for offline seeding

Part of the matter.js IoT Matter project. Pre-seeds commissioning-relevant data from the CSA Distributed Compliance Ledger (DCL) so matter.js-based projects work even when DCL is unreachable. The package includes:

- Product Attestation Authority (PAA) root certificates
- Certification Declaration (CD) signer certificates
- Vendor list and metadata

Besides the JSONL-style data files, the package exports async-iterable functions for each data type that can be used directly to pre-initialize `DclCertificateService` and `DclVendorInfoService` in a matter.js project.

The goal is to provide baseline data for cases where the DCL is unavailable or unreachable during device commissioning, improving the user experience for offline matter.js usage.

> **Not a replacement for live DCL access.** This package is a static snapshot. It does not include certificate revocation lists (CRLs), real-time vendor updates, or product-specific data fetched on demand. Production deployments should always combine this seed with a live `DclCertificateService` / `DclVendorInfoService` so revocations and new entries are picked up. Information about software updates for devices is also not included and only available live from the DCL.

## Installation

```bash
npm install @matter/dcl-data
```

Requires Node.js ≥ 18. ESM-only.

## Usage

```ts
import type { PaaRootEntry, CdSignerEntry, VendorEntry } from "@matter/dcl-data";
import { paaRoots, cdSigners, vendors, readManifest } from "@matter/dcl-data/node";

// production entries only (default)
const paas = paaRoots();
console.log(`PAA roots: ${paas.expectedCount}, built at ${paas.builtAt}`);
for await (const entry of paas.entries) {
    // entry.subjectKeyId (lowercase hex), entry.derHex, entry.kind
}

// include test-net + GitHub dev certificates
const allCds = cdSigners({ includeTest: true });
for await (const entry of allCds.entries) { /* ... */ }

// vendor metadata (eager — small dataset)
for await (const v of vendors().entries) {
    // v.vendorId, v.vendorName, v.companyLegalName, ...
}

// snapshot metadata
const manifest = readManifest();
console.log(manifest.builtAt, manifest.counts);
```

Each function returns a `SeedSource<T>` with `builtAt` (ISO 8601 UTC), `expectedCount`, and `entries: AsyncIterable<T>`. Pass `{ includeTest: true }` to include test-net + GitHub dev certificates (default: production only).

## Versioning

CalVer: `YYYY.M.D` (e.g. `2026.5.15`). Same-day republishes append a patch counter (`2026.5.15.1`).

Published nightly via GitHub Actions when the DCL snapshot changes. Each release is tagged (`vYYYY.M.D[.N]`) with a summary of added/removed/changed entries.

## Data sources

- CSA DCL production: <https://on.dcl.csa-iot.org>
- CSA DCL test-net: <https://on.test-net.dcl.csa-iot.org> (test certificates only, requires `includeTest`)
- GitHub: [`project-chip/connectedhomeip`](https://github.com/project-chip/connectedhomeip) `master` — development PAA roots and CD signer certificates

The nightly build records the connectedhomeip commit SHA in `manifest.json` under `sources.github.commit`.

## Notes and limitations

- **`VendorEntry.kind` is currently always `"production"`.** `DclVendorInfoService` only fetches from the production DCL endpoint — no test-net vendor source exists. `manifest.counts.vendorsTest` is always `0`. The field is kept for API symmetry with cert entries; reserved Matter test vendor IDs (`0xFFF1`–`0xFFF4`) appear as production entries.
- Certificate `derHex` is the raw DER bytes as lowercase hex. `subjectKeyId` is lowercase hex without colons.
- Vendor entries preserve unknown DCL fields (forward-compatible).
- The snapshot is a point-in-time view. For up-to-date data, prefer the live `DclCertificateService` / `DclVendorInfoService`; use this package only as a fallback or seed.

## License

Apache-2.0
