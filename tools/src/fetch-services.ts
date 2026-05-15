import { Environment, MockStorageService } from "@matter/main";
import { DclCertificateService, DclVendorInfoService } from "@matter/protocol";
import type { CdSignerEntry, PaaRootEntry, VendorEntry } from "../../src/types.js";

export type FetchResult = {
    paaRoots: PaaRootEntry[];
    cdSigners: CdSignerEntry[];
    vendors: VendorEntry[];
};

function toHex(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString("hex");
}

export async function fetchDclData(): Promise<FetchResult> {
    const env = new Environment("dcl-fetch");
    new MockStorageService(env);

    const certService = new DclCertificateService(env, {
        fetchTestCertificates: true,
        updateInterval: null,
    });
    const vendorService = new DclVendorInfoService(env, {
        updateInterval: null,
    });

    try {
        await certService.construction;
        await vendorService.construction;

        const paaRoots = new Array<PaaRootEntry>();
        const cdSigners = new Array<CdSignerEntry>();

        for (const cert of certService.certificates) {
            const derBytes = await certService.getCertificateAsDer(cert.subjectKeyId);
            const derHex = toHex(derBytes);
            const skid = cert.subjectKeyId.toLowerCase();
            const kind = cert.isProduction ? "production" : "test";

            if (cert.kind === "CDSigner") {
                const entry: CdSignerEntry = { role: "cd-signer", subjectKeyId: skid, derHex, kind };
                if (cert.subject) entry.subject = cert.subject;
                cdSigners.push(entry);
            } else {
                const entry: PaaRootEntry = { role: "paa", subjectKeyId: skid, derHex, kind };
                if (cert.subject) entry.subject = cert.subject;
                paaRoots.push(entry);
            }
        }

        const vendors = new Array<VendorEntry>();
        for (const [, info] of vendorService.vendors) {
            const vendor: VendorEntry = {
                vendorId: info.vendorId,
                vendorName: info.vendorName,
                kind: "production",
            };
            if (info.companyLegalName) vendor.companyLegalName = info.companyLegalName;
            if (info.companyPreferredName) vendor.companyPreferredName = info.companyPreferredName;
            if (info.vendorLandingPageUrl) vendor.vendorLandingPageURL = info.vendorLandingPageUrl;
            if (info.creator) vendor.creator = info.creator;
            vendors.push(vendor);
        }

        return { paaRoots, cdSigners, vendors };
    } finally {
        await certService.close();
        await vendorService.close();
    }
}
