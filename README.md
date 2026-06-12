# Move completed tasks

An Obsidian plugin that instantly moves a completed task to the bottom of its contiguous checkbox group the moment you check it off.

## Install

### Community plugins (recommended)

1. Open Settings > Community plugins > Browse
2. Search "Move completed tasks"
3. Click Install, then Enable

### Manual install

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder: `<your vault>/.obsidian/plugins/obsidian-move-completed/`
3. Place the downloaded files in that folder
4. Restart Obsidian and enable the plugin in Settings > Community plugins

## How it works

When you mark a task as complete (`- [x]`), the plugin moves it to the bottom of its consecutive checkbox group. The group is the uninterrupted run of checkbox lines at the same indent level, stopping at blank lines, headings, or non-checkbox content.

Subtasks move with their parent. Completing a subtask only reorders it within its siblings (it never escapes its parent's scope).

The move is a single atomic operation: one Ctrl+Z undoes it completely.

### What does not trigger a move

Minimal theme decorator checkboxes are excluded by default. These semantic markers stay in place:

`[?]` question, `[!]` important, `[*]` star, `["]` quote, `[l]` location, `[b]` bookmark, `[i]` information, `[S]` savings, `[I]` idea, `[p]` pros, `[c]` cons, `[f]` fire, `[k]` key, `[w]` win, `[u]` up, `[d]` down

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Enable auto-move | On | Master toggle |
| Move with subtasks | On | Move task and its nested subtasks as a block |
| Placement | Bottom of group | Bottom of group, or above existing completed tasks |
| Excluded characters | `?!*"lbiSIpcfkwud` | Characters that never trigger a move |

## Compatibility

- Works in Live Preview (the default editing mode)
- Compatible with the Tasks plugin (moves happen after done-dates are appended)
- Compatible with Minimal theme and other themes using custom checkbox statuses
