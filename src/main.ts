import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	TFile,
	View,
	WorkspaceLeaf,
} from 'obsidian';

import { randomUUID } from 'crypto';
import { deepmerge } from 'deepmerge-ts';
import type { SvelteComponent } from 'svelte';
import { AdvancedNoteEntry } from './advancednotes/advancednoteentry';
import { BookmarketlGenerator } from './bookmarkletlink/bookmarkletgenerator';
import { CanvasEntry } from './canvasentry';
import { ClippedData } from './clippeddata';
import { DailyPeriodicNoteEntry } from './periodicnotes/dailyperiodicnoteentry';
import { WeeklyPeriodicNoteEntry } from './periodicnotes/weeklyperiodicnoteentry';
import AddNoteCommandComponent from './settings/AddNoteCommandComponent.svelte';
import SettingsComponent from './settings/SettingsComponent.svelte';
import { init } from './settings/settingsstore';
import {
	ClipperType,
	DEFAULT_CLIPPER_SETTING,
	DEFAULT_SETTINGS,
	DEFAULT_SETTINGS_EMPTY,
	type ObsidianClipperPluginSettings,
	type ObsidianClipperSettings,
	type OldClipperSettings,
} from './settings/types';
import { TopicNoteEntry } from './topicnoteentry';
import type { Parameters } from './types';
import { getFileName } from './utils/fileutils';
import { ShortcutLinkGenerator } from './shortcutslink/ShortcutLinkGenerator';
import { Utility } from './utils/utility';
import {
	BookmarkletLinksView,
	VIEW_TYPE_EXAMPLE,
} from './views/BookmarkletLinksView';

