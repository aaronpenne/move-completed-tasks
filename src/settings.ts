import { App, PluginSettingTab, Setting } from "obsidian";
import type MoveCompletedPlugin from "./main";

export interface MoveCompletedSettings {
  enabled: boolean;
  moveWithSubtasks: boolean;
  placement: 'bottom' | 'above-completed';
  excludedChars: string;
  highlightMove: boolean;
}

export const DEFAULT_SETTINGS: MoveCompletedSettings = {
  enabled: true,
  moveWithSubtasks: true,
  placement: 'bottom',
  excludedChars: '?!*"lbiSIpcfkwud',
  highlightMove: true,
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

    new Setting(containerEl)
      .setName("Enable auto-move")
      .setDesc("Automatically move completed tasks to the bottom of their group")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enabled)
          .onChange(async (value) => {
            this.plugin.settings.enabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Move with subtasks")
      .setDesc("Move the task and all its nested subtasks as a block")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.moveWithSubtasks)
          .onChange(async (value) => {
            this.plugin.settings.moveWithSubtasks = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Placement")
      .setDesc("Where to place the newly completed task within its group")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("bottom", "Bottom of group")
          .addOption("above-completed", "Above existing completed tasks")
          .setValue(this.plugin.settings.placement)
          .onChange(async (value: string) => {
            this.plugin.settings.placement = value as 'bottom' | 'above-completed';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Excluded characters")
      .setDesc(
        "Checkbox characters that never trigger a move (Minimal theme decorators by default)"
      )
      .addText((text) =>
        text
          .setPlaceholder('?!*"lbiSIpcfkwud')
          .setValue(this.plugin.settings.excludedChars)
          .onChange(async (value) => {
            this.plugin.settings.excludedChars = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Highlight moved task")
      .setDesc("Briefly highlight the task at its new position")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.highlightMove)
          .onChange(async (value) => {
            this.plugin.settings.highlightMove = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
