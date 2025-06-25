import * as vscode from 'vscode';
import * as path from 'path'; // Import path module
import { initializeThemeLoader, reloadThemeData } from './src/loadTheme';
import { ThemeCompletionItemProvider } from './src/providers/completions';
import { ThemeHoverProvider } from './src/providers/hover';
import { ThemeInlayHintsProvider } from './src/providers/inlays';

const LANGUAGES = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
let inlayHintsProvider: ThemeInlayHintsProvider | null = null;
let themeFileWatcher: vscode.FileSystemWatcher | null = null;

function getProjectRoot(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        return workspaceFolders[0].uri.fsPath;
    }
    return undefined;
}

async function handleThemeFileChange(uri: vscode.Uri | undefined, changeType: string) {
    console.log(`Theme file ${uri?.fsPath || 'undefined'} ${changeType}. Triggering regeneration.`);
    vscode.window.showInformationMessage(`Theme file changed. Regenerating IntelliSense data...`);
    try {
        await vscode.commands.executeCommand('styled-theme-intellisense.generateTheme');
        // Notification of success/failure is handled by the generateTheme command itself
        // and the subsequent reload by loadTheme.ts file watcher.
    } catch (error) {
        console.error("Error executing generateTheme command from watcher:", error);
        vscode.window.showErrorMessage(`Failed to regenerate theme data automatically: ${error}`);
    }
}

function setupThemeFileWatcher(context: vscode.ExtensionContext) {
    if (themeFileWatcher) {
        themeFileWatcher.dispose(); // Dispose existing watcher
        themeFileWatcher = null;
    }

    const projectRoot = getProjectRoot();
    if (!projectRoot) {
        console.log("No project root found, cannot set up theme file watcher.");
        return;
    }

    const config = vscode.workspace.getConfiguration('styled-theme-intellisense');
    const themeFilePathSetting = config.get<string>('themeFilePath');

    if (!themeFilePathSetting) {
        console.log("Theme file path not configured. Watcher not started.");
        return;
    }

    // Important: themeFilePathSetting might be relative (e.g., "./src/theme.ts")
    // FileSystemWatcher needs an absolute path or a pattern relative to workspace.
    // Using RelativePattern is generally more robust for workspace files.
    const absoluteThemePath = path.isAbsolute(themeFilePathSetting)
        ? themeFilePathSetting
        : path.join(projectRoot, themeFilePathSetting);

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        console.warn("Cannot set up theme file watcher: No workspace folder open.");
        return;
    }

    // Use RelativePattern for the watcher. It's relative to the workspace folder.
    // We need to find which workspace folder the theme file belongs to if multiple,
    // or assume it's in the first one if the path is relative.
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(absoluteThemePath)) || vscode.workspace.workspaceFolders[0];
    const relativePath = path.relative(workspaceFolder.uri.fsPath, absoluteThemePath);

    console.log(`Setting up watcher for theme file: ${absoluteThemePath} (relative: ${relativePath} in ${workspaceFolder.name})`);

    try {
        // GlobPattern for FileSystemWatcher should be relative to the workspace.
        themeFileWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, relativePath)
        );

        themeFileWatcher.onDidChange(uri => handleThemeFileChange(uri, 'changed'));
        themeFileWatcher.onDidCreate(uri => handleThemeFileChange(uri, 'created'));
        // onDidDelete: If the theme file is deleted, generation will fail.
        // We might want to clear existing theme-values.json or notify user differently.
        themeFileWatcher.onDidDelete(uri => {
            console.log(`Theme file ${uri.fsPath} deleted. Clearing cached theme data and notifying user.`);
            vscode.window.showWarningMessage(`Theme file (${relativePath}) was deleted. Styled Components IntelliSense may be outdated.`);
            // Optionally, clear the generated theme-values.json.
            // For now, `generateTheme` will fail and `loadTheme` will report missing `theme-values.json`.
        });

        context.subscriptions.push(themeFileWatcher);
        console.log(`Watcher active for changes to: ${absoluteThemePath}`);
    } catch (error) {
        console.error("Error creating file system watcher for theme file:", error);
        vscode.window.showErrorMessage("Could not set up watcher for the theme file.");
    }
}


// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "styled-theme-intellisense" is now active!');

    initializeThemeLoader(context); // Watches theme-values.json

    // Initial setup of user's theme file watcher
    setupThemeFileWatcher(context);

    // Listen for configuration changes to update the watcher if themeFilePath changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('styled-theme-intellisense.themeFilePath')) {
            console.log("Theme file path configuration changed. Re-initializing watcher.");
            setupThemeFileWatcher(context);
            // Optionally, auto-trigger generation if the path is new and valid
            // vscode.commands.executeCommand('styled-theme-intellisense.generateTheme');
        }
    }));

    // Command to trigger theme generation
    let generateThemeCommand = vscode.commands.registerCommand('styled-theme-intellisense.generateTheme', async () => {
        // ... (existing command logic remains the same)
        vscode.window.showInformationMessage('Generating theme data for Styled Components IntelliSense...');

        const projectRoot = getProjectRoot();
        if (!projectRoot) {
            vscode.window.showErrorMessage('No workspace open. Cannot generate theme data.');
            return;
        }

        const config = vscode.workspace.getConfiguration('styled-theme-intellisense');
        const themeFilePath = config.get<string>('themeFilePath');

        if (!themeFilePath) {
            vscode.window.showErrorMessage('Theme file path is not configured. Please set "styled-theme-intellisense.themeFilePath" in your settings.');
            return;
        }

        const command = `npm run generate-theme`;
        const executionEnv = { ...process.env, STYLED_THEME_FILE_PATH: themeFilePath };
        const terminal = vscode.window.createTerminal({
            name: "Generate Theme Data",
            cwd: projectRoot,
            env: executionEnv as { [key: string]: string | null | undefined }
        });
        terminal.sendText(command, true);
        terminal.show();

        setTimeout(() => {
            reloadThemeData(context);
            if (inlayHintsProvider) {
                inlayHintsProvider.refresh();
            }
        }, 2000);
    });
    context.subscriptions.push(generateThemeCommand);

    // Register CompletionItemProvider
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        LANGUAGES, new ThemeCompletionItemProvider(), '.'
    );
    context.subscriptions.push(completionProvider);
    console.log("ThemeCompletionItemProvider registered.");

    // Register HoverProvider
    const hoverProvider = vscode.languages.registerHoverProvider(LANGUAGES, new ThemeHoverProvider());
    context.subscriptions.push(hoverProvider);
    console.log("ThemeHoverProvider registered.");

    // Register InlayHintsProvider
    inlayHintsProvider = new ThemeInlayHintsProvider();
    const inlayHintsDisposable = vscode.languages.registerInlayHintsProvider(LANGUAGES, inlayHintsProvider);
    context.subscriptions.push(inlayHintsDisposable);
    console.log("ThemeInlayHintsProvider registered.");
}

// This method is called when your extension is deactivated
export function deactivate() {
    console.log('Your extension "styled-theme-intellisense" is now deactivated.');
    if (inlayHintsProvider) {
        inlayHintsProvider.dispose();
    }
    if (themeFileWatcher) { // Ensure watcher is disposed
        themeFileWatcher.dispose();
    }
}
