import { Editor, Plugin } from "obsidian";
import { Decoration, DecorationSet, EditorView, ViewUpdate } from "@codemirror/view";
import { Annotation, EditorSelection, StateEffect, StateField, Text } from "@codemirror/state";
import {
  MoveCompletedSettings,
  DEFAULT_SETTINGS,
  MoveCompletedSettingTab,
} from "./settings";
import { computeReorder, parseCheckbox, isCompleted, partitionGroups, collectCompleted } from "./reorder";

interface EditorWithCm extends Editor {
  cm: EditorView;
}

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
        const cmView = (editor as EditorWithCm).cm;
        if (cmView) this.bulkMoveScoped(cmView);
      },
    });

    this.addCommand({
      id: "collect-completed-to-end",
      name: "Collect all completed tasks to end of document",
      editorCallback: (editor) => {
        const cmView = (editor as EditorWithCm).cm;
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
    return EditorView.updateListener.of((update: ViewUpdate) => {
      if (!this.settings.enabled) return;
      if (!update.docChanged) return;

      for (const tr of update.transactions) {
        if (tr.annotation(reorderAnnotation)) continue;

        tr.changes.iterChanges((fromA, _toA, fromB) => {
          const oldLine = update.startState.doc.lineAt(fromA);
          const newLine = update.state.doc.lineAt(fromB);

          const oldParsed = parseCheckbox(oldLine.text);
          const newParsed = parseCheckbox(newLine.text);

          if (!oldParsed || !newParsed) return;

          if (
            oldParsed.status === " " &&
            newParsed.status !== " " &&
            !this.settings.excludedChars.includes(newParsed.status)
          ) {
            const lineIndex = newLine.number - 1;
            const view = update.view;
            queueMicrotask(() => this.dispatchReorder(view, lineIndex));
          }
        });
      }
    });
  }

  private getDocLines(view: EditorView): string[] {
    const doc = view.state.doc;
    const lines: string[] = [];
    for (let i = 1; i <= doc.lines; i++) {
      lines.push(doc.line(i).text);
    }
    return lines;
  }

  private dispatchReorder(view: EditorView, lineIndex: number) {
    if (!this.settings.enabled) return;

    const doc = view.state.doc;
    const docLines = this.getDocLines(view);

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
      window.setTimeout(() => {
        view.dispatch({ effects: [clearHighlightEffect.of(null)] });
      }, 2000);
    }
  }

  private bulkMoveScoped(view: EditorView) {
    const doc = view.state.doc;
    const lines = this.getDocLines(view);
    const result = partitionGroups(lines, this.settings);
    const newText = result.join("\n");
    if (newText === doc.toString()) return;

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: newText },
      annotations: [reorderAnnotation.of(true)],
    });
  }

  private collectToEnd(view: EditorView) {
    const doc = view.state.doc;
    const lines = this.getDocLines(view);
    const result = collectCompleted(lines, this.settings);
    const newText = result.join("\n");
    if (newText === doc.toString()) return;

    view.dispatch({
      changes: { from: 0, to: doc.length, insert: newText },
      annotations: [reorderAnnotation.of(true)],
    });
  }
}
