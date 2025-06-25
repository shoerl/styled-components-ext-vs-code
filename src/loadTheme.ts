import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export type FlattenedTheme = { [key: string]: string | number | boolean };

let cachedTheme: FlattenedTheme | null = null;
let themeJsonPath: string | null = null;

// Helper function to get the path to the theme-values.json file
// It assumes this extension's root is where 'package.json' is.
// In a packaged extension, context.extensionPath is more reliable.
const getThemeJsonPath = (context?: vscode.ExtensionContext): string => {
    if (themeJsonPath) return themeJsonPath;

    // When running in the extension host, context.extensionPath is the reliable way.
    if (context?.extensionPath) {
        themeJsonPath = path.join(context.extensionPath, 'theme', 'theme-values.json');
    } else {
        // Fallback for when context is not available (e.g. testing, or script execution outside extension)
        // This assumes a certain directory structure relative to this file.
        // This might need adjustment if the compiled output structure is different.
        // For 'out/src/loadTheme.js', __dirname is 'out/src'
        // So, '../../theme/theme-values.json' would point to '<project_root>/theme/theme-values.json'
        themeJsonPath = path.resolve(__dirname, '../../theme/theme-values.json');
    }
    return themeJsonPath;
};

/**
 * Loads the flattened theme data from theme-values.json.
 * Caches the theme in memory after the first load.
 * @param context Optional VS Code extension context.
 * @returns The flattened theme object, or null if not found or error.
 */
export const getThemeData = (context?: vscode.ExtensionContext): FlattenedTheme | null => {
    if (cachedTheme) {
        return cachedTheme;
    }

    const filePath = getThemeJsonPath(context);

    try {
        if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf-8');
            cachedTheme = JSON.parse(fileContent) as FlattenedTheme;
            console.log(`Theme data loaded successfully from ${filePath}. Keys: ${Object.keys(cachedTheme).length}`);
            return cachedTheme;
        } else {
            console.warn(`Theme data file not found at ${filePath}. Run the theme generation command.`);
            // Optionally, inform the user through a VS Code message if context is available
            // if (context) {
            //     vscode.window.showWarningMessage(
            //         'Styled Components IntelliSense: Theme data not found. Please run "Styled Theme: Generate Theme IntelliSense Data" command.',
            //         'Generate Now'
            //     ).then(selection => {
            //         if (selection === 'Generate Now') {
            //             vscode.commands.executeCommand('styled-theme-intellisense.generateTheme');
            //         }
            //     });
            // }
            return null;
        }
    } catch (error) {
        console.error(`Error loading or parsing theme data from ${filePath}:`, error);
        cachedTheme = null; // Ensure cache is cleared on error
        // Optionally, inform the user
        // if (context) {
        //     vscode.window.showErrorMessage(`Failed to load theme data: ${error.message}`);
        // }
        return null;
    }
};

/**
 * Clears the cached theme data, forcing a reload on the next getThemeData call.
 * This can be used if the theme file changes and needs to be re-loaded.
 */
export const reloadThemeData = (context?: vscode.ExtensionContext): FlattenedTheme | null => {
    cachedTheme = null;
    themeJsonPath = null; // Also clear the cached path in case context changes
    console.log('Theme data cache cleared. Will reload on next access.');
    return getThemeData(context);
};

/**
 * Initializes the theme loading process and sets up a file watcher for theme-values.json.
 * This should be called from the extension's activate function.
 * @param context VS Code extension context.
 */
export const initializeThemeLoader = (context: vscode.ExtensionContext): void => {
    getThemeData(context); // Initial load

    const filePath = getThemeJsonPath(context);

    if (fs.existsSync(path.dirname(filePath))) { // Watch the directory
        try {
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(path.dirname(filePath), path.basename(filePath))
            );

            const reload = () => {
                console.log(`Detected change in ${filePath}. Reloading theme data.`);
                reloadThemeData(context);
                // Potentially, we might need to signal other parts of the extension (providers)
                // that the theme has changed so they can update their state/diagnostics.
                // This could be done via an EventEmitter or by re-registering providers if necessary.
                vscode.window.showInformationMessage('Styled Components theme data reloaded.');
            };

            watcher.onDidChange(reload);
            watcher.onDidCreate(reload); // If the file is created after initial load attempt
            watcher.onDidDelete(() => {
                console.log(`${filePath} was deleted. Clearing theme data.`);
                cachedTheme = null;
                vscode.window.showWarningMessage('Styled Components theme data file was deleted. Please regenerate it.');
            });

            context.subscriptions.push(watcher);
            console.log(`File watcher set up for: ${filePath}`);
        } catch (error) {
            console.error("Error setting up file watcher for theme data:", error);
            vscode.window.showErrorMessage("Could not set up theme data file watcher.");
        }
    } else {
        console.warn(`Directory for theme-values.json (${path.dirname(filePath)}) does not exist. Cannot set up watcher yet.`);
        // The watcher for creation in the directory might still be useful if the dir is created later.
    }
};

// Note: The `initializeThemeLoader` sets up the watcher.
// The providers will call `getThemeData()` to get the current theme.
// If `theme-values.json` changes, the watcher calls `reloadThemeData()`,
// and subsequent calls to `getThemeData()` will get the new version.
// This makes the `getThemeData` function the single source of truth for theme access.
