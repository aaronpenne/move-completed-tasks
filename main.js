var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => MoveCompletedPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  enabled: true,
  moveWithSubtasks: true,
  placement: "bottom",
  excludedChars: '?!*"lbiSIpcfkwud'
};
var MoveCompletedSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Enable auto-move").setDesc("Automatically move completed tasks to the bottom of their group").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
        this.plugin.settings.enabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Move with subtasks").setDesc("Move the task and all its nested subtasks as a block").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.moveWithSubtasks).onChange(async (value) => {
        this.plugin.settings.moveWithSubtasks = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Placement").setDesc("Where to place the newly completed task within its group").addDropdown(
      (dropdown) => dropdown.addOption("bottom", "Bottom of group").addOption("above-completed", "Above existing completed tasks").setValue(this.plugin.settings.placement).onChange(async (value) => {
        this.plugin.settings.placement = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Excluded characters").setDesc(
      "Checkbox characters that never trigger a move (Minimal theme decorators by default)"
    ).addText(
      (text) => text.setPlaceholder('?!*"lbiSIpcfkwud').setValue(this.plugin.settings.excludedChars).onChange(async (value) => {
        this.plugin.settings.excludedChars = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/reorder.ts
var CHECKBOX_RE = /^(\s*)([-*+])\s+\[(.)\]\s/;
var HEADING_RE = /^#{1,6}\s/;
var FENCE_RE = /^(\s*)(```|~~~)/;
var BLOCKQUOTE_RE = /^(\s*>)/;
function parseCheckbox(line) {
  const m = line.match(CHECKBOX_RE);
  if (!m)
    return null;
  return { indent: m[1], status: m[3] };
}
function getIndentLevel(indent) {
  let level = 0;
  for (const ch of indent) {
    level += ch === "	" ? 4 : 1;
  }
  return level;
}
function isGroupBoundary(line) {
  if (line.trim() === "")
    return true;
  if (HEADING_RE.test(line))
    return true;
  if (FENCE_RE.test(line))
    return true;
  if (BLOCKQUOTE_RE.test(line))
    return true;
  return false;
}
function isCompleted(status, excludedChars) {
  if (status === " ")
    return false;
  if (excludedChars.includes(status))
    return false;
  return true;
}
function isInsideFence(docLines, lineIndex) {
  let insideFence = false;
  for (let i = 0; i < lineIndex; i++) {
    if (FENCE_RE.test(docLines[i])) {
      insideFence = !insideFence;
    }
  }
  return insideFence;
}
function buildMovedBlock(docLines, startIndex, targetIndentLevel, settings) {
  var _a, _b;
  const lines = [docLines[startIndex]];
  if (settings.moveWithSubtasks) {
    for (let i = startIndex + 1; i < docLines.length; i++) {
      const l = docLines[i];
      if (l.trim() === "")
        break;
      const lineIndent = getIndentLevel((_b = (_a = l.match(/^(\s*)/)) == null ? void 0 : _a[1]) != null ? _b : "");
      if (lineIndent <= targetIndentLevel)
        break;
      lines.push(l);
    }
  }
  return { from: startIndex, lines };
}
function findSiblingGroup(docLines, startIndex, targetIndentLevel, settings) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const siblings = [];
  const completedBlock = buildMovedBlock(docLines, startIndex, targetIndentLevel, settings);
  const completedBlockEnd = startIndex + completedBlock.lines.length - 1;
  siblings.push({ lineIndex: startIndex, blockEnd: completedBlockEnd });
  let i = startIndex - 1;
  while (i >= 0) {
    const l = docLines[i];
    if (isGroupBoundary(l))
      break;
    const p = parseCheckbox(l);
    if (p && getIndentLevel(p.indent) === targetIndentLevel) {
      let subEnd = i;
      for (let j = i + 1; j < startIndex; j++) {
        const subLine = docLines[j];
        if (subLine.trim() === "")
          break;
        const subIndent = getIndentLevel((_b = (_a = subLine.match(/^(\s*)/)) == null ? void 0 : _a[1]) != null ? _b : "");
        if (subIndent <= targetIndentLevel)
          break;
        subEnd = j;
      }
      siblings.unshift({ lineIndex: i, blockEnd: subEnd });
      i--;
    } else if (p && getIndentLevel(p.indent) > targetIndentLevel) {
      i--;
    } else if (!p) {
      const lineIndent = getIndentLevel((_d = (_c = l.match(/^(\s*)/)) == null ? void 0 : _c[1]) != null ? _d : "");
      if (lineIndent <= targetIndentLevel)
        break;
      i--;
    } else {
      break;
    }
  }
  i = completedBlockEnd + 1;
  while (i < docLines.length) {
    const l = docLines[i];
    if (isGroupBoundary(l))
      break;
    const p = parseCheckbox(l);
    if (p && getIndentLevel(p.indent) === targetIndentLevel) {
      let subEnd = i;
      for (let j = i + 1; j < docLines.length; j++) {
        const subLine = docLines[j];
        if (subLine.trim() === "")
          break;
        const subIndent = getIndentLevel((_f = (_e = subLine.match(/^(\s*)/)) == null ? void 0 : _e[1]) != null ? _f : "");
        if (subIndent <= targetIndentLevel)
          break;
        subEnd = j;
      }
      siblings.push({ lineIndex: i, blockEnd: subEnd });
      i = subEnd + 1;
    } else if (p && getIndentLevel(p.indent) > targetIndentLevel) {
      i++;
    } else if (!p) {
      const lineIndent = getIndentLevel((_h = (_g = l.match(/^(\s*)/)) == null ? void 0 : _g[1]) != null ? _h : "");
      if (lineIndent <= targetIndentLevel)
        break;
      i++;
    } else {
      break;
    }
  }
  return siblings;
}
function computeInsertionPoint(docLines, group, _targetIndentLevel, settings) {
  if (group.length === 0)
    return -1;
  if (settings.placement === "bottom") {
    return group[group.length - 1].blockEnd;
  }
  let insertIdx = group.length - 1;
  while (insertIdx > 0) {
    const sibling = group[insertIdx];
    const siblingLine = docLines[sibling.lineIndex];
    const p = parseCheckbox(siblingLine);
    if (p && isCompleted(p.status, settings.excludedChars)) {
      insertIdx--;
    } else {
      break;
    }
  }
  return group[insertIdx].blockEnd;
}
function computeReorder(docLines, completedLineIndex, settings) {
  const line = docLines[completedLineIndex];
  if (line === void 0)
    return null;
  if (isInsideFence(docLines, completedLineIndex))
    return null;
  const parsed = parseCheckbox(line);
  if (!parsed)
    return null;
  if (!isCompleted(parsed.status, settings.excludedChars))
    return null;
  const targetIndentLevel = getIndentLevel(parsed.indent);
  const movedBlock = buildMovedBlock(docLines, completedLineIndex, targetIndentLevel, settings);
  const group = findSiblingGroup(docLines, completedLineIndex, targetIndentLevel, settings);
  const insertAt = computeInsertionPoint(docLines, group, targetIndentLevel, settings);
  const movedBlockEnd = movedBlock.from + movedBlock.lines.length - 1;
  if (insertAt === movedBlockEnd)
    return null;
  if (insertAt === movedBlock.from - 1)
    return null;
  if (group.length <= 1)
    return null;
  return {
    removeFrom: movedBlock.from,
    removeTo: movedBlock.from + movedBlock.lines.length - 1,
    insertAt,
    lines: movedBlock.lines
  };
}

// src/main.ts
var reorderAnnotation = import_state.Annotation.define();
var highlightEffect = import_state.StateEffect.define();
var clearHighlightEffect = import_state.StateEffect.define();
var highlightDeco = import_view.Decoration.line({ class: "move-completed-highlight" });
var highlightField = import_state.StateField.define({
  create() {
    return import_view.Decoration.none;
  },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(clearHighlightEffect)) {
        return import_view.Decoration.none;
      }
      if (e.is(highlightEffect)) {
        return import_view.Decoration.set([highlightDeco.range(e.value)]);
      }
    }
    return decos;
  },
  provide: (f) => import_view.EditorView.decorations.from(f)
});
var CHECKBOX_RE2 = /^(\s*)([-*+])\s+\[(.)\]\s/;
var MoveCompletedPlugin = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MoveCompletedSettingTab(this.app, this));
    this.registerEditorExtension([highlightField, this.createEditorExtension()]);
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  createEditorExtension() {
    const plugin = this;
    return import_view.EditorView.updateListener.of((update) => {
      if (!plugin.settings.enabled)
        return;
      if (!update.docChanged)
        return;
      for (const tr of update.transactions) {
        if (tr.annotation(reorderAnnotation))
          continue;
        tr.changes.iterChanges((fromA, _toA, fromB) => {
          const oldLine = update.startState.doc.lineAt(fromA);
          const newLine = update.state.doc.lineAt(fromB);
          const oldMatch = oldLine.text.match(CHECKBOX_RE2);
          const newMatch = newLine.text.match(CHECKBOX_RE2);
          if (!oldMatch || !newMatch)
            return;
          const oldStatus = oldMatch[3];
          const newStatus = newMatch[3];
          if (oldStatus === " " && newStatus !== " " && !plugin.settings.excludedChars.includes(newStatus)) {
            const lineIndex = newLine.number - 1;
            const view = update.view;
            queueMicrotask(() => plugin.dispatchReorder(view, lineIndex));
          }
        });
      }
    });
  }
  dispatchReorder(view, lineIndex) {
    if (!this.settings.enabled)
      return;
    const doc = view.state.doc;
    const docLines = [];
    for (let i = 1; i <= doc.lines; i++) {
      docLines.push(doc.line(i).text);
    }
    const currentLine = docLines[lineIndex];
    if (!currentLine)
      return;
    const parsed = parseCheckbox(currentLine);
    if (!parsed)
      return;
    if (!isCompleted(parsed.status, this.settings.excludedChars))
      return;
    const result = computeReorder(docLines, lineIndex, {
      moveWithSubtasks: this.settings.moveWithSubtasks,
      placement: this.settings.placement,
      excludedChars: this.settings.excludedChars
    });
    if (!result)
      return;
    const removed = docLines.splice(
      result.removeFrom,
      result.removeTo - result.removeFrom + 1
    );
    let adjustedInsertAt;
    if (result.removeFrom <= result.insertAt) {
      adjustedInsertAt = result.insertAt - removed.length;
    } else {
      adjustedInsertAt = result.insertAt;
    }
    docLines.splice(adjustedInsertAt + 1, 0, ...removed);
    const newText = docLines.join("\n");
    const cursorLineNum = adjustedInsertAt + 2;
    const newDoc = import_state.Text.of(newText.split("\n"));
    const cursorLine = newDoc.line(cursorLineNum);
    view.dispatch({
      changes: { from: 0, to: doc.length, insert: newText },
      selection: import_state.EditorSelection.cursor(cursorLine.from),
      annotations: [reorderAnnotation.of(true)],
      effects: [highlightEffect.of(cursorLine.from)]
    });
    setTimeout(() => {
      view.dispatch({ effects: [clearHighlightEffect.of(null)] });
    }, 600);
  }
};
