import { Notice, TFile, TFolder, type App } from 'obsidian';
import { NoteEntry } from 'src/abstracts/noteentry';
import { AppendWriter } from 'src/periodicnotes/appendwriter';
import { SectionPosition } from 'src/settings/types';
import type ObsidianClipperPlugin from 'src/main';
import moment from 'moment';

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
		// Remove the prefix from the link, e.g., 'wwww.'
		let baseURI = hostName;
		const uriHasPrefix = baseURI.match(/^[\w:/]+?\.(?=\S+?\.)/);
		if (uriHasPrefix) {
			baseURI = baseURI.slice(uriHasPrefix[0].length);
		} //.slice(hostName.indexOf('.'));
		const noteFilePath = `${this.storageFolder}/${baseURI}.md`;
		const data = content ?? `- [ ] **${longTitle}**`;

		const folder = this.app.vault.getAbstractFileByPath(this.storageFolder);
		let file = this.app.vault.getAbstractFileByPath(noteFilePath);

		console.log(`FILEPATH: ${noteFilePath}`);

		if (!(file instanceof TFile)) {
			// create the file and write data
			if (!(folder instanceof TFolder)) {
				await this.app.vault.createFolder(this.storageFolder);
				await new Promise((r) => setTimeout(r, 50));
			}
			file = await this.app.vault.create(noteFilePath, '');
			if (!file || !(file instanceof TFile)) {
				const errorMessage = `Unable to create clipper storage file. Most likely ${this.storageFolder} doesn't exist and we were unable to create it.`;

				console.error(errorMessage);
				new Notice(errorMessage);
				throw Error(errorMessage);
			}
		}
		await new Promise((r) => setTimeout(r, 50));

		const currentDate = moment().format(this.plugin.settings.dateFormat);
		const currentTime = moment().format(this.plugin.settings.timestampFormat);

		const detectDateRegex = new RegExp(`^## ${currentDate}`, 'gm');
		const detectTimeRegex = new RegExp(`^### ${currentTime}`, 'gm');

		const fileContent = await this.app.vault.read(file);
		const hasDateHeader = fileContent.match(detectDateRegex);
		const nextTimestamp = (fileContent.match(detectTimeRegex)?.length ?? 0) + 1;

		const sectionHeader = !hasDateHeader
			? `## ${currentDate}\n### *${currentTime}*\n`
			: `### *${currentTime}*\n`;
		const entry = `${sectionHeader}${data} [^${nextTimestamp}]\n\n[^${nextTimestamp}]: ${url}\n\n`;

		await new AppendWriter(this.app, this.openFileOnWrite).write(file, entry);
		return `![[${noteFilePath}#${sectionHeader}|clipped]]`;
	}
}
