// Minimal translation helper shared by the widget page and the reader page.
// The language is picked from the browser: French if it starts with "fr", English otherwise.
(function () {
  const dictionaries = {
    fr: {
      // Column mapping shown in the Grist creator panel
      columnAttachments: `Pièces jointes (PDF)`,
      columnAttachmentsHelp: `Colonne de type Pièces jointes`,
      columnLinks: `Liens (un par ligne)`,
      columnLinksHelp: `Colonne de type Texte contenant des liens https, un par ligne`,
      columnNames: `Noms des boutons (pièces jointes puis liens)`,
      columnNamesHelp: `Un nom par ligne, dans cet ordre : d'abord le nom de chaque pièce jointe, puis le nom de chaque lien. Exemple : ligne 1 = première pièce jointe, ligne 2 = premier lien.`,

      // Widget messages
      pickRow: `Sélectionnez une ligne du tableau.`,
      needMapping: `Dans le panneau de droite, sous le niveau d'accès, choisissez la colonne des pièces jointes ou la colonne des liens.`,
      noDocuments: `Aucun document pour cette ligne.`,
      documentN: `Document {n}`,
      openTitle: `Ouvrir dans la fenêtre du lecteur`,
      rejectedValues: `{count} valeur(s) ignorée(s) dans la colonne « {column} » (exemples : {examples}). Seuls les liens https:// et les pièces jointes sont acceptés. Vérifiez cette colonne dans la ligne sélectionnée.`,
      andOthers: `{examples} et {rest} autres`,
      popupBlocked: `Le navigateur a bloqué la fenêtre. Autorisez les fenêtres surgissantes pour ce site puis cliquez de nouveau sur le bouton.`,
      attachmentFallback: `Lecture de la pièce jointe impossible dans le lecteur intégré : le document est ouvert directement par le navigateur.`,
      needFullAccess: `Les pièces jointes ne peuvent être lues qu'avec l'accès complet au document. Dans le panneau de droite, réglez le niveau d'accès sur « Accès complet au document ». Les liens fonctionnent avec la lecture de la table.`,

      // Reader
      readerWaiting: `En attente d'un document depuis Grist. Cliquez sur un bouton dans le widget.`,
      toggleSidebar: `Afficher ou masquer le panneau latéral`,
      tabThumbnails: `Miniatures`,
      tabOutline: `Chapitres`,
      noOutline: `Ce document ne contient pas de chapitres (signets).`,
      previousPage: `Page précédente`,
      nextPage: `Page suivante`,
      pageLabel: `Numéro de page`,
      pageTotal: `/ {total}`,
      zoomLevel: `Niveau de zoom`,
      zoomOut: `Zoom arrière`,
      zoomIn: `Zoom avant`,
      zoomAuto: `Automatique`,
      zoomPageWidth: `Largeur de page`,
      zoomPageFit: `Page entière`,
      rotateLeft: `Pivoter à gauche`,
      rotateRight: `Pivoter à droite`,
      searchPlaceholder: `Rechercher dans le document`,
      searchPrevious: `Résultat précédent`,
      searchNext: `Résultat suivant`,
      searchNone: `Aucun résultat`,
      searchCount: `{current} / {total}`,
      download: `Télécharger`,
      print: `Imprimer`,
      expand: `Déplier`,
      collapse: `Replier`,
      errorPassword: `Ce document est protégé par un mot de passe : le lecteur ne peut pas l'ouvrir.`,
      errorInvalid: `Ce fichier n'est pas un PDF lisible.`,
      errorGeneric: `Le document n'a pas pu être ouvert : {reason}`
    },
    en: {
      columnAttachments: `Attachments (PDF)`,
      columnAttachmentsHelp: `Column of type Attachments`,
      columnLinks: `Links (one per line)`,
      columnLinksHelp: `Text column holding https links, one per line`,
      columnNames: `Button names (attachments then links)`,
      columnNamesHelp: `One name per line, in this order: first the name of each attachment, then the name of each link. Example: line 1 = first attachment, line 2 = first link.`,

      pickRow: `Select a row in the table.`,
      needMapping: `In the right-hand panel, under the access level, choose the attachments column or the links column.`,
      noDocuments: `No document for this row.`,
      documentN: `Document {n}`,
      openTitle: `Open in the reader window`,
      rejectedValues: `{count} value(s) ignored in column "{column}" (examples: {examples}). Only https:// links and attachments are accepted. Check this column in the selected row.`,
      andOthers: `{examples} and {rest} more`,
      popupBlocked: `The browser blocked the window. Allow pop-ups for this site then click the button again.`,
      attachmentFallback: `The attachment cannot be read by the built-in reader: the browser opens the document directly.`,
      needFullAccess: `Attachments can only be read with full document access. In the right-hand panel, set the access level to "Full document access". Links work with read-table access.`,

      readerWaiting: `Waiting for a document from Grist. Click a button in the widget.`,
      toggleSidebar: `Show or hide the side panel`,
      tabThumbnails: `Thumbnails`,
      tabOutline: `Chapters`,
      noOutline: `This document has no chapters (bookmarks).`,
      previousPage: `Previous page`,
      nextPage: `Next page`,
      pageLabel: `Page number`,
      pageTotal: `/ {total}`,
      zoomLevel: `Zoom level`,
      zoomOut: `Zoom out`,
      zoomIn: `Zoom in`,
      zoomAuto: `Automatic`,
      zoomPageWidth: `Page width`,
      zoomPageFit: `Whole page`,
      rotateLeft: `Rotate left`,
      rotateRight: `Rotate right`,
      searchPlaceholder: `Search in the document`,
      searchPrevious: `Previous result`,
      searchNext: `Next result`,
      searchNone: `No result`,
      searchCount: `{current} / {total}`,
      download: `Download`,
      print: `Print`,
      expand: `Expand`,
      collapse: `Collapse`,
      errorPassword: `This document is password protected: the reader cannot open it.`,
      errorInvalid: `This file is not a readable PDF.`,
      errorGeneric: `The document could not be opened: {reason}`
    }
  };

  const lang = String(navigator.language || ``).toLowerCase().startsWith(`fr`) ? `fr` : `en`;

  // Returns the translated text for a key, replacing each {name} with values[name].
  function t(key, values) {
    const template = dictionaries[lang][key];
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      values && values[name] !== undefined ? String(values[name]) : match
    );
  }

  // Fills every element carrying a data-i18n* attribute (text, title and placeholder).
  function applyTranslations(root) {
    document.documentElement.lang = lang;
    root.querySelectorAll(`[data-i18n]`).forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    root.querySelectorAll(`[data-i18n-title]`).forEach((el) => {
      const text = t(el.dataset.i18nTitle);
      el.title = text;
      el.setAttribute(`aria-label`, text);
    });
    root.querySelectorAll(`[data-i18n-placeholder]`).forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
  }

  window.pdfPlusI18n = { t, lang, applyTranslations };
})();
