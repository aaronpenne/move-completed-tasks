# Move Completed Tasks

[![GitHub release](https://img.shields.io/github/v/release/aaronpenne/move-completed-tasks?style=flat-square&logo=github)](https://github.com/aaronpenne/move-completed-tasks/releases/latest)
![Obsidian](https://img.shields.io/badge/obsidian-1.5.0+-7c3aed?style=flat-square)
![License](https://img.shields.io/github/license/aaronpenne/move-completed-tasks?style=flat-square)

An [Obsidian](https://obsidian.md) plugin that moves completed tasks to the bottom of the list when you check them off, like Apple Notes, Todoist, and Noteplan.

![Before and after](imgs/before_and_after.png)

It does three things:

1. When you check a task, it drops to the bottom of its list automatically. A highlight flashes so you can see where it went. Ctrl+Z to undo.
2. Two commands let you sort or collect completed tasks across the whole document, if you have a page that's already messy. Both are bindable to hotkeys.
3. Settings for delay before moving, placement within the list, which checkbox characters count as "done", subtask handling, etc.

## Install

**Community plugins:** Settings > Community plugins > Browse, search "Move Completed Tasks", Install, Enable. Or [install directly](https://obsidian.md/plugins?id=move-completed-tasks).

**Manual:** Grab `move-completed-tasks.zip` from the [latest release](https://github.com/aaronpenne/move-completed-tasks/releases/latest), unzip into `<vault>/.obsidian/plugins/`, enable in Settings > Community plugins.

**[BRAT](https://github.com/TfTHacker/obsidian42-brat):** Add `aaronpenne/move-completed-tasks`.

## How it works

A "group" here means any unbroken run of checkboxes at the same indent level. Blank lines, headings, code fences, or non-checkbox content end a group. This matches what the plugin's settings UI calls a group.

Check a task and it moves to the bottom of its group, subtasks and all. The whole operation is one undo step. Subtasks stay with their parent; a nested checkbox never jumps out of its parent list.

## Commands

Open the command palette (Ctrl/Cmd+P) and search "Move completed":

| Command | What it does |
|---------|-------------|
| Move all completed tasks down (scoped) | Goes through every group in the document and pushes completed tasks to the bottom. Handles nesting. Keeps relative order. |
| Collect all completed tasks to end of document | Pulls every completed task out of the body and drops them under a `## Completed` heading at the end of the note. |

Both can be bound to hotkeys in Settings > Hotkeys.

## Settings

| Option | Default | What it does |
|--------|---------|-------------|
| Enable | On | Master toggle for auto-move on check |
| Move with subtasks | On | Move nested items as a block with their parent |
| Placement | Above completed | Where newly completed tasks land: above other completed items, or absolute bottom of the group |
| Excluded characters | `?!*"lbiSIpcfkwud` | Checkbox characters that count as statuses, not completions (Minimal theme decorators by default) |
| Highlight moved task | On | Brief visual flash at the task's new position |
| Move delay | 0s | Seconds to wait before moving (0 = instant). Uncheck before the delay fires to cancel. |

## Theme compatibility

Works with any theme that uses standard markdown checkboxes. Themes like Minimal, AnuPpuccin, and ITS Theme add alternative checkbox states (`[?]` for question, `[!]` for important, etc.), and the excluded characters setting keeps those from being treated as completed. The default exclusion list covers all [Minimal theme](https://github.com/kepano/obsidian-minimal) decorators:

```
[?] question    [!] important   [*] star       ["] quote
[l] location    [b] bookmark    [i] info       [S] savings
[I] idea        [p] pros        [c] cons       [f] fire
[k] key         [w] win         [u] up         [d] down
```

## Related plugins

There are a lot of great task plugins for Obsidian. Here's what else is out there:

- [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks): full task management with dates, recurrence, and queries
- [Completed Task Display](https://github.com/heliostatic/completed-task-display): hides completed tasks with CSS rather than moving them
- [Todo Sort](https://github.com/ryangomba/obsidian-todo-sort): sorts tasks when you open the file
- [Task Mover](https://github.com/thomascherickal/obsidian-task-mover): moves completed tasks to a separate file or heading
- [Archiver](https://github.com/ivan-lednev/obsidian-task-archiver): archives completed tasks to a designated section or separate file
- [To-Do to Done Mover](https://github.com/Quorafind/Obsidian-Todo-Done-Mover): moves done tasks between specific headings
- [DoneDrop](https://github.com/McMasterJoey/DoneDrop-Obsidian-Plugin): drops completed tasks to the bottom of the note
- [Move Completed Tasks Down](https://github.com/optimummost001/move-completed-tasks-down): similar idea with a fixed 5-second delay

## Plugin compatibility

- [Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks): moves happen after Tasks appends completion dates, so timestamps are preserved
- [Dataview](https://github.com/blacksmithgu/obsidian-dataview): no conflicts (Dataview reads, this plugin writes)

## License

[MIT](LICENSE)
