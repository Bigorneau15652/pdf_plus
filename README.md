# pdf_plus

English first, version française plus bas.

## English

A custom widget for [Grist](https://www.getgrist.com) that shows one button per document of the selected row and opens the chosen document in a separate reader window. The window follows the row selection: when you select another row, it switches to the first document of that row (only if that document is different from the one already shown).

What it does with each kind of value:

- A PDF stored in a Grist attachment column is read by the built-in reader (PDF.js): thumbnails, chapters (bookmarks), text search, zoom, rotation, go to a page, download, print.
- An https link (Nextcloud, OneDrive, Google Drive, kDrive or any other site) is opened in the reader window with the drive own viewer. The widget never downloads these files itself, so there is no proxy and no CORS requirement.

Each row can hold several documents: one button per document, optionally renamed through a "names" column (one name per line, same order as the documents), and optionally opened on a given page through a "page" column.

### Install

1. Publish the repository with GitHub Pages: Settings, Pages, Source "Deploy from a branch", branch `main`, folder `/ (root)`.
2. The widget address is `https://YOUR-ACCOUNT.github.io/pdf_plus/index.html`.
3. In Grist, add a page with a custom widget, paste that address, and give it read access to the table ("Read table" in the English interface).
4. In the right-hand panel, under the access level, choose the columns: attachments and/or links (at least one), then names and page (optional).

If your Grist server is not `grist.numerique.gouv.fr`, edit two places in `index.html`: the `src` of the `grist-plugin-api.js` script and the host named in the Content-Security-Policy line just above it (for the public service use `https://docs.getgrist.com`).

### Columns

A Grist column holds a single type, so attachments and links go in two columns that you can both map. Rows may use either one or both.

- Attachments: a column of type Attachments.
- Links: a column of type Text with one https link per line. A link may end with `#page=5` to open a given page.
- Names (optional): one name per line. The first lines name the attachments, the following lines name the links. A blank line keeps the default name (PDF file name in the link, otherwise the site name, or "Document N" for an attachment).
- Page (optional): a number, applied to the document being opened.

When a row has both, the buttons list the attachments first, then the links.

### Security and privacy

- The only external script is the Grist plugin API, loaded from your own Grist server. PDF.js is shipped in `vendor/pdfjs`; nothing is loaded from a CDN, and no data is sent to any third-party service.
- The reader page has a Content-Security-Policy that forbids any network access other than this site, and PDF.js runs with `isEvalSupported` disabled.
- Links must be absolute https addresses without embedded credentials; anything else is ignored and reported in a banner naming the column and examples.
- User data (names, links) is only ever inserted into the page as text, never as HTML.
- Messages between the widget and the reader are accepted only from the same origin.
- Known trade-off: the reader window keeps its link to the widget (`window.opener`). Grist runs widgets in a sandboxed frame, which may only navigate windows it opened itself, so this link cannot be cut. A drive page opened in that window could in theory redirect the widget frame; only open links you trust.
- If the built-in reader cannot fetch an attachment, the browser opens it directly with a short-lived read-only Grist token in the address.

### Releasing a change

Browsers keep GitHub Pages files for about ten minutes. The pages reference their scripts with `?v=0.2.0`: change that number in `index.html`, `viewer.html` and `widget.js` (READER_URL) with every release so that users get the new files at once.

### Update PDF.js

Replace the files listed in `vendor/pdfjs/VENDOR.md` with those of the new `pdfjs-dist` release, then test the reader again.

### Files

- `index.html`, `widget.js`, `widget.css`: the widget (buttons, row following, reader window).
- `documents.js`: turns a cell value into a list of documents (no page access, testable with Node).
- `viewer.html`, `viewer.js`, `viewer.css`: the reader window.
- `shared/i18n.js`: French and English texts, picked from the browser language.
- `vendor/pdfjs`: PDF.js 4.10.38 (Apache 2.0).

Licence: MIT for this project, Apache 2.0 for PDF.js.

## Français

Widget personnalisé pour [Grist](https://www.getgrist.com) qui affiche un bouton par document de la ligne sélectionnée et ouvre le document choisi dans une fenêtre de lecteur séparée. La fenêtre suit la sélection : quand vous changez de ligne, elle bascule sur le premier document de la nouvelle ligne, uniquement si ce document est différent de celui déjà affiché.

Une pièce jointe PDF de Grist est lue par le lecteur intégré (PDF.js) : miniatures, chapitres (signets), recherche dans le texte, zoom, rotation, accès à une page, téléchargement et impression. Un lien https (Nextcloud, OneDrive, Google Drive, kDrive ou autre) est ouvert dans la fenêtre avec le lecteur propre au drive. Le widget ne télécharge jamais ces fichiers : il n'y a ni proxy ni contrainte CORS.

### Installation pas à pas

1. Sur GitHub, ouvrez le dépôt, puis Settings, puis Pages. Sous Source, choisissez « Deploy from a branch », la branche `main` et le dossier `/ (root)`, puis cliquez sur Save. Attendez une à deux minutes.
2. L'adresse du widget est `https://VOTRE-COMPTE.github.io/pdf_plus/index.html`.
3. Dans Grist : Ajouter, puis Ajouter une page, puis choisissez Personnalisée. Collez l'adresse du widget et donnez-lui l'accès en lecture à la table.
4. Dans le panneau de droite, sous le niveau d'accès, choisissez la colonne des pièces jointes et/ou la colonne des liens (au moins une), puis les colonnes des noms et de la page (facultatives).

Si votre serveur Grist n'est pas `grist.numerique.gouv.fr`, modifiez deux endroits dans `index.html` : l'adresse du script `grist-plugin-api.js` et l'hôte indiqué dans la ligne Content-Security-Policy située juste au-dessus.

### Colonnes

Une colonne Grist n'a qu'un seul type : les pièces jointes et les liens vont donc dans deux colonnes, que vous associez toutes les deux au widget. Une ligne peut utiliser l'une, l'autre ou les deux.

La colonne Pièces jointes est de type Pièces jointes. La colonne Liens est de type Texte, avec un lien https par ligne ; un lien peut se terminer par `#page=5` pour s'ouvrir à une page précise. La colonne des noms (facultative) contient un nom par ligne : les premières lignes nomment les pièces jointes, les suivantes nomment les liens. Une ligne vide garde le nom par défaut (nom du fichier PDF dans le lien, sinon nom du site, ou « Document N » pour une pièce jointe). La colonne de la page (facultative) contient un numéro appliqué au document ouvert. Quand une ligne a les deux, les pièces jointes sont listées avant les liens.

### Sécurité

Le seul script externe est l'API de plugin Grist, chargée depuis votre propre serveur Grist. PDF.js est embarqué dans `vendor/pdfjs` : rien n'est chargé depuis un CDN et aucune donnée n'est envoyée à un service tiers. Le lecteur applique une politique de sécurité qui interdit tout accès réseau hors de ce site. Seuls les liens https sont acceptés. Les noms et liens saisis dans Grist ne sont jamais insérés comme du HTML.

Limite connue : la fenêtre du lecteur garde son lien avec le widget (`window.opener`), car Grist exécute les widgets dans un cadre isolé qui ne peut naviguer que dans les fenêtres qu'il a lui-même ouvertes. N'ouvrez que des liens de confiance.
