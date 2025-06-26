import * as vscode from 'vscode';
import { getThemeData, FlattenedTheme } from '../loadTheme';

// Regex to find theme access patterns in a line of code.
// Looks for: theme.path.to.value, props.theme.path.to.value, ({theme}) => theme.path.to.value
// Captures:
// 1. The full match (e.g., "theme.palette.primary.main")
// 2. The prefix if any (e.g., "theme.")
// 3. The actual theme key path (e.g., "palette.primary.main")
// Note: This regex (`THEME_PATH_DETECTION_REGEX`) is used to find all occurrences of theme access patterns
// in the visible code range. Like other regex-based approaches in this extension, it has limitations:
// - It might not correctly handle all forms of aliasing (e.g., `const { theme: myTheme } = props; ... myTheme.path`).
//   The current pattern for destructuring `(?:\(\s*\{[^}]*theme[^}]*\}\s*\)\s*=>\s*theme\.([\w.]+)\b)`
//   specifically looks for the literal `theme.` after the arrow, which doesn't cover aliased usage like `myAlias.path`.
// - Complex JavaScript expressions or indirect theme access might be missed.
// For truly robust detection, semantic analysis via the TypeScript Language Service would be necessary.
// This would involve parsing the code into an Abstract Syntax Tree (AST), resolving symbols,
// and checking types to confirm that an expression indeed refers to a theme property.
// The `typescript-styled-plugin`, if installed by the user, enhances the TS Language Service's
// understanding of code within styled-components, which would make such semantic analysis more accurate
// for theme accesses within those contexts.
const THEME_PATH_DETECTION_REGEX = /(?:\btheme\.([\w.]+)\b)|(?:props\.theme\.([\w.]+)\b)|(?:\(\s*\{[^}]*theme[^}]*\}\s*\)\s*=>\s*theme\.([\w.]+)\b)/g;


export class ThemeInlayHintsProvider implements vscode.InlayHintsProvider {
    private _onDidChangeInlayHints: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeInlayHints: vscode.Event<void> = this._onDidChangeInlayHints.event;

    private themeData: FlattenedTheme | null = null;
    private watchers: vscode.Disposable[] = [];

    constructor() {
        // Initial load
        this.themeData = getThemeData();

        // Listen for theme data changes (e.g., if theme-values.json is updated)
        // This requires a mechanism in loadTheme to notify listeners, or we poll/re-check.
        // For now, we assume loadTheme.ts handles reloading and getThemeData() returns the latest.
        // A more robust solution would be an event emitter from the theme loader.
        // As `loadTheme.ts` now has a file watcher that updates its internal cache,
        // calling `getThemeData()` should give us the latest. We just need to refresh hints.

        // For simplicity, let's refresh hints when documents are changed or saved.
        // VS Code also re-requests hints on config changes or when the provider signals.
        vscode.workspace.onDidChangeTextDocument(event => {
            // Check if the changed document is one we care about
            if (vscode.languages.match(['javascript', 'typescript', 'javascriptreact', 'typescriptreact'], event.document)) {
                this.refresh();
            }
        });

        // TODO: Listen to an event from `loadTheme.ts` if it ever emits one for theme reloads.
        // For now, the file watcher in `loadTheme.ts` will clear its cache.
        // The inlay hints will be re-requested by VSCode when it deems necessary,
        // or we can force it by firing `_onDidChangeInlayHints`.
        // Let's try to tie into the reload mechanism of `loadTheme` more directly if possible,
        // or just refresh periodically or on specific events.
        // The `initializeThemeLoader` in `loadTheme.ts` shows a message on reload. We can use that as a cue too.
    }

    public refresh(): void {
        this.themeData = getThemeData(); // Re-fetch in case it changed
        this._onDidChangeInlayHints.fire();
    }

    public provideInlayHints(
        document: vscode.TextDocument,
        range: vscode.Range,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.InlayHint[]> {
        this.themeData = getThemeData(); // Ensure we have the latest
        if (!this.themeData) {
            return [];
        }

        const hints: vscode.InlayHint[] = [];
        const text = document.getText(range);
        const offset = document.offsetAt(range.start);

        // Iterate over all matches of theme paths in the visible range
        let match;
        THEME_PATH_DETECTION_REGEX.lastIndex = 0; // Reset regex state
        while ((match = THEME_PATH_DETECTION_REGEX.exec(text)) !== null) {
            if (token.isCancellationRequested) {
                return [];
            }

            const fullMatchedString = match[0];
            // Determine the actual path: match[1] for theme.X, match[2] for props.theme.X, match[3] for ({theme}) => theme.X
            const themeKeyPath = match[1] || match[2] || match[3];

            if (themeKeyPath && this.themeData.hasOwnProperty(themeKeyPath)) {
                const value = this.themeData[themeKeyPath];
                let displayValue: string;

                if (typeof value === 'string') {
                    // Truncate long strings
                    displayValue = value.length > 20 ? value.substring(0, 17) + '...' : value;
                } else if (typeof value === 'number' || typeof value === 'boolean') {
                    displayValue = String(value);
                } else {
                    // Don't show hints for objects/arrays for now, could be too noisy
                    continue;
                }

                const matchStartOffset = match.index;
                const position = document.positionAt(offset + matchStartOffset + fullMatchedString.length);

                const hint = new vscode.InlayHint(
                    position,
                    `= ${displayValue}`,
                    vscode.InlayHintKind.Parameter // Or Type, depending on preference
                );
                hint.tooltip = new vscode.MarkdownString(`Theme: \`${themeKeyPath}: ${value}\``);
                // hint.paddingLeft = true; // Add some padding if desired

                hints.push(hint);
            }
        }
        return hints;
    }

    dispose() {
        this._onDidChangeInlayHints.dispose();
        this.watchers.forEach(watcher => watcher.dispose());
    }
}
