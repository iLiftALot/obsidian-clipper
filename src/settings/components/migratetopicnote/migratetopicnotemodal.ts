import { App, Modal } from 'obsidian';
import { ClipperType } from 'src/settings/types';
import AddNoteCommandComponent from '../addnotecommand/AddNoteCommandComponent.svelte';
import MigrateTopicNoteComponent from './MigrateTopicNoteComponent.svelte';

export class MigrateTopicNoteModal extends Modal {
	private notePath: string;

	constructor(app: App, notePath: string) {
		super(app);
		this.notePath = notePath;
		this.titleEl.createEl('h2', {
			text: 'Bookmarklet Migration Needed',
		});

		new MigrateTopicNoteComponent({
			target: this.contentEl,
			props: {
				notePath: notePath,
			},
		});
	}

	onClose() {
		new AddNoteCommandComponent({
			target: createEl('div'),
			props: {
				app: this.app,
				filePath: this.notePath,
				type: ClipperType.TOPIC,
			},
		});
	}
}