export default class ObsidianClipperPlugin extends Plugin {
	settings: ObsidianClipperPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SettingTab(this.app, this));

		// Are we looking at a markdown note?
		this.addCommand({
			id: 'create-topic-bookmarklet',
			name: 'Create Topic Bookmarklet',
			checkCallback: (checking: boolean) => {
				if (checking) {
					return (
						this.app.workspace.getActiveViewOfType(View)?.file.extension ===
						'md'
					);
				} else {
					const ctx = this.app.workspace.getActiveViewOfType(View);
					if (ctx) {
						const filePath = ctx.file?.path;
						Utility.assertNotNull(filePath);
						new AddNoteCommandComponent({
							target: createEl('div'),
							props: {
								app: this.app,
								filePath: filePath,
								type: ClipperType.TOPIC,
							},
						});
					}
				}
			},
		});

		// Are we looking at a canvas note?
		this.addCommand({
			id: 'copy-note-bookmarklet-address-canvas',
			name: 'Canvas Bookmarklet',
			checkCallback: (checking: boolean) => {
				if (checking) {
					return (
						this.app.workspace.getActiveViewOfType(View)?.file.extension ===
						'canvas'
					);
				} else {
					const ctx = this.app.workspace.getActiveViewOfType(View);
					if (ctx) {
						const filePath = ctx.file?.path;
						Utility.assertNotNull(filePath);
						new AddNoteCommandComponent({
							target: createEl('div'),
							props: {
								app: this.app,
								filePath: getFileName(filePath),
								type: ClipperType.CANVAS,
							},
						});
					}
				}
			},
		});

		this.addCommand({
			id: 'copy-topic-bookmarklet-clipboard',
			name: 'Copy Topic Note Bookmarklet (Clipboard)',
			checkCallback: (checking: boolean) => {
				if (checking) {
					return (
						this.app.workspace.getActiveViewOfType(View)?.file.extension ===
						'md'
					);
				} else {
					const ctx = this.app.workspace.getActiveViewOfType(View);
					if (ctx) {
						const filePath = ctx.file?.path;
						Utility.assertNotNull(filePath);
						const foundClipper = this.settings.clippers.find((clipper) => {
							return clipper.notePath === filePath;
						});
						if (foundClipper) {
							this.handleCopyBookmarkletToClipboard(foundClipper);
						} else {
							new Notice("Couldn't find setting for this note");
						}
					}
				}
			},
		});

		this.addCommand({
			id: 'copy-topic-apple-shortcut-clipboard',
			name: 'Copy Topic Note Apple Shortcut (Clipboard)',
			checkCallback: (checking: boolean) => {
				if (checking) {
					return (
						this.app.workspace.getActiveViewOfType(View)?.file.extension ===
						'md'
					);
				} else {
					const ctx = this.app.workspace.getActiveViewOfType(View);
					if (ctx) {
						const filePath = ctx.file?.path;
						Utility.assertNotNull(filePath);
						const foundClipper = this.settings.clippers.find((clipper) => {
							return clipper.notePath === filePath;
						});
						if (foundClipper) {
							this.handleCopyShortcutToClipboard(foundClipper);
						} else {
							new Notice("Couldn't find setting for this note");
						}
					}
				}
			},
		});

		this.registerObsidianProtocolHandler('obsidian-clipper', async (e) => {
			const parameters = e as unknown as Parameters;

			const url = parameters.url;
			const title = parameters.title;
			const highlightData = parameters.highlightdata;
			const comments = parameters.comments;
			const clipperId = parameters.clipperId;

			const clipperSettings = this.settings.clippers.find(
				(c) => c.clipperId === clipperId
			);
			Utility.assertNotNull(clipperSettings);

			let entryReference = highlightData;

			if (clipperSettings.advancedStorage && highlightData) {
				const domain = Utility.parseDomainFromUrl(url);
				entryReference = await new AdvancedNoteEntry(
					this.app,
					clipperSettings.advancedStorageFolder
				).writeToAdvancedNoteStorage(domain, highlightData, url);
			}

			const noteEntry = new ClippedData(
				title,
				url,
				clipperSettings,
				this.app,
				entryReference,
				comments
			);

			this.writeNoteEntry(clipperSettings, noteEntry);
		});

		this.registerView(
			VIEW_TYPE_EXAMPLE,
			(leaf) => new BookmarkletLinksView(leaf)
		);

		this.addRibbonIcon('paperclip', 'Activate view', () => {
			this.activateView();
		});
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_EXAMPLE);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_EXAMPLE, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		const settingsData = await this.loadData();

		// Existing data
		if (settingsData !== null) {
			if (!settingsData.hasOwnProperty('version')) {
				console.log(
					"Settings exist and haven't been migrated to version 2 or higher"
				);
				this.settings = this.mergeExistingSetting(settingsData);
				this.saveSettings();
			} else {
				this.settings = settingsData;
			}
		} else {
			this.settings = Object.assign({}, DEFAULT_SETTINGS, null);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	mergeExistingSetting(
		settingsData: OldClipperSettings
	): ObsidianClipperPluginSettings {
		const mergedSettings = deepmerge(
			DEFAULT_SETTINGS_EMPTY,
			{}
		) as ObsidianClipperPluginSettings;
		if (settingsData.useDailyNote === true) {
			const transfered = deepmerge(
				DEFAULT_CLIPPER_SETTING,
				{}
			) as ObsidianClipperSettings;
			transfered.clipperId = randomUUID();
			transfered.type = 'daily';
			transfered.name = settingsData.dailyNoteHeading;
			transfered.vaultName = this.app.vault.getName();
			transfered.heading = settingsData.dailyNoteHeading;
			transfered.tags = settingsData.tags;
			transfered.timestampFormat = settingsData.timestampFormat;
			transfered.dateFormat = settingsData.dateFormat;
			transfered.openOnWrite = settingsData.dailyOpenOnWrite;
			transfered.position = settingsData.dailyPosition;
			transfered.entryTemplateLocation =
				settingsData.dailyEntryTemplateLocation;
			transfered.markdownSettings = settingsData.markdownSettings;
			transfered.advancedStorage = settingsData.advanced;
			transfered.advancedStorageFolder = settingsData.advancedStorageFolder;
			mergedSettings.clippers.push(transfered);
		}

		if (settingsData.useWeeklyNote === true) {
			const transfered = deepmerge(
				DEFAULT_CLIPPER_SETTING,
				{}
			) as ObsidianClipperSettings;
			transfered.clipperId = randomUUID();
			transfered.type = 'weekly';
			transfered.name = settingsData.weeklyNoteHeading;
			transfered.vaultName = this.app.vault.getName();
			transfered.heading = settingsData.weeklyNoteHeading;
			transfered.tags = settingsData.tags;
			transfered.timestampFormat = settingsData.timestampFormat;
			transfered.dateFormat = settingsData.dateFormat;
			transfered.openOnWrite = settingsData.weeklyOpenOnWrite;
			transfered.position = settingsData.weeklyPosition;
			transfered.entryTemplateLocation =
				settingsData.weeklyEntryTemplateLocation;
			transfered.markdownSettings = settingsData.markdownSettings;
			transfered.advancedStorage = settingsData.advanced;
			transfered.advancedStorageFolder = settingsData.advancedStorageFolder;
			mergedSettings.clippers.push(transfered);
		}

		return mergedSettings;
	}

	handleCopyBookmarkletToClipboard(clipper: ObsidianClipperSettings) {
		navigator.clipboard.writeText(
			new BookmarketlGenerator(
				clipper.clipperId,
				this.app.vault.getName(),
				clipper.notePath,
				clipper.headingLevel,
				(
					this.settings.experimentalBookmarkletComment &&
					clipper.captureComments
				).toString()
			).generateBookmarklet()
		);
		new Notice('Obsidian Clipper Bookmarklet copied to clipboard.');
	}

	handleCopyShortcutToClipboard(clipper: ObsidianClipperSettings) {
		navigator.clipboard.writeText(
			new ShortcutLinkGenerator(clipper).generateShortcutLink()
		);
	}

	writeNoteEntry(
		clipperSettings: ObsidianClipperSettings,
		noteEntry: ClippedData
	) {
		const type = clipperSettings.type;
		if (type === ClipperType.TOPIC || type === ClipperType.CANVAS) {
			const file = this.app.vault.getAbstractFileByPath(
				clipperSettings.notePath
			);
			if (type === ClipperType.CANVAS) {
				new CanvasEntry(this.app).writeToCanvas(file as TFile, noteEntry);
			} else {
				new TopicNoteEntry(
					this.app,
					clipperSettings.openOnWrite,
					clipperSettings.position,
					clipperSettings.entryTemplateLocation
				).writeToNote(
					file,
					noteEntry,
					clipperSettings.heading,
					clipperSettings.headingLevel
				);
			}
		} else {
			if (type === ClipperType.DAILY) {
				new DailyPeriodicNoteEntry(
					this.app,
					clipperSettings.openOnWrite,
					clipperSettings.position,
					clipperSettings.entryTemplateLocation
				).writeToPeriodicNote(
					noteEntry,
					clipperSettings.heading,
					clipperSettings.headingLevel
				);
			}

			if (type === ClipperType.WEEKLY) {
				new WeeklyPeriodicNoteEntry(
					this.app,
					clipperSettings.openOnWrite,
					clipperSettings.position,
					clipperSettings.entryTemplateLocation
				).writeToPeriodicNote(
					noteEntry,
					clipperSettings.heading,
					clipperSettings.headingLevel
				);
			}
		}
	}
}

class SettingTab extends PluginSettingTab {
	plugin: ObsidianClipperPlugin;
	private view: SvelteComponent;

	constructor(app: App, plugin: ObsidianClipperPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		init(this.plugin);
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		this.view = new SettingsComponent({
			target: containerEl,
			props: {
				app: this.app,
			},
		});
	}

	async hide() {
		super.hide();
		this.view.$destroy();
	}
}
