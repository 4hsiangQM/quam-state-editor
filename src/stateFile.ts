import * as vscode from 'vscode';

export interface StateJson {
	qubits?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface StateFileReadResult {
	data: StateJson;
	rawBytes: Uint8Array;
}

export function getStateFileUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
	return vscode.Uri.joinPath(workspaceFolder.uri, 'quam_state', 'state.json');
}

export function getStateBackupUri(workspaceFolder: vscode.WorkspaceFolder): vscode.Uri {
	return vscode.Uri.joinPath(workspaceFolder.uri, 'quam_state', 'state.json.bak');
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
