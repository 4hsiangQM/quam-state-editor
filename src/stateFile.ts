import * as vscode from 'vscode';

const STATE_FILE_URI_KEY = 'quamStateEditor.stateFileUri';

export interface StateJson {
	qubits?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface StateFileReadResult {
	data: StateJson;
	rawBytes: Uint8Array;
}

function workspaceStorageKey(workspaceFolder: vscode.WorkspaceFolder): string {
	return `${STATE_FILE_URI_KEY}:${workspaceFolder.uri.toString()}`;
}

export function getDefaultStateFileUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
	return vscode.Uri.joinPath(workspaceFolder.uri, 'quam_state', 'state.json');
}

export function getBackupUriForStateFile(stateUri: vscode.Uri): vscode.Uri {
	return vscode.Uri.file(`${stateUri.fsPath}.bak`);
}

function getSavedStateFileUri(
	context: vscode.ExtensionContext,
	workspaceFolder: vscode.WorkspaceFolder
): vscode.Uri | undefined {
	const stored = context.workspaceState.get<string>(workspaceStorageKey(workspaceFolder));
	if (!stored) {
		return undefined;
	}
	return vscode.Uri.parse(stored);
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch {
		return false;
	}
}

async function saveStateFileUri(
	context: vscode.ExtensionContext,
	workspaceFolder: vscode.WorkspaceFolder,
	stateUri: vscode.Uri
): Promise<void> {
	await context.workspaceState.update(workspaceStorageKey(workspaceFolder), stateUri.toString());
}

/** Ask the user to pick state.json and remember it for this workspace. */
export async function promptSelectStateFileUri(
	context: vscode.ExtensionContext,
	workspaceFolder: vscode.WorkspaceFolder
): Promise<vscode.Uri | undefined> {
	const defaultUri = getDefaultStateFileUri(workspaceFolder);
	const dialogDefault = (await uriExists(defaultUri)) ? defaultUri : workspaceFolder.uri;

	const picked = await vscode.window.showOpenDialog({
		title: 'Select state.json',
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		openLabel: 'Select state.json',
		filters: { JSON: ['json'] },
		defaultUri: dialogDefault,
	});

	if (!picked?.[0]) {
		return undefined;
	}

	await saveStateFileUri(context, workspaceFolder, picked[0]);
	return picked[0];
}

/**
 * Return the workspace state.json path, prompting on first use or if the saved file is missing.
 */
export async function resolveStateFileUri(
	context: vscode.ExtensionContext,
	workspaceFolder: vscode.WorkspaceFolder
): Promise<vscode.Uri | undefined> {
	const saved = getSavedStateFileUri(context, workspaceFolder);
	if (saved && (await uriExists(saved))) {
		return saved;
	}

	if (saved && !(await uriExists(saved))) {
		const choice = await vscode.window.showWarningMessage(
			`Saved state.json not found:\n${saved.fsPath}`,
			'Choose another file',
			'Cancel'
		);
		if (choice !== 'Choose another file') {
			return undefined;
		}
	}

	return promptSelectStateFileUri(context, workspaceFolder);
}

export function formatStateFilePath(stateUri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder): string {
	const relative = vscode.workspace.asRelativePath(stateUri, false);
	if (relative && !relative.startsWith('/') && !relative.includes(':\\')) {
		return relative;
	}
	return stateUri.fsPath;
}

export async function readStateFile(uri: vscode.Uri): Promise<StateFileReadResult> {
	const rawBytes = await vscode.workspace.fs.readFile(uri);
	const text = new TextDecoder().decode(rawBytes);
	const data = JSON.parse(text) as StateJson;
	return { data, rawBytes };
}

export async function writeStateBackup(backupUri: vscode.Uri, rawBytes: Uint8Array): Promise<void> {
	await vscode.workspace.fs.writeFile(backupUri, rawBytes);
}

export async function writeStateFile(uri: vscode.Uri, data: StateJson): Promise<void> {
	const output = new TextEncoder().encode(JSON.stringify(data, null, 2));
	await vscode.workspace.fs.writeFile(uri, output);
}
