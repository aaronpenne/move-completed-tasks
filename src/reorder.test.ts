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
