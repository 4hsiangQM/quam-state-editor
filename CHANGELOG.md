# Change Log

All notable changes to the "quam-state-editor" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.2] - 2026-06-03

### Added

- **Port location** — third Location option alongside **General** and **Operations** when editing a qubit channel or qubit-pair coupler.
- **Wiring integration** — reads sibling `wiring.json` (same folder as `state.json`) to resolve `opx_input` / `opx_output` → hardware port paths; wiring is read-only in this release.
- **Port parameter editing** — edit numeric port calibration fields in `state.json` (`delay`, `full_scale_power_dbm`, `exponential_filter`, etc.); changes are backed up to `.json.bak` like other edits.
- **Qubit-pair coupler ports** — Port location on the Qubit pair tab under the `coupler` category.
- **Port channel selector** — for `resonator`, choose between `opx_input` and `opx_output` when both are wired.
- **Per-qubit port breadcrumb** — when multiple qubits are selected, shows one line each (e.g. `q1 xy opx_output → mw_outputs/con1/6/2`).
- **Shared-port deduplication** — qubits that map to the same physical port show a single editable row in the Values table.
- Unit tests for port resolution and port catalog building (`portResolver.test.ts`, `portCatalog.test.ts`).

### Changed

- Location labels renamed to **General** / **Operations** (replacing “On category” / “In operation”); location radios hide automatically when only one kind applies for the selected category.
- README updated with Port feature notes and `wiring.json` requirement.
