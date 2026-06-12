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
}
