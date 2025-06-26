import * as vscode from 'vscode';
import { getThemeData, FlattenedTheme } from '../loadTheme';

// Regex to identify theme access in styled-components.
// Matches patterns like:
// - `theme.`
// - `props.theme.`
// - `({ theme }) => theme.`
// - `(props) => props.theme.`
// - `({ theme: myTheme }) => myTheme.`
// It captures the prefix (e.g., "theme.") and the path typed so far (e.g., "colors.primary").
const THEME_ACCESS_PATTERN = /(?:props\.theme\.|\(\{[\s\S]*?theme[\s\S]*?\}\)\s*=>\s*theme\.|\(\s*\w+\s*\)\s*=>\s*\w+\.theme\.|\{\s*theme\s*\}\.|\btheme\.)([\w.]*)$/i;

export class ThemeCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);

        // Check if the cursor is in a theme access context
        const match = THEME_ACCESS_PATTERN.exec(textBeforeCursor);
        if (!match) {
            return null;
        }

        const typedPath = match[1] || ''; // The path typed so far, e.g., "colors.primary" or ""

        const themeData = getThemeData();
        if (!themeData) {
            return null;
        }

        const completions: vscode.CompletionItem[] = [];
        const uniqueSuggestions = new Set<string>();

        for (const fullThemePath in themeData) {
            if (fullThemePath.startsWith(typedPath)) {
                // Determine the next segment of the path to suggest
                // e.g., if typedPath is "colors." and fullThemePath is "colors.primary.main", suggest "primary"
                // e.g., if typedPath is "col" and fullThemePath is "colors.primary.main", suggest "colors"

                let suggestionSegment: string;
                const remainingPath = fullThemePath.substring(typedPath.length); // Path part after what's typed

                if (typedPath.endsWith('.')) { // e.g. "colors."
                    suggestionSegment = remainingPath.split('.')[0];
                } else { // e.g. "col" or "colors" (no trailing dot)
                    const typedSegments = typedPath.split('.');
                    const fullPathSegments = fullThemePath.split('.');
                    if (typedSegments.length > 0 && fullPathSegments.length >= typedSegments.length) {
                        suggestionSegment = fullPathSegments[typedSegments.length - 1];
                    } else {
                        // Should not happen if fullThemePath.startsWith(typedPath)
                        continue;
                    }
                }

                if (!suggestionSegment || uniqueSuggestions.has(suggestionSegment)) {
                    continue;
                }
                uniqueSuggestions.add(suggestionSegment);

                const item = new vscode.CompletionItem(suggestionSegment, vscode.CompletionItemKind.Property);

                // This is the full path that this suggestion would complete to from the root of the theme object
                // e.g. if typedPath = "colors.pri", suggestionSegment = "primary" -> potentialFullThemePath = "colors.primary"
                // e.g. if typedPath = "colors.", suggestionSegment = "primary" -> potentialFullThemePath = "colors.primary"
                // e.g. if typedPath = "co", suggestionSegment = "colors" -> potentialFullThemePath = "colors"
                let potentialFullThemePath: string;
                if (typedPath.endsWith('.')) {
                    potentialFullThemePath = typedPath + suggestionSegment;
                } else {
                    const lastDotIndex = typedPath.lastIndexOf('.');
                    if (lastDotIndex === -1) { // e.g. typedPath = "co"
                        potentialFullThemePath = suggestionSegment;
                    } else { // e.g. typedPath = "colors.pri"
                        potentialFullThemePath = typedPath.substring(0, lastDotIndex + 1) + suggestionSegment;
                    }
                }

                let hasChildren = false;
                for (const p in themeData) {
                    if (p.startsWith(potentialFullThemePath + ".") && p !== potentialFullThemePath) {
                        hasChildren = true;
                        break;
                    }
                }

                // If the suggestion itself isn't a direct key and has no children, it might be an invalid intermediate suggestion.
                // Example: typedPath = "colo", fullThemePath = "colors.primary". Suggestion "colors".
                // potentialFullThemePath = "colors". This is valid.
                // Example: typedPath = "colors.primar", fullThemePath = "colors.primary.main". Suggestion "primary".
                // potentialFullThemePath = "colors.primary". This is valid.
                if (!themeData.hasOwnProperty(potentialFullThemePath) && !hasChildren) {
                     // This logic might be too aggressive if suggestionSegment is a partial match for a key
                     // and potentialFullThemePath is not a direct key but a prefix to other keys.
                     // Let's ensure the suggestionSegment at least forms a valid starting part of some key.
                     let formsValidPrefix = false;
                     for (const p in themeData) {
                         if (p.startsWith(potentialFullThemePath)) {
                             formsValidPrefix = true;
                             break;
                         }
                     }
                     if (!formsValidPrefix) continue;
                }


                item.insertText = suggestionSegment;
                item.filterText = suggestionSegment; // User types 'pri', suggestion 'primary' should match.

                if (hasChildren) {
                    item.insertText += ".";
                    item.kind = vscode.CompletionItemKind.Module;
                    item.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions' };
                } else {
                    // It's a leaf value if it doesn't have children.
                    // It could also be an object itself if it's the end of a path but not a primitive.
                    // For simplicity, if no children, consider it a Value kind.
                    item.kind = vscode.CompletionItemKind.Value;
                }

                item.detail = `Theme: ${potentialFullThemePath}`;
                const displayValue = themeData[potentialFullThemePath];
                if (displayValue !== undefined) {
                    if (typeof displayValue === 'string' || typeof displayValue === 'number' || typeof displayValue === 'boolean') {
                        item.documentation = new vscode.MarkdownString(`Value: \`${displayValue}\`\n\nFull path: \`${potentialFullThemePath}\``);
                    } else {
                        item.documentation = new vscode.MarkdownString(`Full path: \`${potentialFullThemePath}\` (Object)`);
                    }
                } else {
                     item.documentation = new vscode.MarkdownString(`Path: \`${potentialFullThemePath}\``);
                }

                completions.push(item);
            }
        }
        return completions;
    }
}
