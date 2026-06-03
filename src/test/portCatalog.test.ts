import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { buildPairPortCatalogEntries, buildQubitPortCatalogEntries } from '../portCatalog.js';
import type { StateJson } from '../stateFile.js';
import type { WiringJson } from '../wiringFile.js';

function loadFixture<T>(filename: string): T {
	const fixturePath = path.join(__dirname, '..', '..', 'quam_state', filename);
	const text = fs.readFileSync(fixturePath, 'utf8');
	return JSON.parse(text) as T;
}

suite('Port catalog', () => {
	const state = loadFixture<StateJson>('state.json');
	const wiring = loadFixture<WiringJson>('wiring.json');

	test('buildQubitPortCatalogEntries includes delay for q1 xy port', () => {
		const entries = buildQubitPortCatalogEntries(state, wiring);
		const delayEntry = entries.find(
			(e) => e.kind === 'port' && e.category === 'xy' && e.parameter === 'delay'
		);
		assert.ok(delayEntry, 'expected port delay entry for xy');
		assert.strictEqual(delayEntry?.opxKey, 'opx_output');
		assert.ok(delayEntry?.byQubit.q1);
		assert.ok(delayEntry?.byQubit.q2);
		const q1Path = delayEntry?.byQubit.q1?.path.join('/');
		const q2Path = delayEntry?.byQubit.q2?.path.join('/');
		assert.notStrictEqual(q1Path, q2Path, 'q1 and q2 xy should map to different ports');
		assert.match(q1Path ?? '', /ports\/mw_outputs\/con1\/6\/2/);
		assert.match(q2Path ?? '', /ports\/mw_outputs\/con1\/6\/3/);
	});

	test('buildPairPortCatalogEntries includes coupler port entries', () => {
		const entries = buildPairPortCatalogEntries(state, wiring);
		const delayEntry = entries.find(
			(e) =>
				e.kind === 'port' &&
				e.category === 'coupler' &&
				e.parameter === 'delay' &&
				e.byPair['coupler_q1_q2']
		);
		assert.ok(delayEntry, 'expected coupler port delay for coupler_q1_q2');
		assert.strictEqual(delayEntry?.portPathLabel, 'analog_outputs/con1/1/6');
	});
});
