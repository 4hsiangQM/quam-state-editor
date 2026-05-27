export function parseFiniteNumber(input: string): number | undefined {
	const trimmed = input.trim();
	if (trimmed === '') {
		return undefined;
	}
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : undefined;
}
