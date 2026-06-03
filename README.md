# QuAM State Editor

Edit numeric calibration parameters in QuAM `state.json` from **Cursor** or **VS Code**.

## Features

- **Webview panel**: select qubits or **qubit pairs**, category (including **Qubit property** / **Pair property**), **General** / **Operations** / **Port** location, and parameters
- **Port location**: resolve channel → hardware port via sibling `wiring.json` (read-only); edit port calibration fields in `state.json` (`delay`, `full_scale_power_dbm`, `exponential_filter`, etc.)
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
- For **Port** location: `wiring.json` in the same folder as `state.json` (e.g. `quam_state/wiring.json`)
- **Node.js 18+** and **npm** — only needed to **build** the `.vsix` installer (not needed for daily use after install)

---

## Part 1 — Build the installer (`.vsix`)

Do this once on the machine where you develop the extension, or download a pre-built `.vsix` if someone shared it with you.

### Install Node.js and npm (if needed)

`npm` comes with **Node.js**. You only need this step to **build** the `.vsix`; skip it if someone already gave you a `.vsix` file.

Check whether they are already installed:

```bash
node -v
npm -v
```

If both commands print a version (Node **18 or newer**), you are ready — go to [Build commands](#macos--windows-same-commands) below.

If you see `command not found` (or similar), install Node.js:

| Platform | How to install |
|----------|----------------|
| **macOS** | **Homebrew** (recommended): `brew install node` — or download the **LTS** installer from [nodejs.org](https://nodejs.org/) |
| **Windows** | Download the **LTS** installer from [nodejs.org](https://nodejs.org/) (includes npm), or in PowerShell: `winget install OpenJS.NodeJS.LTS` |

After installing, **open a new terminal** and run `node -v` and `npm -v` again to confirm.

### macOS / Windows (same commands)

Open a terminal in the extension project folder:

```bash
cd path/to/quam-state-editor
npm install
npm run compile
npx @vscode/vsce package --allow-missing-repository
```

After `npm install`, you may see something like `4 vulnerabilities (2 low, 1 moderate, 1 high)`. **You can ignore this and continue** — those warnings come from dev/test dependencies, not from the code that goes into the `.vsix`. Do **not** run `npm audit fix --force` unless you know you need it; just proceed with `npm run compile` and packaging.

When it succeeds, you get:

```text
quam-state-editor-0.0.1.vsix
```

in the project folder.

| Item | Note |
|------|------|
| `npm audit` / vulnerabilities after `npm install` | Safe to ignore — continue with compile and package; do not run `npm audit fix --force` unless you intend to upgrade dev deps |
| `LICENSE` warning | Fixed if `LICENSE` exists in the repo |
| `publisher` in `package.json` | Must be an ID like `jackchao`, not a display name with spaces |

---

## Part 2 — Install into Cursor

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

> **Tip:** If you do not see **Install from VSIX** in the Extensions panel menu (`⋯`), use the Command Palette instead. Newer Cursor builds often hide that menu item.

### Verify installation

1. Open **Extensions**.
2. Search for **QuAM State Editor**.
3. It should appear as installed (publisher: `jackchao`).

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

## License

MIT — see [LICENSE](LICENSE).
