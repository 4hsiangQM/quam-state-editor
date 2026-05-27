# QuAM State Editor

Edit numeric calibration parameters in QuAM `state.json` from VS Code / Cursor.

## Features

- Webview panel: select qubits, category (including **Qubit property**), operations, and parameters
- Multi-qubit editing: set a different new value per qubit in one apply
- Quick Pick flow (legacy single-qubit editor)
- Backup before write (`<your-file>.json.bak`)
- Choose and remember `state.json` path per workspace

## Usage

1. Open a workspace folder that contains your `state.json` (any path).
2. Command Palette → **QuAM State Editor: Open Panel**
3. On first use, pick your `state.json` file.
4. Select qubit(s), category, parameter, enter new values, **Apply**.

Other commands:

- **QuAM State Editor: Open (Quick Pick)** — step-by-step single edit
- **QuAM State Editor: Select state.json** — change which file to edit

## Requirements

- VS Code / Cursor engine `^1.105.0`
- A valid `state.json` with a `qubits` object

## Development

```bash
npm install
npm run compile
```

Press **F5** (Run Extension) or package with:

```bash
npx @vscode/vsce package
```

Install the `.vsix` via Extensions → Install from VSIX.
