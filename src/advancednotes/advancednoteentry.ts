import { Notice, TFile, TFolder, type App } from 'obsidian';
import { NoteEntry } from 'src/abstracts/noteentry';
import { AppendWriter } from 'src/periodicnotes/appendwriter';
import { SectionPosition } from 'src/settings/types';
import type ObsidianClipperPlugin from 'src/main';

export class AdvancedNoteEntry extends NoteEntry {
	private storageFolder: string;
	private plugin: ObsidianClipperPlugin;

	constructor(app: App, plugin: ObsidianClipperPlugin, storageFolder: string) {
		super(app, false, SectionPosition.APPEND, '');
		this.storageFolder = storageFolder;
		this.plugin = plugin;
	}

	async writeToAdvancedNoteStorage(
		hostName: string,
		url: string,
		content?: string,
		title?: string
	) {
		const longTitle = title;
		const baseURI = hostName.replaceAll('.', '-');
		const noteFilePath = `${this.storageFolder}/${baseURI}.md`;

		let data = content;
		if (!data) {
			data = `- [ ] **${longTitle}**`;
		}

		const folder = this.app.vault.getAbstractFileByPath(this.storageFolder);
		let file = this.app.vault.getAbstractFileByPath(noteFilePath);

		console.log(`FILEPATH: ${noteFilePath}`);

		const sectionHeader = window.moment()
			.format(
				`${this.plugin.settings.dateFormat} ${this.plugin.settings.timestampFormat}`
			)
			.replaceAll(':', '-');
		const entry = `\n### ${sectionHeader}\n${data}\n[^1]\n\n[^1]: ${url}\n`;

		if (!(file instanceof TFile)) {
			// create the file and write data
			if (!(folder instanceof TFolder)) {
				await this.app.vault.createFolder(this.storageFolder);
				await new Promise((r) => setTimeout(r, 50));
			}
			file = await this.app.vault.create(noteFilePath, entry);
		} else {
			await new AppendWriter(this.app, this.openFileOnWrite).write(file, entry);
		}
		// Wait for the new note or note data to be available then return
		await new Promise((r) => setTimeout(r, 50));

		if (!file) {
			const errorMessage = `Unable to create clipper storage file. Most likely ${this.storageFolder} doesn't exist and we were unable to create it.`;

			console.error(errorMessage);
			new Notice(errorMessage);
			throw Error(errorMessage);
		}

		return `![[${this.storageFolder}/${hostName}#${sectionHeader}|clipped]]`;
	}
}
