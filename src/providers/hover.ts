import * as vscode from 'vscode';
import { getThemeData, FlattenedTheme } from '../loadTheme';

// Regex to identify a potential theme path under the cursor
// This will look for sequences of identifiers separated by dots,
// potentially prefixed by 'theme.' or common destructuring patterns.
// Example: theme.palette.primary.main, palette.primary.main (if palette is from theme)
// This is a simplified regex and might need to be more context-aware.
const POTENTIAL_THEME_PATH_REGEX = /\b(?:theme\.)?([\w.]+)\b/g;

// More specific regex if we know it's a theme access.
// Looks for theme.a.b.c or if we can identify a variable that IS theme, then var.a.b.c
// For now, let's focus on explicit `theme.path` and simple destructured cases.
// Note: The regex-based context detection here has limitations. It may not correctly
// identify theme paths in all scenarios, especially with complex destructuring,
// aliasing (`const myTheme = props.theme; myTheme.path.to.value`), or when theme
// is passed through multiple function calls.
// A more robust solution would involve semantic analysis using the TypeScript
// Language Service. Such analysis would allow tracing variables back to their
// origins and checking their types, providing more accurate theme path detection.
// If `typescript-styled-plugin` is active, it would improve the TS Language Service's
// understanding of the surrounding styled-components code, potentially aiding such
// semantic analysis.

export class ThemeHoverProvider implements vscode.HoverProvider {
    public provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        const themeData = getThemeData();
        if (!themeData) {
            return null;
        }

        // Get the word range at the current position
        const wordRange = document.getWordRangeAtPosition(position, /[\w.]+/);
        if (!wordRange) {
            return null;
        }

        let hoveredWord = document.getText(wordRange);
        // console.log("Hovered word:", hoveredWord);

        // Attempt to determine the full theme path based on context
        // This is the challenging part, especially with destructuring.

        // Case 1: Direct theme access: `theme.palette.primary.main`
        // We need to check if the hoveredWord is part of such a structure.
        // We can read a bit of text around the wordRange to get more context.
        const lineText = document.lineAt(position.line).text;
        const linePrefix = lineText.substring(0, wordRange.end.character); // Text on the line up to the end of the hovered word

        let fullThemePath: string | null = null;

