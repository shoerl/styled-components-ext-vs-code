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

        const extensionPath = context.extensionPath;
        const cliScriptPath = path.join(extensionPath, 'node_modules', 'tailwindcss-themer', 'dist', 'cli.js');

        // Ensure themeFilePath is absolute
        const absoluteThemeFilePath = path.isAbsolute(themeFilePath)
            ? themeFilePath
            : path.join(projectRoot, themeFilePath);

        // Output path for the generated theme (e.g., in .vscode of the project root)
        const outputDir = path.join(projectRoot, '.vscode');
        const outputJsonPath = path.join(outputDir, 'theme-values.json');

        // Ensure .vscode directory exists
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(outputDir));
        } catch (error) {
            // Directory likely already exists, or another error occurred.
            // If it's a critical error (e.g., permissions), the command execution will fail anyway.
            console.warn(`Could not create .vscode directory (it might already exist): ${error}`);
        }

        // Construct the command to execute the CLI script directly
        // The CLI script likely takes arguments like --config and --output
        // Assuming `tailwindcss-themer` CLI arguments:
        // `node cli.js --config <path-to-theme-file> --output <path-to-output-json>`
        const command = `node "${cliScriptPath}" --config "${absoluteThemeFilePath}" --output "${outputJsonPath}"`;

        vscode.window.showInformationMessage(`Executing: ${command}`);

        const terminal = vscode.window.createTerminal({
            name: "Generate Theme Data",
            cwd: projectRoot, // Execute in project root, though script paths are absolute
        });
        terminal.sendText(command, true); // true to execute after sending
        terminal.show();

        // It's better to wait for the command to actually finish or for the file to appear
        // than using a fixed timeout. For now, we'll keep a timeout but acknowledge this limitation.
        // A more robust solution would be to watch for theme-values.json creation/modification
        // by the `initializeThemeLoader` which already watches this file.
        // The reloadThemeData is called by the file watcher in loadTheme.ts when theme-values.json changes.

        // The `reloadThemeData` and inlay hint refresh should ideally be triggered
        // by the file watcher in `loadTheme.ts` that monitors `theme-values.json`.
        // Forcing a reload here after a timeout might be redundant or premature if the command takes longer.
        // However, if the command execution itself is quick and file event propagation is delayed,
        // this can help. Let's rely on the watcher for now.
        // If issues persist, we might add a small delay here as a fallback.
        // For now, the watcher in `loadTheme.ts` should handle reloading.
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
