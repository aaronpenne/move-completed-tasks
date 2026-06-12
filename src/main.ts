import { Plugin } from "obsidian";
import { MoveCompletedSettings, DEFAULT_SETTINGS, MoveCompletedSettingTab } from "./settings";

export default class MoveCompletedPlugin extends Plugin {
  settings: MoveCompletedSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new MoveCompletedSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