        // Try to match `theme.some.path` where `some.path` is the hovered word,
        // or `theme.some` where `some` is hovered, or `theme.some.path` where `theme.some.path` is hovered.
        const themePrefixPattern = /(?:(\btheme\b|\bprops\.theme\b|\(\s*\{[\s\S]*?theme[\s\S]*?\}\s*=>\s*theme\b)\.)([\w.]+)/g;
        let match;
        // Iterate over matches on the line to find one that includes our hovered word.
        // This is complex because wordRange might be part of a larger path.

        // Simpler approach: If hoveredWord starts with "theme.", treat the rest as path.
        if (hoveredWord.startsWith('theme.')) {
            fullThemePath = hoveredWord.substring('theme.'.length);
        } else {
            // This is where detecting destructured variables would go.
            // For example, if `const { palette } = theme;` exists, and user hovers `palette.primary.main`.
            // This requires more advanced scope analysis (beyond simple regex on current line).
            // For V1, we might primarily support `theme.X.Y.Z`.
            // Let's try a more greedy match from the start of the line to the hovered word.
            const extendedHoverText = this.getExtendedHoverText(document, position, hoveredWord);
            if (extendedHoverText?.startsWith('theme.')) {
                fullThemePath = extendedHoverText.substring('theme.'.length);
            }
            // A slightly more robust check for patterns like `({ theme }) => theme.path` or `props.theme.path`
            // We check if the `hoveredWord` is part of a path that follows such a prefix.
            else {
                 // Check if `hoveredWord` is prefixed by `theme.` or similar patterns.
                const lineTillHover = document.lineAt(position.line).text.substring(0, wordRange.end.character);
                const themeAccessPatterns = [
                    /\btheme\.([\w.]+)$/, // theme.path
                    /\bprops\.theme\.([\w.]+)$/, // props.theme.path
                    /\(\s*\{\s*theme\s*\}\s*\)\s*=>\s*theme\.([\w.]+)$/, // ({theme}) => theme.path
                    // /\(\s*(\w+)\s*\)\s*=>\s*\1\.theme\.([\w.]+)$/, // (p) => p.theme.path (difficult to bind \1 to 'theme')
                ];

                for (const pattern of themeAccessPatterns) {
                    const specificMatch = pattern.exec(lineTillHover);
                    if (specificMatch && specificMatch[1] && (hoveredWord === specificMatch[1] || specificMatch[1].endsWith(hoveredWord))) {
                         // Ensure the match ends at our cursor's word, or our word is the end of the match
                        if (lineText.substring(wordRange.start.character, wordRange.end.character) === document.getText(wordRange)) {
                           fullThemePath = specificMatch[1];
                           break;
                        }
                    }
                }
            }
        }

        if (fullThemePath && themeData.hasOwnProperty(fullThemePath)) {
            const value = themeData[fullThemePath];
            const markdownString = new vscode.MarkdownString();
            markdownString.appendCodeblock(`${fullThemePath}: ${value}`, 'typescript');

            // Optional: Add color swatch for hex values
            if (typeof value === 'string' && /^#([0-9A-Fa-f]{3,4}){1,2}$/.test(value)) {
                // VSCode doesn't natively support color swatches in MarkdownString for hovers directly in this way.
                // However, some extensions achieve this using decorations or other means.
                // For a simple hover, we just show the value.
                // A ColorInformation provider would be the "correct" way for color boxes.
            }
            return new vscode.Hover(markdownString, wordRange);
        }

        // Fallback or more complex destructuring (very simplified for now)
        // This part is highly experimental and would need proper AST parsing for robustness.
        if (!fullThemePath) {
            const potentialPath = hoveredWord; // e.g. "palette.primary.main"
            if (themeData.hasOwnProperty(potentialPath)) {
                 // How do we confirm `palette` came from `theme`?
                 // We'd need to scan upwards for `const { palette } = theme;` or similar.
                 // This is a placeholder for future, more advanced logic.
                 // For now, if the hovered word itself is a full key, show it.
                 // This might lead to false positives if a variable has the same name as a theme key.
                 // To make it slightly safer, check if we are inside a styled component context
                 const lineText = document.lineAt(position.line).text;
                 if (lineText.includes('${') && (lineText.includes('styled') || document.fileName.endsWith('.styled.ts'))) { // very rough check
                    const value = themeData[potentialPath];
                    const markdownString = new vscode.MarkdownString();
                    markdownString.appendCodeblock(`${potentialPath}: ${value}`, 'typescript');
                    markdownString.appendMarkdown(`\n*(Note: Assuming \`${potentialPath.split('.')[0]}\` is derived from theme)*`);
                    return new vscode.Hover(markdownString, wordRange);
                 }
            }
        }


        return null;
    }

    /**
     * Tries to get a more complete theme path if the hovered word is part of one.
     * e.g. if hovering `primary` in `theme.palette.primary.main`
     */
    private getExtendedHoverText(document: vscode.TextDocument, position: vscode.Position, currentWord: string): string | null {
        const lineText = document.lineAt(position.line).text;
        // Regex to find word sequences like identifier.identifier or theme.identifier.identifier
        // This regex will find all such sequences on the line
        const pathRegex = /([\w$.]+)/g;
        let match;

        while((match = pathRegex.exec(lineText)) !== null) {
            const potentialPath = match[0];
            const matchStartIndex = match.index;
            const matchEndIndex = match.index + potentialPath.length;

            // Check if the current cursor position (of the hovered word) is within this found path
            if (position.character >= matchStartIndex && position.character <= matchEndIndex) {
                // Further check if this path starts with 'theme.' or is a plausible theme path
                if (potentialPath.startsWith('theme.') || potentialPath.includes('.')) { // Basic check
                    // Ensure the currentWord is part of this path
                    if (potentialPath.includes(currentWord)) {
                         // Check if this potential path is an actual key or prefix in themeData
                        const themeData = getThemeData();
                        if(themeData) {
                            if (potentialPath.startsWith("theme.") && themeData[potentialPath.substring("theme.".length)]) {
                                return potentialPath;
                            }
                            // Add more heuristics if needed for destructured paths
                        }
                    }
                }
            }
        }
        return null;
    }
}
