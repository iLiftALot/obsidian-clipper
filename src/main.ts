import { App, PluginSettingTab, Plugin, Modal, Notice, TFile } from 'obsidian';
import { deepmerge } from 'deepmerge-ts';

import type { Parameters } from './types';
import {
	type ObsidianClipperPluginSettings,
	DEFAULT_SETTINGS,
	type ObsidianClipperSettings,
	DEFAULT_DAILY_NOTE_SETTING,
} from './settings/types';
import { ClippedData } from './clippeddata';
import { DailyPeriodicNoteEntry } from './periodicnotes/dailyperiodicnoteentry';
import { WeeklyPeriodicNoteEntry } from './periodicnotes/weeklyperiodicnoteentry';
import SettingsComponent from './settings/SettingsComponent.svelte';
import { init } from './settings/settingsstore';
import type { SvelteComponent } from 'svelte';
import AddTopicNoteCommandComponent from './settings/AddTopicNoteCommandComponent.svelte';
import BookmarkletModalComponent from './modals/BookmarkletModalComponent.svelte';
import { TopicNoteEntry } from './topicnoteentry';
import { BookmarketlGenerator } from './bookmarkletlink/bookmarkletgenerator';
import { AdvancedNoteEntry } from './advancednotes/advancednoteentry';
import { CanvasEntry } from './canvasentry';
import { Utility } from './utils/utility';
import { randomUUID } from 'crypto';
import { getFileName } from './utils/fileutils';

export default class ObsidianClipperPlugin extends Plugin {
	settings: ObsidianClipperPluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SettingTab(this.app, this));

		// this.addCommand({
		// 	id: 'copy-bookmarklet-address-clipboard',
		// 	name: 'Vault Bookmarklet to Clipboard',
		// 	callback: () => this.handleCopyBookmarkletToClipboard(),
		// });
		//
		// this.addCommand({
		// 	id: 'copy-bookmarklet-address',
		// 	name: 'Vault Bookmarklet',
		// 	callback: () => this.handleCopyBookmarkletCommand(),
		// });
		//
		// this.addCommand({
		// 	id: 'copy-note-bookmarklet-address-clipboard',
		// 	name: 'Topic Bookmarklet to Clipboard',
		// 	editorCallback: (_editor, ctx) => {
		// 		this.handleCopyBookmarkletToClipboard(ctx.file?.path);
		// 	},
		// });
		//
		this.addCommand({
			id: 'create-topic-bookmarklet',
			name: 'Create Topic Bookmarklet',
			editorCallback: (_editor, ctx) => {
				const filePath = ctx.file?.path;
				Utility.assertNotNull(filePath);
				new AddTopicNoteCommandComponent({
					target: createEl('div'),
					props: {
						app: this.app,
						filePath: getFileName(filePath),
					},
				});
			},
		});

		// this.addCommand({
		// 	id: 'copy-note-bookmarklet-address-canvas',
		// 	name: 'Canvas Bookmarklet',
		// 	checkCallback: (_checking: boolean) => {
		// 		if (checking) {
		// 			return (
		// 				this.settings.experimentalCanvas &&
		// 				this.app.workspace.getActiveViewOfType(View)?.file.extension ===
		// 					'canvas'
		// 			);
		// 		} else {
		// 			const ctx = this.app.workspace.getActiveViewOfType(View);
		// 			if (ctx) {
		// 				this.handleCopyBookmarkletCommand(false, ctx.file.path);
		// 			}
		// 		}
		// 	},
		// });

		this.registerObsidianProtocolHandler('obsidian-clipper', async (e) => {
			const parameters = e as unknown as Parameters;

			const url = parameters.url;
			const title = parameters.title;
			const notePath = parameters.notePath;
			const highlightData = parameters.highlightdata;
			const comments = parameters.comments;
			const clipperId = parameters.clipperId;

			const clipperSettings = this.settings.clippers.find(
				(c) => c.clipperId === clipperId
			);
			Utility.assertNotNull(clipperSettings);

			// For a brief time the bookmarklet was sending over raw html instead of processed markdown and we need to alert the user to reinstall the bookmarklet
			if (parameters.format === 'html') {
				// Need to alert user
				if (notePath !== '') {
					// Was this a Topic Note bookMarklet?
					this.handleCopyBookmarkletCommand(true, notePath);
				} else {
					// show vault modal
					this.handleCopyBookmarkletCommand(true);
				}
				return;
			}

			let entryReference = highlightData;

			if (clipperSettings.advanced && highlightData) {
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

			if (notePath && notePath !== '') {
				const file = this.app.vault.getAbstractFileByPath(notePath);
				if ((file as TFile).extension === 'canvas') {
					new CanvasEntry(this.app).writeToCanvas(file as TFile, noteEntry);
				} else {
					new TopicNoteEntry(
						this.app,
						clipperSettings.topicOpenOnWrite,
						clipperSettings.topicPosition,
						clipperSettings.topicEntryTemplateLocation
					).writeToNote(file, noteEntry);
				}
			} else {
				if (clipperSettings.useDailyNote) {
					new DailyPeriodicNoteEntry(
						this.app,
						clipperSettings.dailyOpenOnWrite,
						clipperSettings.dailyPosition,
						clipperSettings.dailyEntryTemplateLocation
					).writeToPeriodicNote(noteEntry, clipperSettings.dailyNoteHeading);
				}

				if (clipperSettings.useWeeklyNote) {
					new WeeklyPeriodicNoteEntry(
						this.app,
						clipperSettings.weeklyOpenOnWrite,
						clipperSettings.weeklyPosition,
						clipperSettings.weeklyEntryTemplateLocation
					).writeToPeriodicNote(noteEntry, clipperSettings.weeklyNoteHeading);
				}
			}
		});
	}

	async loadSettings() {
		const mergedSettings = DEFAULT_SETTINGS;
		const settingsData = await this.loadData();
		if (settingsData !== null) {
			if (!settingsData.hasOwnProperty('version')) {
				console.log(
					"Settings exist and haven't been migrated to version 2 or higher"
				);
				// mergedSettings = deepmerge(DEFAULT_SETTINGS, settingsData);
			}
			this.settings = settingsData;
		} else {
			this.settings = mergedSettings;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	handleCopyBookmarkletToClipboard(clipperId: string, notePath = '') {
		const clipperSettings = this.settings.clippers.find(
			(settings: ObsidianClipperSettings) => {
				return settings.clipperId == clipperId;
			}
		);
		Utility.assertNotNull(clipperSettings);
		navigator.clipboard.writeText(
			new BookmarketlGenerator(
				clipperSettings.clipperId,
				this.app.vault.getName(),
				notePath,
				clipperSettings.markdownSettings,
				(
					clipperSettings.experimentalBookmarkletComment &&
					clipperSettings.captureComments
				).toString()
			).generateBookmarklet()
		);
		new Notice('Obsidian Clipper Bookmarklet copied to clipboard.');
	}

	handleCopyBookmarkletCommand(updateRequired = false, filePath = '') {
		let noticeText = '';
		if (updateRequired) {
			noticeText = `Notice: Your Bookmarklet is out of date and needs to be updated.
				Please Drag the link below to replace your current bookmarklet`;
		}

		const bookmarkletLinkModal = new Modal(this.app);
		bookmarkletLinkModal.titleEl.createEl('h2', {
			text: 'Copy Your Bookmarklet',
		});

		new BookmarkletModalComponent({
			target: bookmarkletLinkModal.contentEl,
			props: {
				noticeText: noticeText,
				vaultName: this.app.vault.getName(),
				filePath: filePath,
			},
		});

		bookmarkletLinkModal.open();
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
