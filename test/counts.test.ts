import { expect } from "chai";
import { checkCountTolerance } from "./tools/verify/counts.js";

describe("checkCountTolerance", () => {
    it("passes when count unchanged", () => {
        expect(() => checkCountTolerance("PAA roots", 100, 100)).to.not.throw();
    });

    it("passes when count increases", () => {
        expect(() => checkCountTolerance("PAA roots", 100, 110)).to.not.throw();
    });

    it("passes when drop is exactly 10%", () => {
        expect(() => checkCountTolerance("PAA roots", 100, 90)).to.not.throw();
    });

    it("throws when drop exceeds 10%", () => {
        expect(() => checkCountTolerance("PAA roots", 100, 89)).to.throw(/PAA roots.*89.*100|dropped/i);
    });

    it("throws when all entries disappear", () => {
        expect(() => checkCountTolerance("Vendors", 50, 0)).to.throw(/Vendors/);
    });

    it("passes when previous is 0 (first run, no baseline)", () => {
        expect(() => checkCountTolerance("PAA roots", 0, 5)).to.not.throw();
    });
});
