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

export function computeReorder(
  docLines: string[],
  completedLineIndex: number,
  settings: ReorderSettings
): MoveDescriptor | null {
  return null;
}
