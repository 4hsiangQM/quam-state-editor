import * as vscode from 'vscode';
import { applyParameterEdits } from './apply.js';
import { buildParameterCatalog } from './catalog.js';
import { scanNumericParameters } from './parameterIndex.js';
import {
	getBackupUriForStateFile,
	getWorkspaceStateFileUri,
	promptSelectStateFileUri,
	readStateFile,
} from './stateFile.js';
import { parseFiniteNumber } from './validation.js';
import { QuamStateEditorPanel } from './webview/panel.js';

async function openWithStateFile(
	context: vscode.ExtensionContext,
	folder: vscode.WorkspaceFolder,
	openPanel: boolean
): Promise<void> {
	// Always ask which state.json to open; dialog defaults to the last file for this workspace.
	const lastUri = getWorkspaceStateFileUri(context, folder);
	const stateUri = await promptSelectStateFileUri(context, folder, lastUri);
	if (!stateUri) {
		return;
	}

	if (openPanel) {
		await QuamStateEditorPanel.createOrShow(context.extensionUri, context, folder, stateUri);
	} else {
		await runQuickPickFlow(folder, stateUri);
	}
}

async function runQuickPickFlow(
	folder: vscode.WorkspaceFolder,
	stateUri: vscode.Uri
): Promise<void> {
	const backupUri = getBackupUriForStateFile(stateUri);

	let data;
	let rawBytes: Uint8Array;
	try {
		const read = await readStateFile(stateUri);
		data = read.data;
		rawBytes = read.rawBytes;
	} catch (err) {
		vscode.window.showErrorMessage(
			`Could not read state.json: ${err instanceof Error ? err.message : String(err)}`
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

	const choice = await vscode.window.showWarningMessage(
		`Update ${pathLabel} from ${selected.value} to ${newValue}?`,
		'Apply',
		'Cancel'
	);
	if (choice !== 'Apply') {
		return;
	}

	const catalog = buildParameterCatalog(data);

	const { result } = await applyParameterEdits(stateUri, backupUri, data, rawBytes, catalog, {
		edits: [{ qubit: qubitName, path: selected.path, newValue: String(newValue) }],
	});

	if (result.ok) {
		const action = await vscode.window.showInformationMessage(
			`Updated ${pathLabel}`,
			'Open state.json'
		);
		if (action === 'Open state.json') {
			await vscode.window.showTextDocument(stateUri);
		}
	} else {
		vscode.window.showErrorMessage(result.message ?? `Failed to update state.json.`);
	}
}

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "quam-state-editor" is now active!');

	context.subscriptions.push(
		vscode.commands.registerCommand('quam-state-editor.open', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				vscode.window.showErrorMessage('Open a folder in the workspace first.');
				return;
			}
			await openWithStateFile(context, folder, true);
		}),
		vscode.commands.registerCommand('quam-state-editor.openQuickPick', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				vscode.window.showErrorMessage('Open a folder in the workspace first.');
				return;
			}
			await openWithStateFile(context, folder, false);
		}),
		vscode.commands.registerCommand('quam-state-editor.selectStateFile', async () => {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				vscode.window.showErrorMessage('Open a folder in the workspace first.');
				return;
			}
			const panel = QuamStateEditorPanel.getCurrentPanel();
			const currentUri = panel?.getStateFileUri();
			const stateUri = await promptSelectStateFileUri(context, folder, currentUri);
			if (!stateUri) {
				return;
			}
			if (panel) {
				panel.setStateFile(stateUri);
				await panel.reloadCatalog();
			} else {
				await QuamStateEditorPanel.createOrShow(context.extensionUri, context, folder, stateUri);
			}
		})
	);
}

export function deactivate() {}
