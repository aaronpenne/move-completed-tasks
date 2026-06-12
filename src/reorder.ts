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

  return null;
}
