//@ts-ignore
import TurndownService from 'turndown';
import { MarkdownTables } from './markdown/tables';

interface HeadingSettings {
	h1: string;
	h2: string;
	h3: string;
	h4: string;
	h5: string;
	h6: string;
}

((
	vault: string,
	note: string,
	captureComment: string,
	headingSettings: HeadingSettings
) => {
	const markdownService = new TurndownService({
		headingStyle: 'atx',
		hr: '---',
		bulletListMarker: '-',
		codeBlockStyle: 'fenced',
		fence: '```',
		emDelimiter: '*',
	});
	const vaultName = encodeURIComponent(vault);
	const notePath = encodeURIComponent(note);
	const useComment = encodeURIComponent(captureComment);
	const selectionContent = markdownService.turndown(getSelectionHtml());

	let comment = '';

	const tables = new MarkdownTables();
	markdownService.use(tables.tables);

	Object.entries(headingSettings).forEach(([heading, prefix]) => {
		const level = heading.slice(1); // Extract the number from 'h1', 'h2', etc.
		const filter = [`h${level}`] as (keyof HTMLElementTagNameMap)[];

		markdownService.addRule(`heading_${level}_update`, {
			filter: filter,
			replacement: function (content: string) {
				return `${prefix} ${content}`;
			},
		});
	});

	markdownService.addRule('fix_relative_links', {
		filter: ['a'],
		replacement: function (content: string, node: HTMLAnchorElement) {
			let href = node.href;
			if (!href.includes('://')) {
				href = window.location.protocol + '//' + window.location.host + href;
			}
			return `[${content}](${href})`;
		},
	});

	function getSelectionHtml (): string {
		let html = '';
		if (typeof window.getSelection != 'undefined') {
			const sel = window.getSelection();
			if (sel && sel.rangeCount) {
				const container = document.createElement('div');
				for (let i = 0, len = sel.rangeCount; i < len; ++i) {
					container.appendChild(sel.getRangeAt(i).cloneContents());
				}
				html = container.innerHTML;
			}
		}
		return html;
	}

	function showContentLengthWarning (obsidianUrl: string) {
		if (
			navigator.userAgent.indexOf('Chrome') !== -1 &&
			navigator.userAgent.indexOf('Windows') !== -1
		) {
			if (obsidianUrl.length >= 2000) {
				alert(
					`Chrome on Windows doesn't allow a highlight this large.\n ${obsidianUrl.length} characters have been selected and it must be less than 2000. \n\n Firefox on Windows doesn't seem to have this same problem.`
				);
				return true;
			}
		}
		return false;
	}

	function sendToObsidian (highlightedContent = ''): void {
		const modalOverlay = document.getElementsByClassName(
			'obsidian-clipper-modal-overlay'
		)[0] as HTMLElement;
		if (modalOverlay) {
			const txtArea = document.getElementById(
				'obsidian-clipper-comment'
			) as HTMLTextAreaElement;
			comment = txtArea.value;
			txtArea.value = '';
			modalOverlay.style.display = 'none';
		}
		const url = document.URL;
		const baseURI = document.baseURI;
		const title = document.title;
		// Attempt to extract description from tag which contains page description on many websites
		// Worked for me almost every time, but not 100%
		const description =
			document
				.querySelector('meta[name="description"]')
				?.getAttribute('content') ?? '';

		// Turn the content into Markdown
		const obsidianUrl = `obsidian://obsidian-clipper?vault=${vaultName}&notePath=${notePath}&url=${encodeURIComponent(
			url
		)}&format=md&title=${encodeURIComponent(
			title
		)}&highlightdata=${encodeURIComponent(
			highlightedContent
		)}&comments=${encodeURIComponent(comment)}&baseUri=${encodeURIComponent(
			baseURI
		)}&description=${encodeURIComponent(description)}`;
		// Chrome on Windows limits character length of URLs
		if (
			navigator.userAgent.indexOf('Chrome') !== -1 &&
			navigator.userAgent.indexOf('Windows') !== -1
		) {
			if (obsidianUrl.length >= 2000) {
				alert(
					`Chrome on Windows doesn't allow a highlight this large. \
					${obsidianUrl.length} characters have been selected and it \
					must be less than 2000`
				);
			}
		}
		if (!showContentLengthWarning(obsidianUrl)) {
			document.location.href = obsidianUrl;
		}
	}

	function showCommentModal (highlightedContent: string): void {
		const existingModal = document.getElementsByClassName(
			'obsidian-clipper-modal-overlay'
		)[0] as HTMLElement;
		if (existingModal) {
			existingModal.style.display = 'block';
			return;
		}

		const styleContainer = document.createElement('style');
		const styles = document.createTextNode(
			`
.obsidian-clipper-modal {
    z-index: 10000;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 450px;
  padding: 1.3rem;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 15px;
}
.obsidian-clipper-modal .flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.obsidian-clipper-modal input {
  padding: 0.7rem 1rem;
  border: 1px solid #ddd;
  border-radius: 5px;
  font-size: 0.9em;
}

.obsidian-clipper-modal p {
  font-size: 0.9rem;
  color: #777;
  margin: 0.4rem 0 0.2rem;
}

.obsidian-clipper-modal label {
display: block; 
margin-bottom: 0.5rem; 
color: #111827; 
font-size: 0.875rem;
line-height: 1.25rem; 
font-weight: 500;
}

.obsidian-clipper-modal textarea {
    display: block; !important; 
    padding: 0.625rem !important; 
    background-color: #F9FAFB !important; 
    color: #111827 !important; 
    font-size: 0.875rem !important; 
    line-height: 1.25rem !important; 
     width: 100% !important; 
    border-radius: 0.5rem !important; 
    border-width: 1px !important; 
    border-color: #D1D5DB !important; 
}

.obsidian-clipper-modal button {
    padding-top: 0.625rem !important;
padding-bottom: 0.625rem !important;
padding-left: 1.25rem !important;
padding-right: 1.25rem !important;
margin-right: 0.5rem !important;
margin-bottom: 0.5rem !important;
background-color: #1F2937 !important;
color: #ffffff !important;
font-size: 0.875rem !important;
line-height: 1.25rem !important;
font-weight: 500 !important;
border-radius: 0.5rem !important;
}

.obsidian-clipper-modal-overlay {
  background: rgba(0, 0, 0, 0.6);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

`
		);
		styleContainer.appendChild(styles);
		const docHead = document.getElementsByTagName('head');
		docHead[0].appendChild(styleContainer);

		const modalOverlay = document.createElement('div');
		const modal = document.createElement('div');
		modal.innerHTML = `
        <div>
            <label>Obsidian Clipper</label>
            <textarea id="obsidian-clipper-comment" rows="6"	placeholder="Add your thoughts..."></textarea>
        </div>`;

		const btn = document.createElement('button');
		btn.appendChild(document.createTextNode('Submit'));
		btn.addEventListener(
			'click',
			() => sendToObsidian(highlightedContent),
			false
		);
		modal.appendChild(btn);
		modal.classList.add('obsidian-clipper-modal');
		modalOverlay.classList.add('obsidian-clipper-modal-overlay');
		modalOverlay.appendChild(modal);
		document.body.appendChild(modalOverlay);
		document.getElementById('obsidian-clipper-comment')?.focus();
	}

	if (useComment === 'true') {
		showCommentModal(selectionContent);
	} else {
		sendToObsidian();
	}
})('~VaultNameFiller~', '~NotePath~', '~CaptureComment~', {
	h1: '~H1Setting~',
	h2: '~H2Setting~',
	h3: '~H3Setting~',
	h4: '~H4Setting~',
	h5: '~H5Setting~',
	h6: '~H6Setting~',
});
