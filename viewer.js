// PDF Plus reader: displays one PDF handed over by the widget (same site, postMessage),
// with thumbnails, chapters, search, zoom, rotation, download and print.
(function () {
  const { t, applyTranslations } = window.pdfPlusI18n;

  const PDFJS_DIR = new URL(`vendor/pdfjs/`, location.href).href;
  const THUMBNAIL_RENDER_MARGIN = `300px`;
  const ZOOM_STEP = 1.15;
  const SEARCH_DELAY_MS = 250;
  const MAX_LABEL_LENGTH = 200;
  const FIND_STATE_NOT_FOUND = 1;

  const $ = (id) => document.getElementById(id);
  const el = {
    toolbar: $(`toolbar`), title: $(`doc-title`), error: $(`error`), placeholder: $(`placeholder`),
    sidebar: $(`sidebar`), tabThumbs: $(`tab-thumbnails`), tabOutline: $(`tab-outline`),
    panelThumbs: $(`panel-thumbnails`), panelOutline: $(`panel-outline`),
    container: $(`viewerContainer`), viewer: $(`viewer`),
    pageInput: $(`page-input`), pageTotal: $(`page-total`),
    zoomSelect: $(`zoom-select`), zoomCustom: $(`zoom-custom`),
    searchInput: $(`search-input`), searchCount: $(`search-count`)
  };

  // Everything that belongs to the document currently displayed.
  const current = {
    pdfDocument: null, loadingTask: null, blob: null, blobUrl: null,
    label: ``, thumbObserver: null
  };

  let pdfjsLib;
  let pdfViewer;
  let eventBus;
  let linkService;

  // ----------------------------------------------------------------- Helpers

  function showError(text) {
    el.error.textContent = text || ``;
    el.error.hidden = !text;
  }

  // Maps a PDF.js loading failure to a message the user can act on.
  function describeError(error) {
    if (error && error.name === `PasswordException`) return t(`errorPassword`);
    if (error && error.name === `InvalidPDFException`) return t(`errorInvalid`);
    return t(`errorGeneric`, { reason: (error && error.message) || String(error) });
  }

  function safeFileName(label) {
    const base = label.replace(/[\\/:*?"<>|]+/g, `_`).trim() || `document`;
    return /\.pdf$/i.test(base) ? base : `${base}.pdf`;
  }

  // --------------------------------------------------------- Document loading

  // Releases the previous document so that memory does not grow with every row change.
  function releaseCurrent() {
    if (current.thumbObserver) current.thumbObserver.disconnect();
    current.thumbObserver = null;
    if (current.loadingTask) current.loadingTask.destroy();
    current.loadingTask = null;
    current.pdfDocument = null;
    if (pdfViewer) pdfViewer.setDocument(null);
    if (current.blobUrl) URL.revokeObjectURL(current.blobUrl);
    current.blobUrl = null;
    current.blob = null;
    el.panelThumbs.textContent = ``;
    el.panelOutline.textContent = ``;
    el.searchInput.value = ``;
    el.searchCount.textContent = ``;
  }

  async function openPdf(buffer, label, page) {
    releaseCurrent();
    showError(null);
    el.placeholder.hidden = true;
    current.label = label;
    el.title.textContent = label;
    document.title = `${label} - PDF Plus`;

    // The blob keeps the bytes for download and print; PDF.js reads the same blob.
    current.blob = new Blob([buffer], { type: `application/pdf` });
    current.blobUrl = URL.createObjectURL(current.blob);

    const task = pdfjsLib.getDocument({
      url: current.blobUrl,
      cMapUrl: `${PDFJS_DIR}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_DIR}standard_fonts/`,
      isEvalSupported: false,
      enableXfa: false
    });
    current.loadingTask = task;

    let pdf;
    try {
      pdf = await task.promise;
    } catch (error) {
      // A newer document replaced this one while it was loading: say nothing.
      if (task !== current.loadingTask) return;
      showError(describeError(error));
      el.placeholder.hidden = false;
      return;
    }
    if (task !== current.loadingTask) {
      pdf.destroy();
      return;
    }

    current.pdfDocument = pdf;
    el.pageTotal.textContent = t(`pageTotal`, { total: pdf.numPages });
    el.pageInput.max = String(pdf.numPages);

    // Open on the requested page once PDF.js knows the page sizes.
    eventBus.on(`pagesinit`, () => {
      pdfViewer.currentScaleValue = `page-width`;
      if (page && page <= pdf.numPages) pdfViewer.currentPageNumber = page;
    }, { once: true });
    pdfViewer.setDocument(pdf);
    linkService.setDocument(pdf, null);

    buildThumbnails(pdf);
    buildOutline(pdf);
  }

  // -------------------------------------------------------------- Thumbnails

  // Creates one placeholder per page and draws it only when it scrolls into view.
  async function buildThumbnails(pdf) {
    if (current.thumbObserver) current.thumbObserver.disconnect();
    el.panelThumbs.textContent = ``;
    const firstPage = await pdf.getPage(1);
    if (pdf !== current.pdfDocument) return;
    const size = firstPage.getViewport({ scale: 1, rotation: pdfViewer.pagesRotation });

    current.thumbObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        current.thumbObserver.unobserve(entry.target);
        drawThumbnail(pdf, entry.target);
      });
    }, { root: el.panelThumbs, rootMargin: THUMBNAIL_RENDER_MARGIN });

    for (let number = 1; number <= pdf.numPages; number++) {
      const button = document.createElement(`button`);
      button.type = `button`;
      button.className = `thumb`;
      button.dataset.page = String(number);
      button.setAttribute(`aria-current`, String(number === pdfViewer.currentPageNumber));
      const canvas = document.createElement(`canvas`);
      canvas.style.aspectRatio = `${size.width} / ${size.height}`;
      button.appendChild(canvas);
      button.appendChild(document.createTextNode(String(number)));
      button.addEventListener(`click`, () => { pdfViewer.currentPageNumber = number; });
      el.panelThumbs.appendChild(button);
      current.thumbObserver.observe(button);
    }
  }

  async function drawThumbnail(pdf, button) {
    const page = await pdf.getPage(Number(button.dataset.page));
    if (pdf !== current.pdfDocument) return;
    const canvas = button.querySelector(`canvas`);
    const base = page.getViewport({ scale: 1, rotation: pdfViewer.pagesRotation });
    const scale = (canvas.clientWidth || 160) * (window.devicePixelRatio || 1) / base.width;
    const viewport = page.getViewport({ scale, rotation: pdfViewer.pagesRotation });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    await page.render({ canvasContext: canvas.getContext(`2d`), viewport }).promise;
    page.cleanup();
  }

  function markCurrentThumbnail(pageNumber) {
    el.panelThumbs.querySelectorAll(`.thumb`).forEach((button) => {
      const isCurrent = Number(button.dataset.page) === pageNumber;
      button.setAttribute(`aria-current`, String(isCurrent));
      if (isCurrent && !el.sidebar.hidden) button.scrollIntoView({ block: `nearest` });
    });
  }

  // ----------------------------------------------------------------- Outline

  async function buildOutline(pdf) {
    const outline = await pdf.getOutline();
    if (pdf !== current.pdfDocument) return;
    el.panelOutline.textContent = ``;
    if (!outline || !outline.length) {
      const message = document.createElement(`p`);
      message.className = `empty`;
      message.textContent = t(`noOutline`);
      el.panelOutline.appendChild(message);
      return;
    }
    const root = document.createElement(`ul`);
    root.className = `outline`;
    outline.forEach((item) => root.appendChild(outlineNode(item, 0)));
    el.panelOutline.appendChild(root);
  }

  // One chapter: a title button, plus a fold button when it has sub-chapters.
  function outlineNode(item, depth) {
    const node = document.createElement(`li`);
    const row = document.createElement(`div`);
    row.className = `outline-row`;

    const hasChildren = Boolean(item.items && item.items.length);
    let children = null;
    if (hasChildren) {
      const toggle = document.createElement(`button`);
      toggle.type = `button`;
      toggle.className = `outline-toggle`;
      toggle.textContent = depth === 0 ? `▾` : `▸`;
      toggle.setAttribute(`aria-expanded`, String(depth === 0));
      toggle.title = t(depth === 0 ? `collapse` : `expand`);
      toggle.addEventListener(`click`, () => {
        const expand = children.hidden;
        children.hidden = !expand;
        toggle.setAttribute(`aria-expanded`, String(expand));
        toggle.textContent = expand ? `▾` : `▸`;
        toggle.title = t(expand ? `collapse` : `expand`);
      });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement(`span`);
      spacer.className = `outline-spacer`;
      row.appendChild(spacer);
    }

    const title = document.createElement(`button`);
    title.type = `button`;
    title.className = `outline-title`;
    title.textContent = item.title;
    if (item.dest) title.addEventListener(`click`, () => linkService.goToDestination(item.dest));
    row.appendChild(title);
    node.appendChild(row);

    if (hasChildren) {
      children = document.createElement(`ul`);
      children.hidden = depth !== 0;
      item.items.forEach((child) => children.appendChild(outlineNode(child, depth + 1)));
      node.appendChild(children);
    }
    return node;
  }

  // ------------------------------------------------------------------ Search

  function runSearch(query, again, backwards) {
    eventBus.dispatch(`find`, {
      source: window,
      type: again ? `again` : ``,
      query,
      caseSensitive: false,
      entireWord: false,
      highlightAll: true,
      findPrevious: Boolean(backwards),
      matchDiacritics: false
    });
  }

  function showSearchResult(state, matchesCount) {
    if (!el.searchInput.value) {
      el.searchCount.textContent = ``;
    } else if (state === FIND_STATE_NOT_FOUND || !matchesCount || !matchesCount.total) {
      el.searchCount.textContent = t(`searchNone`);
    } else {
      el.searchCount.textContent = t(`searchCount`, matchesCount);
    }
  }

  // -------------------------------------------------------------------- Zoom

  // Keeps the zoom list in sync with the real scale, adding a custom entry when needed.
  function syncZoomSelect(event) {
    const preset = event.presetValue;
    const known = [...el.zoomSelect.options].some((option) => option.value === preset);
    if (preset && known) {
      el.zoomSelect.value = preset;
      return;
    }
    el.zoomCustom.textContent = `${Math.round(event.scale * 100)} %`;
    el.zoomCustom.hidden = false;
    el.zoomSelect.value = `custom`;
  }

  function changeZoom(factor) {
    pdfViewer.currentScale = Math.min(5, Math.max(0.25, pdfViewer.currentScale * factor));
  }

  function rotate(delta) {
    pdfViewer.pagesRotation = (pdfViewer.pagesRotation + delta + 360) % 360;
    if (current.pdfDocument) buildThumbnails(current.pdfDocument);
  }

  // --------------------------------------------------------- Download & print

  function download() {
    if (!current.blobUrl) return;
    const link = document.createElement(`a`);
    link.href = current.blobUrl;
    link.download = safeFileName(current.label);
    // Some browsers ignore the file name of a link that is not attached to the page.
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // Prints through a hidden frame holding the PDF; if the browser refuses, the PDF is
  // opened in a tab where the browser own toolbar offers printing.
  function printDocument() {
    if (!current.blobUrl) return;
    const frame = document.createElement(`iframe`);
    frame.style.cssText = `position:fixed;width:0;height:0;border:0;visibility:hidden`;
    frame.src = current.blobUrl;
    frame.addEventListener(`load`, () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch {
        window.open(current.blobUrl, `_blank`, `noopener`);
      }
      setTimeout(() => frame.remove(), 60000);
    });
    document.body.appendChild(frame);
  }

  // --------------------------------------------------------- Widget messages

  // Only pages of our own site may talk to the reader.
  function onMessage(event) {
    if (event.origin !== location.origin || !event.source || !event.data) return;
    const message = event.data;
    try {
      if (message.type === `pdfplus:hello`) {
        event.source.postMessage({ type: `pdfplus:ready` }, event.origin);
      } else if (message.type === `pdfplus:open` && message.buffer instanceof ArrayBuffer) {
        const label = String(message.label || `PDF`).slice(0, MAX_LABEL_LENGTH);
        const page = Number.isInteger(message.page) && message.page > 0 ? message.page : null;
        openPdf(message.buffer, label, page);
      }
    } catch {
      // A malformed message must never break the reader.
    }
  }

  // ----------------------------------------------------------------- Wiring

  function selectTab(name) {
    const thumbs = name === `thumbnails`;
    el.tabThumbs.setAttribute(`aria-selected`, String(thumbs));
    el.tabOutline.setAttribute(`aria-selected`, String(!thumbs));
    el.panelThumbs.hidden = !thumbs;
    el.panelOutline.hidden = thumbs;
  }

  function wireControls() {
    $(`btn-sidebar`).addEventListener(`click`, () => { el.sidebar.hidden = !el.sidebar.hidden; });
    el.tabThumbs.addEventListener(`click`, () => selectTab(`thumbnails`));
    el.tabOutline.addEventListener(`click`, () => selectTab(`outline`));

    $(`btn-prev`).addEventListener(`click`, () => pdfViewer.previousPage());
    $(`btn-next`).addEventListener(`click`, () => pdfViewer.nextPage());
    el.pageInput.addEventListener(`change`, () => {
      if (current.pdfDocument) pdfViewer.currentPageNumber = Number(el.pageInput.value) || 1;
    });

    $(`btn-zoom-out`).addEventListener(`click`, () => changeZoom(1 / ZOOM_STEP));
    $(`btn-zoom-in`).addEventListener(`click`, () => changeZoom(ZOOM_STEP));
    el.zoomSelect.addEventListener(`change`, () => {
      if (el.zoomSelect.value !== `custom`) pdfViewer.currentScaleValue = el.zoomSelect.value;
    });
    $(`btn-rotate-left`).addEventListener(`click`, () => rotate(-90));
    $(`btn-rotate-right`).addEventListener(`click`, () => rotate(90));

    let searchTimer;
    el.searchInput.addEventListener(`input`, () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(el.searchInput.value, false, false), SEARCH_DELAY_MS);
    });
    el.searchInput.addEventListener(`keydown`, (event) => {
      if (event.key === `Enter`) runSearch(el.searchInput.value, true, event.shiftKey);
    });
    $(`btn-search-prev`).addEventListener(`click`, () => runSearch(el.searchInput.value, true, true));
    $(`btn-search-next`).addEventListener(`click`, () => runSearch(el.searchInput.value, true, false));
    document.addEventListener(`keydown`, (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === `f`) {
        event.preventDefault();
        el.searchInput.focus();
        el.searchInput.select();
      }
    });

    $(`btn-download`).addEventListener(`click`, download);
    $(`btn-print`).addEventListener(`click`, printDocument);

    // Keep "page width" and "whole page" correct when the window is resized.
    new ResizeObserver(() => {
      const value = pdfViewer.currentScaleValue;
      if (current.pdfDocument && Number.isNaN(Number(value))) pdfViewer.currentScaleValue = value;
    }).observe(el.container);
  }

  // ------------------------------------------------------------------- Start

  async function start() {
    applyTranslations(document);
    el.sidebar.hidden = window.innerWidth < 700;

    // PDF.js is a set of local files; the viewer component expects the library in a global.
    pdfjsLib = await import(`./vendor/pdfjs/pdf.min.mjs`);
    globalThis.pdfjsLib = pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_DIR}pdf.worker.min.mjs`;
    const viewerLib = await import(`./vendor/pdfjs/pdf_viewer.mjs`);

    eventBus = new viewerLib.EventBus();
    linkService = new viewerLib.PDFLinkService({
      eventBus,
      externalLinkTarget: viewerLib.LinkTarget.BLANK,
      externalLinkRel: `noopener noreferrer nofollow`
    });
    const findController = new viewerLib.PDFFindController({ eventBus, linkService });
    pdfViewer = new viewerLib.PDFViewer({
      container: el.container,
      viewer: el.viewer,
      eventBus,
      linkService,
      findController,
      annotationMode: pdfjsLib.AnnotationMode.ENABLE,
      imageResourcesPath: `${PDFJS_DIR}images/`
    });
    linkService.setViewer(pdfViewer);

    eventBus.on(`pagechanging`, (event) => {
      el.pageInput.value = String(event.pageNumber);
      markCurrentThumbnail(event.pageNumber);
    });
    eventBus.on(`scalechanging`, syncZoomSelect);
    eventBus.on(`updatefindmatchescount`, (event) => showSearchResult(null, event.matchesCount));
    eventBus.on(`updatefindcontrolstate`, (event) => showSearchResult(event.state, event.matchesCount));

    wireControls();
    selectTab(`thumbnails`);
    // Listen only now, so a "ready" answer always means the reader can accept a document.
    window.addEventListener(`message`, onMessage);
  }

  start().catch((error) => {
    showError(describeError(error));
  });
})();
