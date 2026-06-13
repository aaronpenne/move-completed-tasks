export interface ReorderSettings {
  moveWithSubtasks: boolean;
  placement: 'bottom' | 'above-completed';
  excludedChars: string;
  completedHeading: string;
  skipSubtasksWithOpenParent: boolean;
  sectionAwareCollection: boolean;
}

export interface MoveDescriptor {
  removeFrom: number;
  removeTo: number;
  insertAt: number;
  lines: string[];
}

const CHECKBOX_RE = /^(\s*)([-*+]|\d+\.)\s+\[(.)\]\s/;
const HEADING_RE = /^#{1,6}\s/;
const FENCE_RE = /^(\s*)(```|~~~)/;
const BLOCKQUOTE_RE = /^(\s*>)/;

export function parseCheckbox(line: string): { indent: string; status: string } | null {
  const m = line.match(CHECKBOX_RE);
  if (!m) return null;
  return { indent: m[1], status: m[3] };
}

export function getIndentLevel(indent: string): number {
  let level = 0;
  for (const ch of indent) {
    level += ch === "\t" ? 4 : 1;
  }
  return level;
}

export function isGroupBoundary(line: string): boolean {
  if (line.trim() === "") return true;
  if (HEADING_RE.test(line)) return true;
  if (FENCE_RE.test(line)) return true;
  if (BLOCKQUOTE_RE.test(line)) return true;
  return false;
}

export function isCompleted(status: string, excludedChars: string): boolean {
  if (status === " ") return false;
  if (excludedChars.includes(status)) return false;
  return true;
}

export function isInsideFence(docLines: string[], lineIndex: number): boolean {
  let insideFence = false;
  for (let i = 0; i < lineIndex; i++) {
    if (FENCE_RE.test(docLines[i])) {
      insideFence = !insideFence;
    }
  }
  return insideFence;
}

export function hasOpenParent(docLines: string[], lineIndex: number, excludedChars: string): boolean {
  const lineParsed = parseCheckbox(docLines[lineIndex]);
  if (!lineParsed) return false;
  const lineIndent = getIndentLevel(lineParsed.indent);
  if (lineIndent === 0) return false;

  for (let i = lineIndex - 1; i >= 0; i--) {
    const line = docLines[i];
    const p = parseCheckbox(line);
    if (!p) {
      if (line.trim() === "" || isGroupBoundary(line)) return false;
      continue;
    }
    const parentIndent = getIndentLevel(p.indent);
    if (parentIndent < lineIndent) {
      return !isCompleted(p.status, excludedChars);
    }
  }
  return false;
}

interface MovedBlock {
  from: number;
  lines: string[];
}

interface SiblingEntry {
  lineIndex: number;
  blockEnd: number;
}

function buildMovedBlock(
  docLines: string[],
  startIndex: number,
  targetIndentLevel: number,
  settings: ReorderSettings
): MovedBlock {
  const lines = [docLines[startIndex]];

  if (settings.moveWithSubtasks) {
    for (let i = startIndex + 1; i < docLines.length; i++) {
      const l = docLines[i];
      if (l.trim() === "") break;
      const lineIndent = getIndentLevel(l.match(/^(\s*)/)?.[1] ?? "");
      if (lineIndent <= targetIndentLevel) break;
      lines.push(l);
    }
  }

  return { from: startIndex, lines };
}

function findSiblingGroup(
  docLines: string[],
  startIndex: number,
  targetIndentLevel: number,
  settings: ReorderSettings
): SiblingEntry[] {
  const siblings: SiblingEntry[] = [];

  const completedBlock = buildMovedBlock(docLines, startIndex, targetIndentLevel, settings);
  const completedBlockEnd = startIndex + completedBlock.lines.length - 1;
  siblings.push({ lineIndex: startIndex, blockEnd: completedBlockEnd });

  // Scan upward
  let i = startIndex - 1;
  while (i >= 0) {
    const l = docLines[i];
    if (isGroupBoundary(l)) break;

    const p = parseCheckbox(l);
    if (p && getIndentLevel(p.indent) === targetIndentLevel) {
      let subEnd = i;
      for (let j = i + 1; j < startIndex; j++) {
        const subLine = docLines[j];
        if (subLine.trim() === "") break;
        const subIndent = getIndentLevel(subLine.match(/^(\s*)/)?.[1] ?? "");
        if (subIndent <= targetIndentLevel) break;
        subEnd = j;
      }
      siblings.unshift({ lineIndex: i, blockEnd: subEnd });
      i--;
    } else if (p && getIndentLevel(p.indent) > targetIndentLevel) {
      i--;
    } else if (!p) {
      const lineIndent = getIndentLevel(l.match(/^(\s*)/)?.[1] ?? "");
      if (lineIndent <= targetIndentLevel) break;
      i--;
    } else {
      break;
    }
  }

  // Scan downward (past the completed task's block)
  i = completedBlockEnd + 1;
  while (i < docLines.length) {
    const l = docLines[i];
    if (isGroupBoundary(l)) break;

    const p = parseCheckbox(l);
    if (p && getIndentLevel(p.indent) === targetIndentLevel) {
      let subEnd = i;
      for (let j = i + 1; j < docLines.length; j++) {
        const subLine = docLines[j];
        if (subLine.trim() === "") break;
        const subIndent = getIndentLevel(subLine.match(/^(\s*)/)?.[1] ?? "");
        if (subIndent <= targetIndentLevel) break;
        subEnd = j;
      }
      siblings.push({ lineIndex: i, blockEnd: subEnd });
      i = subEnd + 1;
    } else if (p && getIndentLevel(p.indent) > targetIndentLevel) {
      i++;
    } else if (!p) {
      const lineIndent = getIndentLevel(l.match(/^(\s*)/)?.[1] ?? "");
      if (lineIndent <= targetIndentLevel) break;
      i++;
    } else {
      break;
    }
  }

  return siblings;
}

function computeInsertionPoint(
  docLines: string[],
  group: SiblingEntry[],
  _targetIndentLevel: number,
  settings: ReorderSettings
): number {
  if (group.length === 0) return -1;

  if (settings.placement === "bottom") {
    return group[group.length - 1].blockEnd;
  }

  // "above-completed": walk backward from group end past completed siblings
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

export function partitionGroups(lines: string[], settings: ReorderSettings): string[] {
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const parsed = parseCheckbox(lines[i]);
    if (!parsed) {
      output.push(lines[i]);
      i++;
      continue;
    }

    const groupIndent = parsed.indent.length;
    const incomplete: string[][] = [];
    const completed: string[][] = [];

    while (i < lines.length) {
      const p = parseCheckbox(lines[i]);

      if (!p) {
        const lineIndent = (lines[i].match(/^(\s*)/)?.[1] ?? "").length;
        if (lineIndent > groupIndent) {
          const lastBlock =
            (incomplete.length > 0 ? incomplete[incomplete.length - 1] : null) ||
            (completed.length > 0 ? completed[completed.length - 1] : null);
          if (lastBlock) lastBlock.push(lines[i]);
          else output.push(lines[i]);
          i++;
          continue;
        }
        break;
      }

      if (p.indent.length < groupIndent) {
        break;
      }

      if (p.indent.length > groupIndent) {
        const lastBlock =
          (incomplete.length > 0 ? incomplete[incomplete.length - 1] : null) ||
          (completed.length > 0 ? completed[completed.length - 1] : null);
        if (lastBlock) lastBlock.push(lines[i]);
        else incomplete.push([lines[i]]);
        i++;
        continue;
      }

      const block = [lines[i]];
      const isComp = isCompleted(p.status, settings.excludedChars);
      i++;

      while (i < lines.length) {
        if (lines[i].trim() === "") break;
        const subIndent = (lines[i].match(/^(\s*)/)?.[1] ?? "").length;
        if (subIndent <= groupIndent) break;
        block.push(lines[i]);
        i++;
      }

      if (isComp) {
        completed.push(block);
      } else {
        incomplete.push(block);
      }
    }

    const emit = (blocks: string[][], parentCompleted: boolean) => {
      for (const block of blocks) {
        output.push(block[0]);
        if (block.length > 1) {
          const subtaskLines = block.slice(1);
          if (settings.skipSubtasksWithOpenParent && !parentCompleted) {
            output.push(...subtaskLines);
          } else {
            const partitioned = partitionGroups(subtaskLines, settings);
            output.push(...partitioned);
          }
        }
      }
    };

    emit(incomplete, false);
    emit(completed, true);
  }

  return output;
}

export function collectCompleted(lines: string[], settings: ReorderSettings): string[] {
  const remaining: string[] = [];
  let currentHeading: string | null = null;

  // When section-aware, group collected tasks by their source heading
  const sectionMap = new Map<string, string[]>();
  const sectionOrder: string[] = [];
  const flatCollected: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const headingMatch = lines[i].match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      currentHeading = lines[i];
    }

    const parsed = parseCheckbox(lines[i]);
    if (parsed && isCompleted(parsed.status, settings.excludedChars) &&
        !(settings.skipSubtasksWithOpenParent && hasOpenParent(lines, i, settings.excludedChars))) {
      const taskLines: string[] = [lines[i]];
      if (settings.moveWithSubtasks) {
        const baseLevel = parsed.indent.length;
        let j = i + 1;
        while (j < lines.length) {
          const lineIndent = lines[j].match(/^(\s*)/)?.[1] ?? "";
          if (lineIndent.length <= baseLevel && lines[j].trim() !== "") break;
          if (lines[j].trim() === "") break;
          taskLines.push(lines[j]);
          j++;
        }
        i = j - 1;
      }

      if (settings.sectionAwareCollection && currentHeading) {
        const key = currentHeading;
        if (!sectionMap.has(key)) {
          sectionMap.set(key, []);
          sectionOrder.push(key);
        }
        sectionMap.get(key)!.push(...taskLines);
      } else {
        flatCollected.push(...taskLines);
      }
    } else {
      remaining.push(lines[i]);
    }
  }

  const hasCollected = flatCollected.length > 0 || sectionMap.size > 0;
  if (!hasCollected) return lines;

  while (remaining.length > 0 && remaining[remaining.length - 1].trim() === "") {
    remaining.pop();
  }

  const result = [...remaining, "", `## ${settings.completedHeading}`, ""];

  if (settings.sectionAwareCollection && sectionMap.size > 0) {
    // Emit flat (unsectioned) tasks first
    result.push(...flatCollected);
    // Then emit each section with its heading bumped one level
    for (const heading of sectionOrder) {
      const match = heading.match(/^(#{1,6})\s+(.*)/);
      if (match) {
        const hashes = match[1].length < 6 ? "#".repeat(match[1].length + 1) : match[1];
        result.push(`${hashes} ${match[2]}`);
      }
      result.push(...sectionMap.get(heading)!);
    }
  } else {
    result.push(...flatCollected);
  }

  return result;
}

export function computeReorder(
  docLines: string[],
  completedLineIndex: number,
  settings: ReorderSettings
): MoveDescriptor | null {
  const line = docLines[completedLineIndex];
  if (line === undefined) return null;

  if (isInsideFence(docLines, completedLineIndex)) return null;

  const parsed = parseCheckbox(line);
  if (!parsed) return null;
  if (!isCompleted(parsed.status, settings.excludedChars)) return null;
  if (settings.skipSubtasksWithOpenParent && hasOpenParent(docLines, completedLineIndex, settings.excludedChars)) return null;

  const targetIndentLevel = getIndentLevel(parsed.indent);

  const movedBlock = buildMovedBlock(docLines, completedLineIndex, targetIndentLevel, settings);
  const group = findSiblingGroup(docLines, completedLineIndex, targetIndentLevel, settings);
  const insertAt = computeInsertionPoint(docLines, group, targetIndentLevel, settings);

  const movedBlockEnd = movedBlock.from + movedBlock.lines.length - 1;
  if (insertAt === movedBlockEnd) return null;
  if (insertAt === movedBlock.from - 1) return null;
  if (group.length <= 1) return null;

  return {
    removeFrom: movedBlock.from,
    removeTo: movedBlock.from + movedBlock.lines.length - 1,
    insertAt,
    lines: movedBlock.lines,
  };
}
