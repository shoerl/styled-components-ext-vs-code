import * as vscode from 'vscode';
import { getThemeData, FlattenedTheme } from '../loadTheme';

// Regex to detect if we are inside a styled-component template literal
// and trying to access the theme object.
// Matches:
// - `theme.`
// - `props.theme.`
// - `({ theme }) => theme.`
// - `(props) => props.theme.`
// - `({ theme: myTheme }) => myTheme.` (and similar destructuring with alias)
// It captures the prefix before the theme property access.
const THEME_ACCESS_REGEX = /(?:props\.theme\.|\(\{[\s\S]*?theme[\s\S]*?\}\)\s*=>\s*theme\.|\(\s*(\w+)\s*\)\s*=>\s*\1\.theme\.|\{\s*theme\s*\}\.|\btheme\.)$/gm;

// More specific regex to capture existing path for filtering and the part to replace
// It looks for `theme.xxx.yyy` or `({theme}) => theme.xxx.yyy` etc.
// Captures:
// 1. The full prefix like `({ theme }) => theme.` or `props.theme.`
// 2. The partial path typed so far, e.g., `palette.primary`
// Note: This regex-based approach has limitations, especially with complex aliasing of the theme object
// or unconventional access patterns. For instance, `({ theme: myTheme }) => myTheme.somePath` might not be
// correctly identified if `myTheme` is the part being completed.
// A more robust solution would involve semantic analysis using the TypeScript Language Service,
// which would benefit from plugins like `typescript-styled-plugin` if the user has it installed,
// as that plugin improves TS's understanding of styled-components contexts.
const THEME_PATH_REGEX = /((?:props\.theme\.|\(\{[\s\S]*?theme[\s\S]*?\}\)\s*=>\s*theme\.|\(\s*(\w+)\s*\)\s*=>\s*\2\.theme\.|\{\s*theme\s*\}\.|\btheme\.))([\w.]*)$/i;


