import * as vscode from 'vscode';

/** Minimal shape we need from state.json */
interface StateJson {
	qubits?: Record<string, unknown>;
}

interface NumericParameter {
	label: string;
	path: string[];
	value: number;
}

const IGNORED_KEYS = new Set([
	'__class__',
	'id',
	'macros',
	'core',
	'opx_input',
	'opx_output',
]);

/**
 * Recursively collect numeric leaf values under one qubit object.
 * Paths are rooted at ["qubits", qubitName, ...].
 */
function scanNumericParameters(qubitName: string, qubit: unknown): NumericParameter[] {
	const results: NumericParameter[] = [];
	const basePath = ['qubits', qubitName];

	function visit(node: unknown, pathFromQubit: string[]): void {
		if (typeof node === 'number') {
			const relative = pathFromQubit.join('.');
			results.push({
				label: `${relative} = ${node}`,
				path: [...basePath, ...pathFromQubit],
				value: node,
			});
			return;
		}

		if (node === null || typeof node !== 'object' || Array.isArray(node)) {
			return;
		}

		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			if (IGNORED_KEYS.has(key)) {
				continue;
			}
			visit(value, [...pathFromQubit, key]);
		}
	}

	visit(qubit, []);
	return results.sort((a, b) => a.label.localeCompare(b.label));
}

function parseFiniteNumber(input: string): number | undefined {
	const trimmed = input.trim();
	if (trimmed === '') {
		return undefined;
	}
	const n = Number(trimmed);
	return Number.isFinite(n) ? n : undefined;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "quam-state-editor" is now active!');

	const disposable = vscode.commands.registerCommand('quam-state-editor.open', async () => {
		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			vscode.window.showErrorMessage('Open a folder in the workspace first.');
			return;
		}

		const stateUri = vscode.Uri.joinPath(folder.uri, 'quam_state', 'state.json');

		let data: StateJson;
		try {
			const bytes = await vscode.workspace.fs.readFile(stateUri);
			const text = new TextDecoder().decode(bytes);
			data = JSON.parse(text) as StateJson;
		} catch (err) {
			vscode.window.showErrorMessage(
				`Could not read quam_state/state.json: ${err instanceof Error ? err.message : String(err)}`
			);
			return;
		}

		if (!data.qubits || typeof data.qubits !== 'object') {
			vscode.window.showErrorMessage('state.json has no "qubits" object.');
			return;
		}

		const qubitNames = Object.keys(data.qubits);
		if (qubitNames.length === 0) {
			vscode.window.showWarningMessage('No qubits found in state.json.');
			return;
		}

		const qubitName = await vscode.window.showQuickPick(qubitNames, {
			placeHolder: 'Select a qubit',
		});
		if (qubitName === undefined) {
			return;
		}

		const parameters = scanNumericParameters(qubitName, data.qubits[qubitName]);
		if (parameters.length === 0) {
			vscode.window.showWarningMessage(`No numeric parameters found for qubit "${qubitName}".`);
			return;
		}

		const selected = await vscode.window.showQuickPick(parameters, {
			placeHolder: 'Select a parameter',
		});
		if (selected === undefined) {
			return;
		}

		const pathLabel = selected.path.join('.');
		const input = await vscode.window.showInputBox({
			title: 'Edit parameter',
			prompt: pathLabel,
			value: String(selected.value),
			validateInput: (text) =>
				parseFiniteNumber(text) === undefined ? 'Enter a finite number.' : undefined,
		});
		if (input === undefined) {
			return;
		}

		const newValue = parseFiniteNumber(input);
		if (newValue === undefined) {
			vscode.window.showErrorMessage('Enter a finite number.');
			return;
		}

		vscode.window.showInformationMessage(
			`Would update ${pathLabel} from ${selected.value} to ${newValue}`
		);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
