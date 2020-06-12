import * as vscode from 'vscode';

type Domain = string;

interface DomainSupport {
	index: number;
	subDomain: string;
	domain: string;
	suffix: string;
}

function analyseDomain(line: Domain, index: number): DomainSupport {
	let domainSupport: DomainSupport = {
		index: index,
		subDomain: "",
		domain: "",
		suffix: ""
	};

	// split domain string
	const dotArrayOrigin = String(line).split(/[^\w-]/g);

	// remove empty string
	const dotArray = dotArrayOrigin.filter(element => element != "")
	// console.log(dotArray);

	if (dotArray.length < 2) {
		return domainSupport;
	}

	// example:
	// tensorflow.org
	// goo.gl
	if (dotArray.length == 2) {
		domainSupport.domain = dotArray[0];
		domainSupport.suffix = dotArray[1];
		return domainSupport;
	}

	if (dotArray.length == 3 && dotArray[1].length > 3) {
		// example:
		// cloud.githubusercontent.com
		// http2.golang.org
		domainSupport.subDomain = dotArray[0];
		domainSupport.domain = dotArray[1];
		domainSupport.suffix = dotArray[2];
	} else {
		const len = dotArray.length;
		const result = String(dotArray[len - 2]).match(/com|net|org|gov|edu/g);

		if (result == null) {
			// example:
			// read.qq.com
			// https://gist.github.com
			domainSupport.subDomain = dotArray[len - 3];
			domainSupport.domain = dotArray[len - 2];
			domainSupport.suffix = dotArray[len - 1];
		} else {
			// google.com.sg
			domainSupport.domain = dotArray[len - 3];
			domainSupport.suffix = dotArray[len - 2] + "." + dotArray[len - 1];
			// https://gist.github.com.sg
			if (len > 3) {
				domainSupport.subDomain = dotArray[len - 4];
			}
		}
	}

	return domainSupport;
}

function sortDomainSupportArr(arr: DomainSupport[]) {
	arr.sort(function (a, b) {
		const domainA = a.domain.toLowerCase();
		const domainB = b.domain.toLowerCase();

		if (domainA < domainB) {
			return -1;
		}

		if (domainA > domainB) {
			return 1;
		}

		if (domainA == domainB) {
			const suffixA = a.suffix.toLowerCase();
			const suffixB = b.suffix.toLowerCase();

			if (suffixA < suffixB) {
				return -1;
			}

			if (suffixA > suffixB) {
				return 1;
			}

			if (suffixA == suffixB) {
				const subDomainA = a.subDomain.toLowerCase();
				const subDomainB = b.subDomain.toLowerCase();

				if (subDomainA < subDomainB) {
					return -1;
				}

				if (subDomainA > subDomainB) {
					return 1;
				}
			}
		}

		return 0;
	});
}

export function sortLinesByDomain(): Thenable<boolean> | undefined {
	const textEditor = vscode.window.activeTextEditor;
	if (!textEditor) {
		return undefined;
	}

	const selection = textEditor.selection;
	if (selection.isEmpty || selection.isSingleLine) {
		return undefined;
	}

	// get data from current selection lines of editor
	let domains: Domain[] = [];
	for (let i = selection.start.line; i <= selection.end.line; ++i) {
		domains.push(textEditor.document.lineAt(i).text);
	}
	// console.log(domains);

	// convert Domain to DomainSupport
	let domainSupports = domains.map(analyseDomain);
	// console.log(domainSupports);

	// sort lines
	sortDomainSupportArr(domainSupports);

	let newDomains = domainSupports.map(function (domainSupport) {
		return domains[domainSupport.index];
	});
	// console.log(newDomains);

	// replace old lines
	return textEditor.edit(function (editBuilder) {
		const range = new vscode.Range(selection.start.line,
			0,
			selection.end.line,
			textEditor.document.lineAt(selection.end.line).text.length);
		editBuilder.replace(range, newDomains.join('\n'));
	});
}