// Regex to identify styled-components tagged template literals
// Looks for styled.foo`...` or styled(Component)`...`
// This is a simplified check and might need refinement for complex cases.
const STYLED_COMPONENT_REGEX = /styled(?:\.\w+|\s*\([\w.]+\))\s*`/g;


export class ThemeCompletionItemProvider implements vscode.CompletionItemProvider {
    public provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {

        // First, check if we are inside a styled-component context.
        // This is a broad check. A more robust way would be to use language server features if available
        // or parse the AST, but regex can be a good first approximation.
        // We can check a few lines around the cursor for styled`` pattern.
        const lineText = document.lineAt(position.line).text;
        const textBeforeCursor = lineText.substring(0, position.character);

        // A simple check: are we inside a JS/TS template literal at all?
        if (!this.isInsideTemplateLiteral(document, position)) {
            return null;
        }

        // More specific check: are we likely inside a styled-components template literal?
        // For performance, check only a range of lines around the cursor.
        const searchRange = new vscode.Range(
            Math.max(0, position.line - 10),
            0,
            Math.min(document.lineCount - 1, position.line + 10),
            document.lineAt(Math.min(document.lineCount - 1, position.line + 10)).text.length
        );
        const textInRange = document.getText(searchRange);
        if (!STYLED_COMPONENT_REGEX.test(textInRange)) {
            // If no "styled" tag nearby, maybe not worth processing further for performance.
            // This could be made more precise.
            // For now, we will proceed even if this is not found, relying on the theme access pattern.
        }


        // Check for `theme.` pattern before the cursor
        const themePathMatch = THEME_PATH_REGEX.exec(textBeforeCursor);
        if (!themePathMatch) {
            return null;
        }

        const [, /* fullPrefix */, /* alias if used */, typedPath] = themePathMatch;
        // console.log("Theme access detected. Typed path:", typedPath);

        const themeData = getThemeData(); // Assuming context is handled by loadTheme or not strictly needed here
        if (!themeData) {
            // console.log("Theme data not available.");
            return null;
        }

        const completions: vscode.CompletionItem[] = [];
        const existingPathPrefix = typedPath || '';
        const uniqueSuggestions = new Set<string>();

        for (const fullThemePath in themeData) {
            if (fullThemePath.startsWith(existingPathPrefix)) {
                // Suggest the next segment of the path
                let suggestion = fullThemePath;
                let insertText = fullThemePath;

                if (existingPathPrefix.length > 0) {
                    // If 'palette.pri' is typed, and full path is 'palette.primary.main'
                    // Suggestion should be 'primary.main' (the part to complete)
                    // Or, suggest 'palette.primary.main' and let VS Code handle filtering.
                    // Let's provide the full path from the 'theme.' part.
                    insertText = fullThemePath.substring(existingPathPrefix.lastIndexOf('.') + 1);
                    if (typedPath.includes('.')) { // e.g. theme.palette.
                        suggestion = fullThemePath.substring(typedPath.substring(0, typedPath.lastIndexOf('.')+1).length);
                    } else { // e.g. theme.pal
                         suggestion = fullThemePath;
                    }
                }

                // To avoid duplicate suggestions like 'palette' if 'palette.primary' and 'palette.secondary' exist,
                // we should only suggest the next part of the path or the full path if it's a direct match.
                // Example: if typed 'theme.palette.', suggest 'primary', 'secondary'
                // if typed 'theme.pal', suggest 'palette'

                let label: string;
                const remainingPath = fullThemePath.substring(existingPathPrefix.length); // e.g., if typed 'pal', and path is 'palette.main', remaining is 'ette.main'
                const nextDot = remainingPath.indexOf('.');

                if (nextDot > -1) {
                    // This is a path segment, e.g., 'palette' from 'palette.primary.main'
                    label = existingPathPrefix + remainingPath.substring(0, nextDot);
                } else {
                    // This is a leaf node or the full remaining path, e.g., 'primary' or 'main'
                    label = fullThemePath;
                }

                // More direct way: if `typedPath` is `palette.`, suggest `primary`, `secondary`.
                // If `typedPath` is `pal`, suggest `palette`.

                let suggestionKeyPart = fullThemePath;
                if (typedPath && typedPath.includes('.')) { // e.g. typed 'palette.'
                    const prefixToRemove = typedPath.substring(0, typedPath.lastIndexOf('.') + 1);
                    if (fullThemePath.startsWith(prefixToRemove)) {
                        suggestionKeyPart = fullThemePath.substring(prefixToRemove.length);
                    }
                } else if (typedPath) { // e.g. typed 'pal', suggest 'palette...'
                     // suggestionKeyPart is already fullThemePath
                }


                // We want to suggest the next "segment" or the full path if it's a leaf
                const segments = fullThemePath.split('.');
                const typedSegments = typedPath.split('.');
                let displayPath: string;

                if (!typedPath || typedPath.endsWith('.')) { // `theme.` or `theme.palette.`
                    displayPath = segments[typedSegments.length -1 + (typedPath.endsWith('.') ? 1 : 0) -1];
                     if (typedPath.endsWith('.')) {
                        displayPath = segments[typedSegments.length-1];
                     } else {
                        displayPath = segments[typedSegments.length-2] || segments[0];
                     }
                     if (typedPath.length === 0) displayPath = segments[0];


                } else { // `theme.pala`
                    displayPath = segments.slice(typedSegments.length -1).join('.');
                }

                // Let's simplify: Suggest the part of the key that hasn't been typed yet for that segment.
                // Or, just provide the full key and let VSCode filter.
                // For `theme.palette.`, we want `primary`, `secondary`.
                // For `theme.pal`, we want `palette`.

                let currentSuggestedPathSegment = '';
                if (existingPathPrefix.endsWith('.')) { // e.g. theme.palette.
                    currentSuggestedPathSegment = fullThemePath.substring(existingPathPrefix.length).split('.')[0];
                } else { // e.g. theme.p or theme.palette (no trailing dot)
                    const lastTypedSegmentPart = existingPathPrefix.substring(existingPathPrefix.lastIndexOf('.') + 1);
                    const correspondingFullSegment = fullThemePath.split('.')[existingPathPrefix.split('.').length - 1];
                    if (correspondingFullSegment && correspondingFullSegment.startsWith(lastTypedSegmentPart)) {
                         currentSuggestedPathSegment = correspondingFullSegment;
                    } else {
                        // This case should ideally not happen if fullThemePath.startsWith(existingPathPrefix)
                        currentSuggestedPathSegment = fullThemePath.split('.')[0]; // fallback
                    }
                }

                if (uniqueSuggestions.has(currentSuggestedPathSegment)) {
                    continue;
                }
                uniqueSuggestions.add(currentSuggestedPathSegment);


                const item = new vscode.CompletionItem(currentSuggestedPathSegment, vscode.CompletionItemKind.Property);

                // The text to insert should be just the segment, not the whole path from theme.
                item.insertText = currentSuggestedPathSegment;

                // Provide more info
                item.detail = `Theme Property`;
                const value = themeData[fullThemePath];
                if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                     item.documentation = new vscode.MarkdownString(`Value: \`${value}\`\n\nFull path: \`${fullThemePath}\``);
                } else {
                     item.documentation = new vscode.MarkdownString(`Full path: \`${fullThemePath}\` (Object)`);
                }

                // If the suggested segment leads to further nested paths, add a trailing dot to trigger more completions.
                // Check if `currentSuggestedPathSegment` is a complete path or leads to more.
                // e.g. if suggesting "palette" and "palette.primary" exists.
                const isLeafNode = !Object.keys(themeData).some(p => p.startsWith(fullThemePath + '.') && p !== fullThemePath);
                const isPathFullyTypedBySuggestion = (existingPathPrefix + currentSuggestedPathSegment) === fullThemePath;

                if (!isPathFullyTypedBySuggestion || !isLeafNode) {
                    // If currentSuggestedPathSegment is "palette", and "palette.primary" exists,
                    // then it's not a leaf.
                    const currentFullPrefix = existingPathPrefix.substring(0, existingPathPrefix.lastIndexOf('.') +1);
                    const potentialFullPrefix = currentFullPrefix + currentSuggestedPathSegment;

                    let hasChildren = false;
                    for(const p in themeData) {
                        if (p.startsWith(potentialFullPrefix + ".") && p !== potentialFullPrefix) {
                            hasChildren = true;
                            break;
                        }
                    }

                    if (hasChildren) {
                         item.insertText = currentSuggestedPathSegment + ".";
                         item.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions' };
                    }
                }
                completions.push(item);
            }
        }
        // console.log("Completions generated:", completions.map(c => c.label));
        return completions;
    }

    private isInsideTemplateLiteral(document: vscode.TextDocument, position: vscode.Position): boolean {
        // Simplified check: look for backticks on the current line or nearby.
        // A proper solution would involve parsing or using language service features.
        const lineText = document.lineAt(position.line).text;
        let backtickCountBefore = 0;
        for (let i = 0; i < position.character; i++) {
            if (lineText[i] === '`') {
                backtickCountBefore++;
            }
            // Consider escaped backticks `\` \`` - this simple check doesn't.
        }

        // If odd number of backticks before cursor on this line, we are inside.
        if (backtickCountBefore % 2 === 1) {
            return true;
        }

        // Check previous lines if even number of backticks (or zero) on current line before cursor
        // This means a multi-line template literal might have started on a previous line.
        // This part can be complex and slow if not careful.
        // For now, we rely on the `theme.` pattern being close to the cursor.
        // A more advanced check could use VS Code's tokenization or AST.
        // For this PoC, the THEME_PATH_REGEX is the main driver after this basic check.

        // A quick check for `${` before cursor, as theme access is usually within interpolations
        const textBefore = lineText.substring(0, position.character);
        if (textBefore.includes('${')) {
            // This is a good indicator, but not foolproof.
            // Ensure the last `${` isn't closed by a `}` yet.
            const lastOpenInterpolation = textBefore.lastIndexOf('${');
            const lastCloseInterpolation = textBefore.lastIndexOf('}');
            if (lastOpenInterpolation > -1 && lastOpenInterpolation > lastCloseInterpolation) {
                 return true;
            }
        }
        // Fallback: if the line has an odd number of backticks in total, and cursor is after the first one.
        // This is still very approximate.
        return false; // Be conservative if not sure.
    }
}
