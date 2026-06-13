import {
  computeReorder,
  ReorderSettings,
  partitionGroups,
  collectCompleted,
  isInsideFence,
  getIndentLevel,
  isGroupBoundary,
  hasOpenParent,
} from "./reorder";

const DEFAULT_TEST_SETTINGS: ReorderSettings = {
  moveWithSubtasks: true,
  placement: "bottom",
  excludedChars: '?!*"lbiSIpcfkwud',
  completedHeading: "Completed",
  skipSubtasksWithOpenParent: false,
  sectionAwareCollection: false,
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

  it("recognizes 1. [x] ordered list checkbox", () => {
    const lines = ["1. [x] task one", "2. [ ] task two", "3. [ ] task three"];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).not.toBeNull();
  });

  it("recognizes multi-digit ordered list 10. [X] checkbox", () => {
    const lines = ["10. [X] done", "11. [ ] pending"];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).not.toBeNull();
  });

  it("moves ordered list completed task to bottom", () => {
    const lines = ["1. [x] done", "2. [ ] pending", "3. [ ] also pending"];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).not.toBeNull();
    expect(result!.insertAt).toBe(2);
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

describe("computeReorder - above-completed placement", () => {
  const aboveSettings: ReorderSettings = {
    ...DEFAULT_TEST_SETTINGS,
    placement: "above-completed",
  };

  it("places newly completed task above existing completed tasks", () => {
    const lines = [
      "- [x] newly done",
      "- [ ] incomplete",
      "- [x] previously done",
    ];
    const result = computeReorder(lines, 0, aboveSettings);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 1,
      lines: ["- [x] newly done"],
    });
  });

  it("places after last incomplete when multiple completed at end", () => {
    const lines = [
      "- [x] newly done",
      "- [ ] incomplete one",
      "- [ ] incomplete two",
      "- [x] old done one",
      "- [x] old done two",
    ];
    const result = computeReorder(lines, 0, aboveSettings);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 2,
      lines: ["- [x] newly done"],
    });
  });

  it("no-op when already at correct position", () => {
    const lines = [
      "- [ ] incomplete",
      "- [x] newly done",
      "- [x] old done",
    ];
    const result = computeReorder(lines, 1, aboveSettings);
    expect(result).toBeNull();
  });

  it("moves to bottom when no existing completed tasks", () => {
    const lines = [
      "- [x] newly done",
      "- [ ] task two",
      "- [ ] task three",
    ];
    const result = computeReorder(lines, 0, aboveSettings);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 2,
      lines: ["- [x] newly done"],
    });
  });
});

describe("computeReorder - code fence immunity", () => {
  it("checkbox-like lines inside code fence are ignored", () => {
    const lines = [
      "- [x] done task",
      "- [ ] task two",
      "```",
      "- [x] this is code not a task",
      "```",
      "- [ ] task after fence",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 1,
      lines: ["- [x] done task"],
    });
  });

  it("tilde fence also bounds group", () => {
    const lines = [
      "- [x] done task",
      "- [ ] task two",
      "~~~",
      "- [ ] inside fence",
      "~~~",
    ];
    const result = computeReorder(lines, 0, DEFAULT_TEST_SETTINGS);
    expect(result).toEqual({
      removeFrom: 0,
      removeTo: 0,
      insertAt: 1,
      lines: ["- [x] done task"],
    });
  });

  it("completed line index inside a fence returns null", () => {
    const lines = [
      "```",
      "- [x] this looks complete but is inside a fence",
      "- [ ] also in fence",
      "```",
    ];
    const result = computeReorder(lines, 1, DEFAULT_TEST_SETTINGS);
    expect(result).toBeNull();
  });
});

describe("getIndentLevel", () => {
  it("empty string returns 0", () => {
    expect(getIndentLevel("")).toBe(0);
  });

  it("two spaces returns 2", () => {
    expect(getIndentLevel("  ")).toBe(2);
  });

  it("one tab returns 4", () => {
    expect(getIndentLevel("\t")).toBe(4);
  });

  it("mixed tab and space returns sum", () => {
    expect(getIndentLevel("\t ")).toBe(5);
  });

  it("four spaces returns 4", () => {
    expect(getIndentLevel("    ")).toBe(4);
  });
});

describe("isGroupBoundary", () => {
  it("blank line is boundary", () => {
    expect(isGroupBoundary("")).toBe(true);
  });

  it("whitespace-only line is boundary", () => {
    expect(isGroupBoundary("   ")).toBe(true);
  });

  it("h1 heading is boundary", () => {
    expect(isGroupBoundary("# Title")).toBe(true);
  });

  it("h3 heading is boundary", () => {
    expect(isGroupBoundary("### Section")).toBe(true);
  });

  it("code fence is boundary", () => {
    expect(isGroupBoundary("```")).toBe(true);
  });

  it("tilde fence is boundary", () => {
    expect(isGroupBoundary("~~~")).toBe(true);
  });

  it("blockquote is boundary", () => {
    expect(isGroupBoundary("> quote")).toBe(true);
  });

  it("normal text is not boundary", () => {
    expect(isGroupBoundary("some text")).toBe(false);
  });

  it("checkbox line is not boundary", () => {
    expect(isGroupBoundary("- [ ] task")).toBe(false);
  });
});

