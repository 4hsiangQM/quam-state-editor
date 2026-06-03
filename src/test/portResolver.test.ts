import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import {
	pairNameToWiringId,
	resolvePortForPairCoupler,
	resolvePortsForQubitChannel,
	stateCategoryToWiringChannel,
} from '../portResolver.js';
import { portObjectPathLabelFromParameterPath } from '../jsonPointer.js';
import type { StateJson } from '../stateFile.js';
import type { WiringJson } from '../wiringFile.js';

function loadFixture<T>(filename: string): T {
	const fixturePath = path.join(__dirname, '..', '..', 'quam_state', filename);
	const text = fs.readFileSync(fixturePath, 'utf8');
	return JSON.parse(text) as T;
}

suite('Port resolver', () => {
	const state = loadFixture<StateJson>('state.json');
	const wiring = loadFixture<WiringJson>('wiring.json');

	test('stateCategoryToWiringChannel maps resonator to rr', () => {
		assert.strictEqual(stateCategoryToWiringChannel('resonator'), 'rr');
		assert.strictEqual(stateCategoryToWiringChannel('xy'), 'xy');
	});

	test('pairNameToWiringId maps coupler_q1_q2 to q1-2', () => {
		assert.strictEqual(pairNameToWiringId('coupler_q1_q2'), 'q1-2');
		assert.strictEqual(pairNameToWiringId('other_pair'), null);
	});

	test('resolvePortsForQubitChannel xy opx_output', () => {
		const result = resolvePortsForQubitChannel(state, wiring, 'q1', 'xy');
		assert.strictEqual(result.ok, true);
		if (!result.ok) {
			return;
		}
		assert.strictEqual(result.links.length, 1);
		assert.strictEqual(result.links[0].opxKey, 'opx_output');
		assert.deepStrictEqual(result.links[0].portPath, [
			'ports',
			'mw_outputs',
			'con1',
			'6',
			'2',
		]);
		assert.strictEqual(result.links[0].portPathLabel, 'mw_outputs/con1/6/2');
	});

	test('resolvePortsForQubitChannel resonator has input and output', () => {
		const result = resolvePortsForQubitChannel(state, wiring, 'q1', 'resonator');
		assert.strictEqual(result.ok, true);
		if (!result.ok) {
			return;
		}
		assert.strictEqual(result.links.length, 2);
		const keys = result.links.map((link) => link.opxKey).sort();
		assert.deepStrictEqual(keys, ['opx_input', 'opx_output']);
	});

	test('resolvePortForPairCoupler coupler_q1_q2', () => {
		const result = resolvePortForPairCoupler(state, wiring, 'coupler_q1_q2');
		assert.strictEqual(result.ok, true);
		if (!result.ok) {
			return;
		}
		assert.strictEqual(result.links.length, 1);
		assert.deepStrictEqual(result.links[0].portPath, [
			'ports',
			'analog_outputs',
			'con1',
			'1',
			'6',
		]);
	});

	test('missing wiring returns error', () => {
		const result = resolvePortsForQubitChannel(state, undefined, 'q1', 'xy');
		assert.strictEqual(result.ok, false);
		if (result.ok) {
			return;
		}
		assert.match(result.error, /wiring/i);
	});

	test('portObjectPathLabelFromParameterPath strips parameter tail', () => {
		assert.strictEqual(
			portObjectPathLabelFromParameterPath([
				'ports',
				'analog_outputs',
				'con1',
				'1',
				'1',
				'delay',
			]),
			'analog_outputs/con1/1/1'
		);
	});
});
