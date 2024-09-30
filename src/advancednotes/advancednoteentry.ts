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
		this.template = this.plugin.settings.advancedEntryTemplateLocation;
	}

	async writeToAdvancedNoteStorage(
		hostName: string,
		url: string,
		title: string,
		content?: string,
		comments?: string,
		description?: string
	) {
		const descriptiveTitle = title;
		// Remove the prefix from the link, e.g., 'https://wwww.'
		let baseURI = hostName;
		const uriHasPrefix = baseURI.match(/^[\w:/]+?\.(?=\S+?\.)/);
		if (uriHasPrefix) baseURI = baseURI.slice(uriHasPrefix[0].length);
		const noteFilePath = `${this.storageFolder}/${baseURI}.md`;

		const commentData = comments && comments.length > 0 ? `\n**Notes**\n${comments}` : '';
		const contentData = content && content.length > 0 ? `\n**Highlights**\n${content}` : '';
		const descriptionData = description && description.length > 0 ? `\n- ${description}` : '';
		const titleData = `\n- [ ] **${descriptiveTitle}**`;

		const folder = this.app.vault.getAbstractFileByPath(this.storageFolder);
		let file = this.app.vault.getAbstractFileByPath(noteFilePath);

		if (!(file instanceof TFile)) {
			// create the file and write data
			if (!(folder instanceof TFolder)) {
				await this.app.vault.createFolder(this.storageFolder);
				await new Promise((r) => setTimeout(r, 50));
			}
			file = await this.app.vault.create(noteFilePath, `# ${baseURI}\n`);
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
		const detectDateRegex = new RegExp(`(?<=^## )${currentDate}`, 'gm');
		const fileContent = await this.app.vault.read(file);
		const hasDateHeader = fileContent.match(detectDateRegex);
		let hasOldHeader = false;
		if (hasDateHeader) {
			hasOldHeader = moment(hasDateHeader[0], this.plugin.settings.dateFormat)
				.isBefore(moment(currentDate, this.plugin.settings.dateFormat));
		}
		const nextTimestamp = (fileContent.match(/^###\s/gm)?.length ?? 0) + 1;
		const data = `${descriptionData}${commentData}${contentData}`;
		const sectionHeader = !hasDateHeader || hasOldHeader
			? `## ${currentDate}\n### *${currentTime}*`
			: `### *${currentTime}*`;
		const entry = `${sectionHeader}\n${titleData} [^${nextTimestamp}]${data}\n\n[^${nextTimestamp}]: ${url}\n\n`;
		await new AppendWriter(this.app, this.openFileOnWrite).write(file, entry);
		return `![[${noteFilePath}#${currentTime}|${baseURI}-${nextTimestamp}]]`;
	}
}
