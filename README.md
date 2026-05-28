# QuAM State Editor

Edit numeric calibration parameters in QuAM `state.json` from **Cursor** or **VS Code**.

## Features

- **Webview panel**: select qubits or **qubit pairs**, category (including **Qubit property** / **Pair property**), operations, and parameters
- **Multi-entity editing**: set a different new value per qubit or pair in one apply (blank = skip)
- **JSON arrays**: qubit `confusion_matrix` / `gef_confusion_matrix`; pair `flux_values` / `J_vs_flux` — edit as JSON in the Values table
- **1D scalars**: `filter_fir_taps`, `filter_iir_taps` shown as `field[i]`
- Qubit-pair confusion matrices are intentionally excluded (edit in raw JSON if needed)
- **Quick Pick** flow: step-by-step single-qubit edit
- **Backup** before write: creates `<your-file>.json.bak` next to the file you edit
- **Remember `state.json` path** per workspace folder

## Requirements

- [Cursor](https://cursor.com/) or [VS Code](https://code.visualstudio.com/) (engine `^1.105.0`)
- A `state.json` file with a top-level `qubits` object and/or `qubit_pairs` object
- **Node.js 18+** and **npm** — only needed to **build** the `.vsix` installer (not needed for daily use after install)

---

## Part 1 — Build the installer (`.vsix`)

Do this once on the machine where you develop the extension, or download a pre-built `.vsix` if someone shared it with you.

### macOS / Windows (same commands)

Open a terminal in the extension project folder:

```bash
cd path/to/quam-state-editor
npm install
npm run compile
npx @vscode/vsce package --allow-missing-repository
```

When it succeeds, you get:

```text
quam-state-editor-0.0.1.vsix
```

in the project folder.

| Item | Note |
|------|------|
| `npm audit` warnings | Safe to ignore for local dev; they are in test tools, not the shipped extension |
| `LICENSE` warning | Fixed if `LICENSE` exists in the repo |
| `publisher` in `package.json` | Must be an ID like `jackchao`, not a display name with spaces |

---

## Part 2 — Install into Cursor

You only need **one** of the methods below.

### Method A — Command Palette (Mac & Windows)

| | macOS | Windows |
|---|--------|---------|
| Open Command Palette | `Cmd` + `Shift` + `P` | `Ctrl` + `Shift` + `P` |
| Search for | `Install from VSIX` | same |
| Pick | **Extensions: Install from VSIX...** | same |

Then select `quam-state-editor-0.0.1.vsix` and confirm.

Reload the window:

| | macOS | Windows |
|---|--------|---------|
| Reload | `Cmd` + `Shift` + `P` → **Developer: Reload Window** | `Ctrl` + `Shift` + `P` → **Developer: Reload Window** |

> **Tip:** If you do not see **Install from VSIX** in the Extensions panel menu (`⋯`), use Command Palette or Method B/C instead. Newer Cursor builds often hide that menu item.

### Method B — Drag and drop (Mac & Windows)

1. Open the **Extensions** sidebar.
2. Drag `quam-state-editor-0.0.1.vsix` from Finder (Mac) or File Explorer (Windows) into the Extensions panel.
3. Confirm installation, then **Reload Window** (see table above).

### Method C — Terminal / CLI (Mac & Windows)

**macOS**

```bash
# Optional: enable the cursor command (once)
# In Cursor: Cmd+Shift+P → "Shell Command: Install 'cursor' command in PATH"

cursor --install-extension /full/path/to/quam-state-editor-0.0.1.vsix
```

Example:

```bash
cursor --install-extension ~/dev/quam-state-editor/quam-state-editor-0.0.1.vsix
```

**Windows (PowerShell or Command Prompt)**

```powershell
cursor --install-extension C:\Users\YOU\dev\quam-state-editor\quam-state-editor-0.0.1.vsix
```

Use your real path. If `cursor` is not found, install the shell command from Cursor (`Ctrl+Shift+P` → **Shell Command: Install 'cursor' command in PATH**), then open a **new** terminal.

After install, restart Cursor or run **Developer: Reload Window**.

### Verify installation

1. Open **Extensions**.
2. Search for **QuAM State Editor**.
3. It should appear as installed (publisher: `jackchao`).

---

## Part 3 — Use the extension (Mac & Windows)

### 1. Open your experiment project

| | macOS | Windows |
|---|--------|---------|
| Open folder | **File → Open Folder…** | same |

Open the folder that contains (or is near) your `state.json`.  
Do **not** open only a single file — use **Open Folder**.

### 2. Open the editor panel

| | macOS | Windows |
|---|--------|---------|
| Command Palette | `Cmd` + `Shift` + `P` | `Ctrl` + `Shift` + `P` |
| Run | **QuAM State Editor: Open Panel** | same |

Each time you run **Open Panel** (or **Open Quick Pick**), a file dialog lets you choose which `state.json` to load. The dialog **defaults to the last file** you used in this workspace (press Enter to open the same file again, or pick another).

While the panel stays open, use **Reload** for the current file or **Change file…** to switch without closing the panel.

### 3. Edit parameters

Use the **Qubit** or **Qubit pair** tab at the top of the panel.

**Qubit tab**

1. Check one or more **Qubits**.
2. Choose **Category** (`xy`, `resonator`, `z`, or **Qubit property** for fields like `anharmonicity`).
3. For category fields (not Qubit property): choose **Location** → **On category** or **In operation**, then **Parameter** (and **Operation** if needed).
4. Enter **New value** per qubit. **Leave blank to skip** that qubit.
5. Click **Apply** (creates `.bak` backup, then writes JSON).

**Qubit pair tab**

Same flow for `qubit_pairs` (e.g. categories `coupler`, `gates`, `extras`, or **Pair property** for `J2`, `detuning`). Multi-select pairs is supported.

**All tabs**

- **Reload** re-reads the current file from disk.
- **Change file…** switches to a different `state.json`.

### Other commands

| Command | Description |
|---------|-------------|
| **QuAM State Editor: Open Panel** | Main Webview UI (always prompts for `state.json`) |
| **QuAM State Editor: Open (Quick Pick)** | Legacy one-qubit-at-a-time flow |
| **QuAM State Editor: Select state.json** | Pick a different `state.json` for this workspace |

---

## Install into VS Code (optional)

Same `.vsix` works in VS Code:

**macOS**

```bash
code --install-extension /full/path/to/quam-state-editor-0.0.1.vsix
```

**Windows**

```powershell
code --install-extension C:\path\to\quam-state-editor-0.0.1.vsix
```

Or use **Extensions: Install from VSIX...** in the Command Palette.

---

## Update after code changes

1. Bump `version` in `package.json` (e.g. `0.0.2`).
2. Rebuild and package:

   ```bash
   npm run compile
   npx @vscode/vsce package --allow-missing-repository
   ```

3. Install the new `.vsix` again (overwrites the old version).
4. Reload Cursor / VS Code.

---

## Development (F5)

For contributors modifying this repo:

```bash
npm install
npm run compile
```

| | macOS | Windows |
|---|--------|---------|
| Run extension in dev host | Open this folder in Cursor → **F5** (Run Extension) | same |

A second window opens with `[Extension Development Host]` in the title. That window is for **testing the extension**, not for daily calibration edits. For daily use, install the `.vsix` as described above.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Commands not found | Confirm `.vsix` is installed; reload window; use a normal Cursor window (not only the dev host) |
| “Open a folder first” | **File → Open Folder** on your experiment project |
| Category / Parameter resets | Update to latest build; re-install `.vsix` |
| `cursor` / `code` not in PATH | Run **Shell Command: Install … command in PATH** from Command Palette |
| Apply does nothing | Check all new values are valid numbers; one invalid value blocks the whole apply |
| Stuck on one state.json | Run **Open Panel** again to pick a file, or use **Change file…** / **Select state.json** (Reload only refreshes the current file) |

---

## License

MIT — see [LICENSE](LICENSE).
