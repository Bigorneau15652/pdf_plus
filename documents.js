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
  //   cells.attachments: raw value of the attachments column (array of ids), may be undefined
  //   cells.links:       raw value of the links column (text, one https link per line)
  //   cells.names:       raw value of the names column (one name per line)
  //   attachmentLabel:   function (n) => default label of the n-th attachment
  // Documents come out in a fixed order: attachments first, then links. Line N of the
  // names column names the N-th document of that order.
  // Returns { documents, rejected } where rejected lists the ignored values with the
  // column they came from (`attachments` or `links`).
  function parseDocuments(cells, attachmentLabel) {
    const documents = [];
    const rejected = [];
    const names = splitLines(cells.names);
    let position = 0;
    let attachmentCount = 0;

    // Adds one attachment. Grist gives numeric ids, sometimes preceded by a marker.
    function addAttachment(id) {
      attachmentCount += 1;
      documents.push({
        kind: `attachment`,
        id,
        label: cleanLabel(names[position]) || attachmentLabel(attachmentCount),
        key: `attachment:${id}`
      });
      position += 1;
    }

    // Adds one link line, or reports it. Blank lines keep their place for the names.
    function addLinkLine(line, source) {
      const index = position;
      position += 1;
      if (!line) return;
      const url = parseHttpsUrl(line);
      if (!url) {
        rejected.push({ text: sample(line), source });
        return;
      }
      documents.push({
        kind: `link`,
        href: url.href,
        label: cleanLabel(names[index]) || defaultLinkLabel(url),
        key: `link:${url.href}`
      });
    }

    // Reads one column. A text found in the attachments column (a link pasted there) is
    // still understood, so older documents keep working.
    function readColumn(value, source) {
      if (value === null || value === undefined || value === ``) return;
      if (Array.isArray(value)) {
        value.filter((id) => Number.isInteger(id) && id > 0).forEach(addAttachment);
      } else if (typeof value === `string`) {
        splitLines(value).forEach((line) => addLinkLine(line, source));
      } else {
        rejected.push({ text: sample(String(value)), source });
      }
    }

    readColumn(cells.attachments, `attachments`);
    readColumn(cells.links, `links`);
    return { documents, rejected };
  }

  const api = { parseDocuments, parseHttpsUrl, defaultLinkLabel };
  if (typeof module !== `undefined` && module.exports) module.exports = api;
  else root.pdfPlusDocuments = api;
})(typeof window !== `undefined` ? window : globalThis);
