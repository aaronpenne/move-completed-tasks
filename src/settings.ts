import { App, PluginSettingTab, Setting } from "obsidian";
import type MoveCompletedPlugin from "./main";

export interface MoveCompletedSettings {
  enabled: boolean;
  moveWithSubtasks: boolean;
  placement: 'bottom' | 'above-completed';
  excludedChars: string;
  completedHeading: string;
  skipSubtasksWithOpenParent: boolean;
  sectionAwareCollection: boolean;
  highlightMove: boolean;
  moveDelay: number;
}

export const DEFAULT_SETTINGS: MoveCompletedSettings = {
  enabled: true,
  moveWithSubtasks: true,
  placement: 'above-completed',
  excludedChars: '?!*"lbiSIpcfkwud',
  completedHeading: 'Completed',
  skipSubtasksWithOpenParent: false,
  sectionAwareCollection: false,
  highlightMove: true,
  moveDelay: 0,
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
      .setName("Skip subtasks with open parent")
      .setDesc("Don't move a completed subtask if its parent task is still open")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.skipSubtasksWithOpenParent)
          .onChange(async (value) => {
            this.plugin.settings.skipSubtasksWithOpenParent = value;
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
      .setName("Completed heading")
      .setDesc(
        "Heading text used when collecting completed tasks to the end of the document"
      )
      .addText((text) =>
        text
          .setPlaceholder("Completed")
          .setValue(this.plugin.settings.completedHeading)
          .onChange(async (value) => {
            this.plugin.settings.completedHeading = value || "Completed";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Section-aware collection")
      .setDesc("When collecting completed tasks, group them under sub-headings that mirror the original document structure")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.sectionAwareCollection)
          .onChange(async (value) => {
            this.plugin.settings.sectionAwareCollection = value;
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

    new Setting(containerEl)
      .setName("Move delay (seconds)")
      .setDesc(
        "Wait this many seconds before moving a completed task. Set to 0 for instant. Unchecking before the delay cancels the move."
      )
      .addSlider((slider) =>
        slider
          .setLimits(0, 10, 1)
          .setValue(this.plugin.settings.moveDelay)
          .onChange(async (value) => {
            this.plugin.settings.moveDelay = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
