import * as vscode from 'vscode';

type Domain = string;

interface DomainHelper {
  index: number;
  parsed: boolean;
  subDomain: string;
  domain: string;
  suffix: string;
}

let cond = "";

function parseDomain(line: Domain, index: number): DomainHelper {
  let domainHelper: DomainHelper = {
    index: index,
    parsed: false,
    subDomain: "",
    domain: "",
    suffix: ""
  };

  // extract domain string
  const origin = String(line).split(/[^\w-.]/g);
  const regExp = new RegExp(cond, 'g');
  const domains = filterByCondition(origin, regExp);

  // multiple matches
  let domain = "";
  if (domains.length == 0) {
    return parseUnknownDomain(origin, domainHelper);
  } else {
    domain = domains[0];
  }

  // parse domain
  const split = String(domain).split(/\./g);

  if (split.length < 2) {
    return domainHelper;
  }

  if (split.length == 2) {
    // example:
    // tensorflow.org
    // goo.gl
    domainHelper.parsed = true;
    domainHelper.domain = split[0];
    domainHelper.suffix = split[1];
    return domainHelper;
  }

  for (let i = 0; i < split.length; ++i) {
    if (split[i].length > 3) {
      continue;
    }

    const result = String("." + split[i]).match(regExp);

    if (result != null) {
      domainHelper.parsed = true;
      domainHelper.domain = split[i - 1];
      domainHelper.suffix = split[i];

      if (i - 2 >= 0) {
        // example:
        // cloud.githubusercontent.com
        // project.example.com.cn
        domainHelper.subDomain = split[i - 2];
      }

      if (i + 1 < split.length) {
        // google.com.sg
        // project.example.com.cn
        domainHelper.suffix = split[i] + "." + split[i + 1];
      }

      break;
    }
  }

  return domainHelper;
}

function parseUnknownDomain(origin: string[], domainHelper: DomainHelper): DomainHelper {
  // guess unknown domains
  const regExp = new RegExp(/[.]/g);
  const unKnownDomains = filterByCondition(origin, regExp);

  // multiple matches
  let domain = "";
  if (unKnownDomains.length == 0) {
    return domainHelper;
  } else {
    domain = unKnownDomains[0];
  }

  // parse domain
  const split = String(domain).split(/\./g);

  if (split.length < 2 || split.length > 3) {
    return domainHelper;
  }

  if (split.length == 2) {
    // example:
    // goo.any
    domainHelper.parsed = true;
    domainHelper.domain = split[0];
    domainHelper.suffix = split[1];
    return domainHelper;
  }

  if (split.length == 3) {
    // example:
    // abc.example.any
    domainHelper.parsed = true;
    domainHelper.subDomain = split[0];
    domainHelper.domain = split[1];
    domainHelper.suffix = split[2];
    return domainHelper;
  }

  return domainHelper;
}

function filterByCondition(origin: string[], reg: RegExp): string[] {
  const results = origin.filter(element => {
    if (element == "") {
      return false;
    }

    const result = String(element).match(reg);
    return result != null;
  });

  return results;
}

function sortDomainArr(arr: DomainHelper[]) {
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

  // read config
  const configCond = vscode.workspace.getConfiguration().get('sortByDomain.filterKeywords');
  if (configCond == undefined || configCond == "") {
    cond = '.com|.net|.org|.gov|.edu|.cc|.io';
  } else {
    cond = String(configCond);
  }
  // console.log(cond);

  // convert Domain to DomainHelper
  let domainsParsed = domains.map(parseDomain);
  // console.log(domainsParsed);

  // parsed lines
  const parsed = domainsParsed.filter(element => element.parsed == true);

  // failed lines
  const failed = domainsParsed.filter(element => element.parsed == false);

  // sort
  sortDomainArr(parsed);

  let sortedDomains = parsed.map(function (domainHelper) {
    return domains[domainHelper.index];
  });
  // console.log(sortedDomains);

  let failedDomains = failed.map(function (domainHelper) {
    return domains[domainHelper.index];
  });
  // console.log(failedDomains);

  // merge config
  let pos = "Bottom";
  const configPos = vscode.workspace.getConfiguration().get('sortByDomain.failedRowsPosition');
  if (configPos != "") {
    pos = String(configPos);
  }
  // console.log(pos);

  // merge
  let result: string[] = [];
  if (pos == "Bottom") {
    result = sortedDomains.concat(failedDomains);
  } else {
    result = failedDomains.concat(sortedDomains);
  }

  // replace old lines
  return textEditor.edit(function (editBuilder) {
    const range = new vscode.Range(selection.start.line,
      0,
      selection.end.line,
      textEditor.document.lineAt(selection.end.line).text.length);

    editBuilder.replace(range, result.join('\n'));
  });
}