describe("isInsideFence", () => {
  it("line before any fence returns false", () => {
    const lines = ["normal text", "```", "code", "```"];
    expect(isInsideFence(lines, 0)).toBe(false);
  });

  it("line inside fence returns true", () => {
    const lines = ["```", "- [x] inside fence", "```"];
    expect(isInsideFence(lines, 1)).toBe(true);
  });

  it("line after closed fence returns false", () => {
    const lines = ["```", "code", "```", "after fence"];
    expect(isInsideFence(lines, 3)).toBe(false);
  });

  it("tilde fence works the same", () => {
    const lines = ["~~~", "inside", "~~~"];
    expect(isInsideFence(lines, 1)).toBe(true);
  });

  it("multiple fences track toggle state", () => {
    const lines = ["```", "a", "```", "between", "```", "b", "```"];
    expect(isInsideFence(lines, 1)).toBe(true);
    expect(isInsideFence(lines, 3)).toBe(false);
    expect(isInsideFence(lines, 5)).toBe(true);
  });
});

describe("partitionGroups", () => {
  it("moves completed task to bottom of flat group", () => {
    const lines = [
      "- [x] done",
      "- [ ] pending one",
      "- [ ] pending two",
    ];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] pending one",
      "- [ ] pending two",
      "- [x] done",
    ]);
  });

  it("handles multiple groups separated by blank line", () => {
    const lines = [
      "- [x] done A",
      "- [ ] pending A",
      "",
      "- [x] done B",
      "- [ ] pending B",
    ];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] pending A",
      "- [x] done A",
      "",
      "- [ ] pending B",
      "- [x] done B",
    ]);
  });

  it("handles nested subtasks following their parent", () => {
    const lines = [
      "- [x] done parent",
      "  - [ ] child one",
      "  - [ ] child two",
      "- [ ] pending parent",
    ];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] pending parent",
      "- [x] done parent",
      "  - [ ] child one",
      "  - [ ] child two",
    ]);
  });

  it("recursively partitions subtask groups", () => {
    const lines = [
      "- [ ] parent",
      "  - [x] sub done",
      "  - [ ] sub pending",
    ];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] parent",
      "  - [ ] sub pending",
      "  - [x] sub done",
    ]);
  });

  it("returns non-checkbox lines unchanged", () => {
    const lines = ["plain text", "more text"];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "plain text",
      "more text",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(partitionGroups([], DEFAULT_TEST_SETTINGS)).toEqual([]);
  });

  it("handles heading-separated groups independently", () => {
    const lines = [
      "## Section A",
      "- [x] done",
      "- [ ] pending",
      "## Section B",
      "- [x] also done",
      "- [ ] also pending",
    ];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "## Section A",
      "- [ ] pending",
      "- [x] done",
      "## Section B",
      "- [ ] also pending",
      "- [x] also done",
    ]);
  });

  it("preserves order when all completed", () => {
    const lines = ["- [x] first", "- [x] second", "- [x] third"];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [x] first",
      "- [x] second",
      "- [x] third",
    ]);
  });

  it("preserves order when all incomplete", () => {
    const lines = ["- [ ] first", "- [ ] second", "- [ ] third"];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] first",
      "- [ ] second",
      "- [ ] third",
    ]);
  });

  it("respects excluded characters", () => {
    const lines = [
      "- [?] question task",
      "- [ ] pending",
      "- [x] done",
    ];
    expect(partitionGroups(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [?] question task",
      "- [ ] pending",
      "- [x] done",
    ]);
  });
});

describe("collectCompleted", () => {
  it("moves completed tasks under a Completed heading", () => {
    const lines = [
      "- [x] done",
      "- [ ] pending",
    ];
    expect(collectCompleted(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "- [x] done",
    ]);
  });

  it("moves subtasks with parent when moveWithSubtasks is true", () => {
    const lines = [
      "- [x] done parent",
      "  - [ ] child",
      "- [ ] pending",
    ];
    expect(collectCompleted(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "- [x] done parent",
      "  - [ ] child",
    ]);
  });

  it("moves only parent line when moveWithSubtasks is false", () => {
    const lines = [
      "- [x] done parent",
      "  - [ ] child",
      "- [ ] pending",
    ];
    const settings: ReorderSettings = {
      ...DEFAULT_TEST_SETTINGS,
      moveWithSubtasks: false,
    };
    expect(collectCompleted(lines, settings)).toEqual([
      "  - [ ] child",
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "- [x] done parent",
    ]);
  });

  it("returns input unchanged when no completed tasks", () => {
    const lines = ["- [ ] one", "- [ ] two"];
    expect(collectCompleted(lines, DEFAULT_TEST_SETTINGS)).toEqual(lines);
  });

  it("trims trailing blank lines before appending section", () => {
    const lines = [
      "- [ ] pending",
      "- [x] done",
      "",
      "",
    ];
    expect(collectCompleted(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "- [x] done",
    ]);
  });

  it("respects excluded characters", () => {
    const lines = [
      "- [?] question",
      "- [x] done",
      "- [ ] pending",
    ];
    expect(collectCompleted(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [?] question",
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "- [x] done",
    ]);
  });

  it("collects multiple completed tasks in order", () => {
    const lines = [
      "- [x] first done",
      "- [ ] pending",
      "- [x] second done",
    ];
    expect(collectCompleted(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "- [x] first done",
      "- [x] second done",
    ]);
  });

  it("uses custom completed heading", () => {
    const lines = [
      "- [x] done",
      "- [ ] pending",
    ];
    const settings: ReorderSettings = {
      ...DEFAULT_TEST_SETTINGS,
      completedHeading: "Done",
    };
    expect(collectCompleted(lines, settings)).toEqual([
      "- [ ] pending",
      "",
      "## Done",
      "",
      "- [x] done",
    ]);
  });
});

