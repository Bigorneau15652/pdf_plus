// PDF Plus widget: shows one button per document of the selected Grist row and opens
// the chosen document in a separate reader window that follows the row selection.
(function () {
  const { t, applyTranslations } = window.pdfPlusI18n;
  const { parseDocuments } = window.pdfPlusDocuments;

  const READER_WINDOW_NAME = `pdf-plus-reader`;
  const READER_URL = new URL(`viewer.html`, location.href).href;
  const HANDSHAKE_INTERVAL_MS = 200;
  const MAX_SAMPLES = 3;

  // The reader window shows either our own page (`viewer`), a page of a drive (`external`),
  // a window we just created (`blank`), or something we cannot tell (`unknown`).
  const state = {
    readerWindow: null,
    readerShows: `blank`,
    shownKey: null,
    rejectedNotice: ``,
    actionNotice: ``,
    openCounter: 0,
    token: null
  };

  const listEl = document.getElementById(`list`);
  const messageEl = document.getElementById(`message`);
  const noticeEl = document.getElementById(`notice`);
  const iconTemplate = document.getElementById(`icon-template`);

  // ---------------------------------------------------------------- Messages

  function setMessage(text) {
    messageEl.textContent = text || ``;
  }

  // The banner combines two independent messages: ignored values (set when the row
  // changes) and the outcome of the last click (set when a document is opened).
  function refreshNotice() {
    const text = [state.rejectedNotice, state.actionNotice].filter(Boolean).join(` `);
    noticeEl.textContent = text;
    noticeEl.hidden = !text;
  }

  function setActionNotice(text) {
    state.actionNotice = text || ``;
    refreshNotice();
  }

  // ----------------------------------------------------------- Reader window

  function readerIsOpen() {
    return Boolean(state.readerWindow) && !state.readerWindow.closed;
  }

  // Opens the reader window if needed. Returns false when the browser blocks it.
  function ensureReaderWindow() {
    if (readerIsOpen()) return true;
    const width = Math.min(1200, Math.max(600, screen.availWidth - 100));
    const height = Math.min(860, Math.max(400, screen.availHeight - 100));
    const features = `popup=yes,width=${width},height=${height},resizable=yes`;
    const opened = window.open(``, READER_WINDOW_NAME, features);
    if (!opened) return false;
    // The link between the window and the widget is deliberately kept: Grist runs widgets in
    // a sandboxed frame, and such a frame may only navigate windows it is the opener of.
    state.readerWindow = opened;
    state.readerShows = `unknown`;
    try {
      if (opened.location.href === `about:blank`) state.readerShows = `blank`;
    } catch {
      // Cross-origin window left over from an earlier session: its content is unknown.
    }
    state.shownKey = null;
    return true;
  }

  function navigateReader(url, shows) {
    state.readerWindow.location.href = url;
    state.readerShows = shows;
  }

  // Pings the reader page until it answers, so we know its message listener is ready.
  function waitForReader(timeoutMs) {
    return new Promise((resolve) => {
      let finished = false;
      const finish = (answered) => {
        if (finished) return;
        finished = true;
        clearInterval(timer);
        clearTimeout(deadline);
        window.removeEventListener(`message`, onMessage);
        resolve(answered);
      };
      const onMessage = (event) => {
        if (event.source === state.readerWindow && event.origin === location.origin &&
            event.data && event.data.type === `pdfplus:ready`) {
          finish(true);
        }
      };
      const ping = () => {
        try {
          state.readerWindow.postMessage({ type: `pdfplus:hello` }, location.origin);
        } catch {
          // Opaque origin or closed window: the deadline will end the wait.
        }
      };
      window.addEventListener(`message`, onMessage);
      const timer = setInterval(ping, HANDSHAKE_INTERVAL_MS);
      const deadline = setTimeout(() => finish(false), timeoutMs);
      ping();
    });
  }

  // Makes sure the reader window shows our reader page and is listening.
  async function connectReader() {
    const maybeAlreadyThere = state.readerShows === `viewer` || state.readerShows === `unknown`;
    if (maybeAlreadyThere && await waitForReader(700)) {
      state.readerShows = `viewer`;
      return true;
    }
    navigateReader(READER_URL, `viewer`);
    return waitForReader(10000);
  }

  // ------------------------------------------------------------- Attachments

  // Asks Grist for a short-lived read-only token and builds the download address.
  async function attachmentUrl(id) {
    const now = Date.now();
    if (!state.token || state.token.expires - now < 30000) {
      const info = await grist.docApi.getAccessToken({ readOnly: true });
      state.token = {
        baseUrl: info.baseUrl,
        token: info.token,
        expires: now + (info.ttlMsecs || 60000)
      };
    }
    return `${state.token.baseUrl}/attachments/${id}/download?auth=${state.token.token}`;
  }

  async function fetchAttachment(id) {
    const response = await fetch(await attachmentUrl(id));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.arrayBuffer();
  }

  // ---------------------------------------------------------- Open a document

  async function openDocument(doc) {
    const ticket = ++state.openCounter;
    if (!ensureReaderWindow()) {
      setActionNotice(t(`popupBlocked`));
      return;
    }
    setActionNotice(null);

    // A link goes straight to the drive, which shows it with its own reader.
    if (doc.kind === `link`) {
      navigateReader(doc.href, `external`);
      markShown(doc.key);
      return;
    }

    // An attachment is read here and handed over to our reader page.
    let buffer;
    try {
      const bytes = fetchAttachment(doc.id);
      const ready = await connectReader();
      if (!ready) throw new Error(`reader did not answer`);
      buffer = await bytes;
    } catch {
      // Last resort: let the browser open the file with its own PDF viewer.
      try {
        navigateReader(await attachmentUrl(doc.id), `external`);
        setActionNotice(t(`attachmentFallback`));
        markShown(doc.key);
      } catch {
        setActionNotice(t(`readerLost`));
      }
      return;
    }
    // A newer click or row change took over while we were waiting.
    if (ticket !== state.openCounter) return;

    state.readerWindow.postMessage(
      { type: `pdfplus:open`, label: doc.label, page: doc.page, buffer },
      location.origin,
      [buffer]
    );
    markShown(doc.key);
  }

  function markShown(key) {
    state.shownKey = key;
    listEl.querySelectorAll(`.doc-button`).forEach((button) => {
      button.setAttribute(`aria-current`, String(button.dataset.key === key));
    });
  }

  // --------------------------------------------------------------- Rendering

  function renderButtons(documents) {
    listEl.textContent = ``;
    documents.forEach((doc) => {
      const item = document.createElement(`li`);
      const button = document.createElement(`button`);
      button.type = `button`;
      button.className = `doc-button`;
      button.dataset.key = doc.key;
      button.title = t(`openTitle`);
      button.setAttribute(`aria-current`, String(doc.key === state.shownKey));
      button.appendChild(iconTemplate.content.cloneNode(true));
      // User data is only ever inserted as text, never as HTML.
      button.appendChild(document.createTextNode(doc.label));
      button.addEventListener(`click`, () => openDocument(doc));
      item.appendChild(button);
      listEl.appendChild(item);
    });
  }

  // Describes the ignored values: which column to check and a few examples.
  function rejectedNotice(rejected, mapping) {
    const shown = rejected.slice(0, MAX_SAMPLES).map((item) => item.text).join(` ; `);
    const rest = rejected.length - MAX_SAMPLES;
    return t(`rejectedValues`, {
      count: rejected.length,
      column: mapping[rejected[0].source],
      examples: rest > 0 ? t(`andOthers`, { examples: shown, rest }) : shown
    });
  }

  function showEmpty(text) {
    renderButtons([]);
    state.rejectedNotice = ``;
    setActionNotice(null);
    setMessage(text);
  }

  // Called by Grist each time the selected row (or its content) changes.
  function onRecord(record, mapping) {
    if (!record) return showEmpty(t(`pickRow`));
    const row = grist.mapColumnNames(record);
    if (!row || !mapping || !(mapping.attachments || mapping.links)) return showEmpty(t(`needMapping`));

    const { documents, rejected } = parseDocuments(row, (n) => t(`documentN`, { n }));
    renderButtons(documents);
    state.rejectedNotice = rejected.length ? rejectedNotice(rejected, mapping) : ``;
    refreshNotice();
    setMessage(documents.length || rejected.length ? `` : t(`noDocuments`));

    // Follow the selection: update the open reader only if the first document changed.
    if (documents.length && readerIsOpen() && documents[0].key !== state.shownKey) {
      openDocument(documents[0]);
    }
  }

  // -------------------------------------------------------------------- Start

  applyTranslations(document);
  setMessage(t(`pickRow`));

  grist.ready({
    requiredAccess: `read table`,
    columns: [
      {
        name: `attachments`,
        title: t(`columnAttachments`),
        description: t(`columnAttachmentsHelp`),
        type: `Attachments`,
        optional: true
      },
      {
        name: `links`,
        title: t(`columnLinks`),
        description: t(`columnLinksHelp`),
        type: `Text`,
        optional: true
      },
      {
        name: `names`,
        title: t(`columnNames`),
        description: t(`columnNamesHelp`),
        type: `Text`,
        optional: true
      },
      {
        name: `page`,
        title: t(`columnPage`),
        description: t(`columnPageHelp`),
        type: `Int,Numeric`,
        optional: true
      }
    ]
  });
  grist.onRecord(onRecord);
})();
