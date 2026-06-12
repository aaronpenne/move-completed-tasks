import { computeReorder, ReorderSettings } from "./reorder";

const DEFAULT_TEST_SETTINGS: ReorderSettings = {
  moveWithSubtasks: true,
  placement: "bottom",
  excludedChars: '?!*"lbiSIpcfkwud',
};

describe("parseCheckbox", () => {
  it("recognizes - [ ] as incomplete checkbox", () => {
    const lines = ["- [x] task one", "- [ ] task two"];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).not.toBeNull();
  });

  it("recognizes * [x] as complete checkbox", () => {
    const lines = ["* [x] task one", "* [ ] task two", "* [ ] task three"];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).not.toBeNull();
  });

  it("recognizes + [X] as complete checkbox", () => {
    const lines = ["+ [X] task one", "+ [ ] task two"];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).not.toBeNull();
  });

  it("does not trigger for excluded decorator characters", () => {
    const excluded = '?!*"lbiSIpcfkwud';
    for (const ch of excluded) {
      const lines = [`- [${ch}] task one`, "- [ ] task two"];
      const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
      expect(result).toBeNull();
    }
  });

  it("respects custom excluded characters", () => {
    const settings: ReorderSettings = {
      ...DEFAULT_TEST_SETTINGS,
      excludedChars: "x",
    };
    const lines = ["- [x] task one", "- [ ] task two"];
    const result = computeReorder(lines, 0, settings);
    expect(result).toBeNull();
  });

  it("non-checkbox lines are not treated as tasks", () => {
    const lines = ["- [x] task one", "some plain text", "- [ ] task two"];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toBeNull();
  });
});

describe("computeReorder - bottom placement", () => {
  it("moves completed task to bottom of group", () => {
    const lines = [
      "- [x] done task",
      "- [ ] task two",
      "- [ ] task three",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 2,
      lines: ["- [x] done task"],
    });
  });

  it("moves completed task from middle to bottom", () => {
    const lines = [
      "- [ ] task one",
      "- [x] done task",
      "- [ ] task three",
    ];
    const result = computeReorder(lines, 1, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 1,
      removeTo: 1,
      insertAt: 2,
      lines: ["- [x] done task"],
    });
  });

  it("no-op when task already at bottom", () => {
    const lines = [
      "- [ ] task one",
      "- [ ] task two",
      "- [x] done task",
    ];
    const result = computeReorder(lines, 2, DEFAULT_TEST_SETTINGS);
    expect(result).toBeNull();
  });

  it("no-op for group of one", () => {
    const lines = ["- [x] only task"];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toBeNull();
  });

  it("group stops at blank line", () => {
    const lines = [
      "- [x] done task",
      "- [ ] task two",
      "",
      "- [ ] task in different group",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 1,
      lines: ["- [x] done task"],
    });
  });

  it("group stops at heading", () => {
    const lines = [
      "- [x] done task",
      "- [ ] task two",
      "## New section",
      "- [ ] task under heading",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 1,
      lines: ["- [x] done task"],
    });
  });

  it("group stops at code fence", () => {
    const lines = [
      "- [x] done task",
      "- [ ] task two",
      "```",
      "- [ ] not a real task",
      "```",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 1,
      lines: ["- [x] done task"],
    });
  });

  it("group stops at blockquote", () => {
    const lines = [
      "- [x] done task",
      "- [ ] task two",
      "> some quote",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 1,
      lines: ["- [x] done task"],
    });
  });
});

describe("computeReorder - subtasks", () => {
  it("moves parent with its subtasks as a block", () => {
    const lines = [
      "- [x] parent done",
      "  - [ ] child one",
      "  - [ ] child two",
      "- [ ] sibling task",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 2,
      insertAt: 3,
      lines: ["- [x] parent done", "  - [ ] child one", "  - [ ] child two"],
    });
  });

  it("moves only the line when moveWithSubtasks is false", () => {
    const lines = [
      "- [x] parent done",
      "  - [ ] child one",
      "  - [ ] child two",
      "- [ ] sibling task",
    ];
    const settings: ReorderSettings = {
      ...DEFAULT_TEST_SETTINGS,
      moveWithSubtasks: false,
    };
    const result = computeReorder(lines, 0, settings);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 3,
      lines: ["- [x] parent done"],
    });
  });

  it("subtask completion stays scoped within parent", () => {
    const lines = [
      "- [ ] parent task",
      "  - [x] subtask done",
      "  - [ ] subtask two",
      "  - [ ] subtask three",
      "- [ ] another parent",
    ];
    const result = computeReorder(lines, 1, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 1,
      removeTo: 1,
      insertAt: 3,
      lines: ["  - [x] subtask done"],
    });
  });

  it("subtask never escapes its parent scope", () => {
    const lines = [
      "- [ ] parent task",
      "  - [x] subtask done",
      "  - [ ] subtask two",
      "- [ ] another parent",
    ];
    const result = computeReorder(lines, 1, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 1,
      removeTo: 1,
      insertAt: 2,
      lines: ["  - [x] subtask done"],
    });
  });

  it("handles deeply nested subtasks", () => {
    const lines = [
      "- [ ] parent",
      "  - [x] sub done",
      "    - [ ] sub-sub one",
      "  - [ ] sub two",
    ];
    const result = computeReorder(lines, 1, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 1,
      removeTo: 2,
      insertAt: 3,
      lines: ["  - [x] sub done", "    - [ ] sub-sub one"],
    });
  });
});

describe("computeReorder - mixed indent levels", () => {
  it("does not mix indent scopes", () => {
    const lines = [
      "- [ ] top level one",
      "  - [x] nested done",
      "  - [ ] nested two",
      "- [ ] top level two",
    ];
    const result = computeReorder(lines, 1, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 1,
      removeTo: 1,
      insertAt: 2,
      lines: ["  - [x] nested done"],
    });
  });

  it("tabs work as indent", () => {
    const lines = [
      "- [x] done task",
      "\t- [ ] child",
      "- [ ] sibling",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 1,
      insertAt: 2,
      lines: ["- [x] done task", "\t- [ ] child"],
    });
  });
});
