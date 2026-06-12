import { Plugin } from "obsidian";
import { Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { Annotation, EditorSelection, StateEffect, StateField, Text } from "@codemirror/state";
import {
  MoveCompletedSettings,
  DEFAULT_SETTINGS,
  MoveCompletedSettingTab,
} from "./settings";
import { computeReorder, parseCheckbox, isCompleted } from "./reorder";

const reorderAnnotation = Annotation.define<boolean>();
const highlightEffect = StateEffect.define<number>();
const clearHighlightEffect = StateEffect.define<null>();

const highlightDeco = Decoration.line({ class: "move-completed-highlight" });

const highlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(clearHighlightEffect)) {
        return Decoration.none;
      }
      if (e.is(highlightEffect)) {
        return Decoration.set([highlightDeco.range(e.value)]);
      }
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const CHECKBOX_RE = /^(\s*)([-*+])\s+\[(.)\]\s/;

export default class MoveCompletedPlugin extends Plugin {
  settings: MoveCompletedSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MoveCompletedSettingTab(this.app, this));
    this.registerEditorExtension([highlightField, this.createEditorExtension()]);

    this.addCommand({
      id: "move-all-completed-down",
      name: "Move all completed tasks down (scoped)",
      editorCallback: (editor) => {
        const cmView = (editor as any).cm as EditorView;
        if (cmView) this.bulkMoveScoped(cmView);
      },
    });

    this.addCommand({
      id: "collect-completed-to-end",
      name: "Collect all completed tasks to end of document",
      editorCallback: (editor) => {
        const cmView = (editor as any).cm as EditorView;
        if (cmView) this.collectToEnd(cmView);
      },
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private createEditorExtension() {
    const plugin = this;

    return EditorView.updateListener.of((update: ViewUpdate) => {
      if (!plugin.settings.enabled) return;
      if (!update.docChanged) return;

      for (const tr of update.transactions) {
        if (tr.annotation(reorderAnnotation)) continue;

        tr.changes.iterChanges((fromA, _toA, fromB) => {
          const oldLine = update.startState.doc.lineAt(fromA);
          const newLine = update.state.doc.lineAt(fromB);

          const oldMatch = oldLine.text.match(CHECKBOX_RE);
          const newMatch = newLine.text.match(CHECKBOX_RE);

          if (!oldMatch || !newMatch) return;

          const oldStatus = oldMatch[3];
          const newStatus = newMatch[3];

          if (
            oldStatus === " " &&
            newStatus !== " " &&
            !plugin.settings.excludedChars.includes(newStatus)
          ) {
            const lineIndex = newLine.number - 1;
            const view = update.view;
            queueMicrotask(() => plugin.dispatchReorder(view, lineIndex));
          }
        });
      }
    });
  }

  private dispatchReorder(view: EditorView, lineIndex: number) {
    if (!this.settings.enabled) return;

    const doc = view.state.doc;
    const docLines: string[] = [];
    for (let i = 1; i <= doc.lines; i++) {
      docLines.push(doc.line(i).text);
    }

    const currentLine = docLines[lineIndex];
    if (!currentLine) return;

    const parsed = parseCheckbox(currentLine);
    if (!parsed) return;
    if (!isCompleted(parsed.status, this.settings.excludedChars)) return;

    const result = computeReorder(docLines, lineIndex, {
      moveWithSubtasks: this.settings.moveWithSubtasks,
      placement: this.settings.placement,
      excludedChars: this.settings.excludedChars,
    });

    if (!result) return;

    const removed = docLines.splice(
      result.removeFrom,
      result.removeTo - result.removeFrom + 1
    );

    let adjustedInsertAt: number;
    if (result.removeFrom <= result.insertAt) {
      adjustedInsertAt = result.insertAt - removed.length;
    } else {
      adjustedInsertAt = result.insertAt;
    }
    docLines.splice(adjustedInsertAt + 1, 0, ...removed);

    const newText = docLines.join("\n");
    const cursorLineNum = adjustedInsertAt + 2;
    const newDoc = Text.of(newText.split("\n"));
    const cursorLine = newDoc.line(cursorLineNum);

    const effects = this.settings.highlightMove
      ? [highlightEffect.of(cursorLine.from)]
      : [];

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: newText },
      selection: EditorSelection.cursor(cursorLine.from),
      annotations: [reorderAnnotation.of(true)],
      effects,
    });

    if (this.settings.highlightMove) {
      setTimeout(() => {
        view.dispatch({ effects: [clearHighlightEffect.of(null)] });
      }, 2000);
    }
  }

  private bulkMoveScoped(view: EditorView) {
    const doc = view.state.doc;
    let docLines: string[] = [];
    for (let i = 1; i <= doc.lines; i++) {
      docLines.push(doc.line(i).text);
    }

    const settings = {
      moveWithSubtasks: this.settings.moveWithSubtasks,
      placement: this.settings.placement,
      excludedChars: this.settings.excludedChars,
    };

    let changed = true;
    let passes = 0;
    while (changed && passes < 200) {
      changed = false;
      passes++;
      for (let i = docLines.length - 1; i >= 0; i--) {
        const parsed = parseCheckbox(docLines[i]);
        if (!parsed) continue;
        if (!isCompleted(parsed.status, this.settings.excludedChars)) continue;

        const result = computeReorder(docLines, i, settings);
        if (!result) continue;

        const removed = docLines.splice(
          result.removeFrom,
          result.removeTo - result.removeFrom + 1
        );
        let adjustedInsertAt: number;
        if (result.removeFrom <= result.insertAt) {
          adjustedInsertAt = result.insertAt - removed.length;
        } else {
          adjustedInsertAt = result.insertAt;
        }
        docLines.splice(adjustedInsertAt + 1, 0, ...removed);
        changed = true;
        break;
      }
    }

    const newText = docLines.join("\n");
    if (newText === doc.toString()) return;

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: newText },
      annotations: [reorderAnnotation.of(true)],
    });
  }

  private collectToEnd(view: EditorView) {
    const doc = view.state.doc;
    const docLines: string[] = [];
    for (let i = 1; i <= doc.lines; i++) {
      docLines.push(doc.line(i).text);
    }

    const collected: string[] = [];
    const remaining: string[] = [];

    for (let i = 0; i < docLines.length; i++) {
      const parsed = parseCheckbox(docLines[i]);
      if (parsed && isCompleted(parsed.status, this.settings.excludedChars)) {
        collected.push(docLines[i]);
        if (this.settings.moveWithSubtasks) {
          const indent = parsed.indent;
          const baseLevel = indent.length;
          let j = i + 1;
          while (j < docLines.length) {
            const lineIndent = docLines[j].match(/^(\s*)/)?.[1] ?? "";
            if (lineIndent.length <= baseLevel && docLines[j].trim() !== "") break;
            if (docLines[j].trim() === "") break;
            collected.push(docLines[j]);
            j++;
          }
          i = j - 1;
        }
      } else {
        remaining.push(docLines[i]);
      }
    }

    if (collected.length === 0) return;

    while (remaining.length > 0 && remaining[remaining.length - 1].trim() === "") {
      remaining.pop();
    }

    const finalLines = [...remaining, "", "## Completed", "", ...collected];
    const newText = finalLines.join("\n");

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: newText },
      annotations: [reorderAnnotation.of(true)],
    });
  }
}
