![Version](https://img.shields.io/badge/version-0.1.4-blue?style=flat-square)
![Obsidian](https://img.shields.io/badge/obsidian-1.5.0+-7c3aed?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

# Move Completed Tasks

An [Obsidian](https://obsidian.md) plugin that automatically moves completed tasks to the bottom of their checkbox group. Check a box and it sinks out of your way instantly.

## Features

- Moves completed checkboxes to the bottom of their contiguous group
- Subtasks move with their parent as a block
- Brief highlight shows where the task landed (optional)
- Respects indent scoping: subtask completion stays within its parent
- Single undo reverses the move
- Minimal theme alternative checkboxes excluded by default

## Install

**[BRAT](https://github.com/TfTHacker/obsidian42-brat):** Add `aaronpenne/obsidian-move-completed` in BRAT settings.

**Manual:** Download `main.js`, `manifest.json`, `styles.css` from [Releases](https://github.com/aaronpenne/obsidian-move-completed/releases) into `<vault>/.obsidian/plugins/obsidian-move-completed/`.

## Settings

| Option | Default | Description |
|--------|---------|-------------|
| Enable | On | Master toggle |
| Move with subtasks | On | Nested items move as a block |
| Placement | Above completed | Above existing completed items, or bottom of group |
| Excluded characters | `?!*"lbiSIpcfkwud` | Checkbox states that don't trigger a move |
| Highlight moved task | On | Brief visual indicator at the new position |

## How groups work

A "group" is the contiguous run of checkboxes at the same indent level. Groups are bounded by blank lines, headings, code fences, or non-task content. Completing a subtask only reorders it among its siblings, never past its parent.

## Compatibility

- Obsidian 1.5.0+ (Live Preview)
- [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin
- [Minimal](https://github.com/kepano/obsidian-minimal), [AnuPpuccin](https://github.com/AnubisNekworbit/AnuPpuccin), and other themes with custom checkbox states

## Related plugins

- [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) — full task management with dates, recurrence, queries
- [Completed Task Display](https://github.com/heliostatic/completed-task-display) — hides completed tasks via CSS
- [Todo Sort](https://github.com/ryangomba/obsidian-todo-sort) — sorts tasks on file open

## License

[MIT](LICENSE)
