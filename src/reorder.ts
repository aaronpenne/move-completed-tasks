export interface ReorderSettings {
  moveWithSubtasks: boolean;
  placement: 'bottom' | 'above-completed';
  excludedChars: string;
}

export interface MoveDescriptor {
  removeFrom: number;
  removeTo: number;
  insertAt: number;
  lines: string[];
}

const CHECKBOX_RE = /^(\s*)([-*+])\s+\[(.)\]\s/;
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

export function computeReorder(
  docLines: string[],
  completedLineIndex: number,
  settings: ReorderSettings
): MoveDescriptor | null {
  const line = docLines[completedLineIndex];
  if (line === undefined) return null;

  const parsed = parseCheckbox(line);
  if (!parsed) return null;
  if (!isCompleted(parsed.status, settings.excludedChars)) return null;

  const targetIndentLevel = getIndentLevel(parsed.indent);

  const movedBlock = buildMovedBlock(docLines, completedLineIndex, targetIndentLevel, settings);
  const group = findSiblingGroup(docLines, completedLineIndex, targetIndentLevel, settings);
  const insertAt = computeInsertionPoint(docLines, group, targetIndentLevel, settings);

  const movedBlockEnd = movedBlock.from + movedBlock.lines.length - 1;
  if (insertAt === movedBlockEnd) return null;
  if (group.length <= 1) return null;

  return {
    removeFrom: movedBlock.from,
    removeTo: movedBlock.from + movedBlock.lines.length - 1,
    insertAt,
    lines: movedBlock.lines,
  };
}
