import { App, PluginSettingTab, Setting } from "obsidian";
import type MoveCompletedPlugin from "./main";

export interface MoveCompletedSettings {
  enabled: boolean;
  moveWithSubtasks: boolean;
  placement: 'bottom' | 'above-completed';
  excludedChars: string;
}

export const DEFAULT_SETTINGS: MoveCompletedSettings = {
  enabled: true,
  moveWithSubtasks: true,
  placement: 'bottom',
  excludedChars: '?!*"lbiSIpcfkwud',
};

export class MoveCompletedSettingTab extends PluginSettingTab {
  plugin: MoveCompletedPlugin;

  constructor(app: App, plugin: MoveCompletedPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
  }
}