describe("hasOpenParent", () => {
  it("returns false for top-level task", () => {
    const lines = ["- [x] done"];
    expect(hasOpenParent(lines, 0, DEFAULT_TEST_SETTINGS.excludedChars)).toBe(false);
  });

  it("returns true when parent is open", () => {
    const lines = [
      "- [ ] parent",
      "  - [x] child",
    ];
    expect(hasOpenParent(lines, 1, DEFAULT_TEST_SETTINGS.excludedChars)).toBe(true);
  });

  it("returns false when parent is completed", () => {
    const lines = [
      "- [x] parent",
      "  - [x] child",
    ];
    expect(hasOpenParent(lines, 1, DEFAULT_TEST_SETTINGS.excludedChars)).toBe(false);
  });

  it("returns true for deeply nested with open ancestor", () => {
    const lines = [
      "- [ ] grandparent",
      "  - [x] parent",
      "    - [x] child",
    ];
    expect(hasOpenParent(lines, 2, DEFAULT_TEST_SETTINGS.excludedChars)).toBe(false);
  });
});

describe("skipSubtasksWithOpenParent", () => {
  const skipSettings: ReorderSettings = {
    ...DEFAULT_TEST_SETTINGS,
    skipSubtasksWithOpenParent: true,
  };

  it("computeReorder skips completed subtask with open parent", () => {
    const lines = [
      "- [ ] parent",
      "  - [x] child",
      "  - [ ] sibling",
    ];
    const result = computeReorder(lines, 1, skipSettings);
    expect(result).toBeNull();
  });

  it("computeReorder moves completed subtask with completed parent", () => {
    const lines = [
      "- [x] parent",
      "  - [x] child",
      "  - [ ] sibling",
    ];
    const result = computeReorder(lines, 1, skipSettings);
    expect(result).not.toBeNull();
  });

  it("collectCompleted skips subtask with open parent", () => {
    const lines = [
      "- [ ] parent",
      "  - [x] child",
      "- [x] top-level done",
    ];
    expect(collectCompleted(lines, skipSettings)).toEqual([
      "- [ ] parent",
      "  - [x] child",
      "",
      "## Completed",
      "",
      "- [x] top-level done",
    ]);
  });

  it("partitionGroups preserves subtask order under open parent", () => {
    const lines = [
      "- [ ] parent",
      "  - [x] done child",
      "  - [ ] open child",
    ];
    expect(partitionGroups(lines, skipSettings)).toEqual([
      "- [ ] parent",
      "  - [x] done child",
      "  - [ ] open child",
    ]);
  });
});

describe("sectionAwareCollection", () => {
  const sectionSettings: ReorderSettings = {
    ...DEFAULT_TEST_SETTINGS,
    sectionAwareCollection: true,
  };

  it("groups collected tasks under their source headings", () => {
    const lines = [
      "## Shopping",
      "- [x] milk",
      "- [ ] bread",
      "## Work",
      "- [x] email",
      "- [ ] report",
    ];
    expect(collectCompleted(lines, sectionSettings)).toEqual([
      "## Shopping",
      "- [ ] bread",
      "## Work",
      "- [ ] report",
      "",
      "## Completed",
      "",
      "### Shopping",
      "- [x] milk",
      "### Work",
      "- [x] email",
    ]);
  });

  it("bumps heading level by one", () => {
    const lines = [
      "### Deep section",
      "- [x] done",
      "- [ ] pending",
    ];
    expect(collectCompleted(lines, sectionSettings)).toEqual([
      "### Deep section",
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "#### Deep section",
      "- [x] done",
    ]);
  });

  it("puts unsectioned tasks before sectioned ones", () => {
    const lines = [
      "- [x] no section",
      "## Section A",
      "- [x] in section",
      "- [ ] pending",
    ];
    expect(collectCompleted(lines, sectionSettings)).toEqual([
      "## Section A",
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "- [x] no section",
      "### Section A",
      "- [x] in section",
    ]);
  });

  it("falls back to flat collection when disabled", () => {
    const lines = [
      "## Section",
      "- [x] done",
      "- [ ] pending",
    ];
    expect(collectCompleted(lines, DEFAULT_TEST_SETTINGS)).toEqual([
      "## Section",
      "- [ ] pending",
      "",
      "## Completed",
      "",
      "- [x] done",
    ]);
  });
});
