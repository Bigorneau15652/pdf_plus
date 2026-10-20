// Turns the raw value of a Grist cell into a list of documents the widget can open.
// This file has no access to the page: it is pure logic, easy to test with Node.
(function (root) {
  const MAX_LABEL_LENGTH = 120;
  const MAX_SAMPLE_LENGTH = 60;

  // Splits a multi-line cell. Blank lines are kept so that line N of the names
  // column always matches line N of the documents column.
  function splitLines(value) {
    if (typeof value !== `string`) return [];
    return value.split(/\r?\n/).map((line) => line.trim());
  }

  // Accepts only absolute https links without embedded credentials.
  function parseHttpsUrl(text) {
    let url;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (url.protocol !== `https:` || url.username || url.password) return null;
    return url;
  }

  // Converts any page value (number or text) into an integer >= 1, or null.
  function normalizePage(value) {
    const page = Math.floor(Number(value));
    return Number.isFinite(page) && page >= 1 ? page : null;
  }

  // Reads a page number from a link fragment such as #page=5.
  function pageFromHash(hash) {
    const match = /(?:^#|&)page=(\d+)/.exec(hash || ``);
    return match ? normalizePage(match[1]) : null;
  }

  // Builds a readable default label for a link: the PDF file name if the path ends with
  // one, otherwise the host name (share links such as /s/AbCd have no readable name).
  function defaultLinkLabel(url) {
    const lastSegment = url.pathname.split(`/`).filter(Boolean).pop() || ``;
    try {
      const decoded = decodeURIComponent(lastSegment);
      if (/\.pdf$/i.test(decoded)) return decoded;
    } catch {
      // A malformed percent sequence: fall through to the host name.
    }
    return url.hostname;
  }

  // Shortens text shown in the "ignored values" banner.
  function sample(text) {
    return text.length > MAX_SAMPLE_LENGTH ? `${text.slice(0, MAX_SAMPLE_LENGTH)}…` : text;
  }

  function cleanLabel(text) {
    return String(text || ``).trim().slice(0, MAX_LABEL_LENGTH);
  }

  // Main entry point.
  //   value:      raw cell value (array of attachment ids, or text with one link per line)
  //   namesValue: raw value of the names column (one name per line), may be undefined
  //   pageValue:  raw value of the page column, may be undefined
  //   attachmentLabel: function (n) => default label of the n-th attachment
  // Returns { documents, rejected } where rejected lists the values that were ignored.
  function parseDocuments(value, namesValue, pageValue, attachmentLabel) {
    const documents = [];
    const rejected = [];
    const names = splitLines(namesValue);
    const columnPage = normalizePage(pageValue);

    // Attachments: Grist gives an array of numeric ids (sometimes preceded by a marker).
    if (Array.isArray(value)) {
      const ids = value.filter((id) => Number.isInteger(id) && id > 0);
      ids.forEach((id, index) => {
        documents.push({
          kind: `attachment`,
          id,
          label: cleanLabel(names[index]) || attachmentLabel(index + 1),
          page: columnPage,
          key: `attachment:${id}:${columnPage || ``}`
        });
      });
      return { documents, rejected };
    }

    // Empty cell: nothing to show and nothing to report.
    if (value === null || value === undefined || value === ``) return { documents, rejected };

    // Any other non-text value cannot be a document.
    if (typeof value !== `string`) {
      rejected.push(sample(String(value)));
      return { documents, rejected };
    }

    // Links: one per line, line N is named by line N of the names column.
    splitLines(value).forEach((line, index) => {
      if (!line) return;
      const url = parseHttpsUrl(line);
      if (!url) {
        rejected.push(sample(line));
        return;
      }
      const page = pageFromHash(url.hash) || columnPage;
      // Many viewers (including those built on PDF.js) understand #page=N.
      if (columnPage && !url.hash) url.hash = `page=${columnPage}`;
      documents.push({
        kind: `link`,
        href: url.href,
        label: cleanLabel(names[index]) || defaultLinkLabel(url),
        page,
        key: `link:${url.href}`
      });
    });
    return { documents, rejected };
  }

  const api = { parseDocuments, parseHttpsUrl, normalizePage, pageFromHash, defaultLinkLabel };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.pdfPlusDocuments = api;
})(typeof window !== `undefined` ? window : globalThis);
