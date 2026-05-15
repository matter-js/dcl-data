export function checkCountTolerance(label: string, previous: number, next: number): void {
    if (previous === 0) return;
    const dropFraction = (previous - next) / previous;
    if (dropFraction > 0.1) {
        throw new Error(
            `${label} count dropped >10%: ${previous} → ${next} (${(dropFraction * 100).toFixed(1)}% drop)`,
        );
    }
}
