# Styled Components Theme IntelliSense for VS Code

Provides enhanced IntelliSense for projects using `styled-components` with a theme, especially Material UI themes created via `createTheme()`. Get autocompletion, hover information, and inlay hints for your theme properties directly within your styled template literals.

## Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js and npm**: Required for managing dependencies and running scripts. You can download them from [nodejs.org](https://nodejs.org/).
*   **`vsce` (Visual Studio Code Extensions command-line tool)**: Needed if you plan to package the extension from source. Install it globally via npm:
    ```bash
    npm install -g @vscode/vsce
    ```

## Features

*   **Theme Parsing**: Automatically parses your project's MUI-compatible theme file (TypeScript or JavaScript).
*   **Autocompletion**: Get suggestions for theme paths when typing `theme.` (e.g., `theme.palette.primary.main`).
    *   Works with common access patterns: `theme.X`, `props.theme.X`, `({ theme }) => theme.X`.
*   **Hover Information**: Hover over a theme path in your styled components to see its resolved value.
*   **Inlay Hints**: See the resolved value of theme properties displayed inline in your editor.
*   **Watch Mode**:
    *   Automatically re-parses your theme and updates IntelliSense when your theme file changes.
    *   Automatically reloads IntelliSense if the generated `theme-values.json` is modified.
*   **Configurable**: Set the path to your theme file in VS Code settings.

## Requirements

*   Your project should use `styled-components`.
*   Your theme should be defined in a JavaScript or TypeScript file, typically exporting an object created with Material UI's `createTheme()` or a similar structure.
*   `npm` must be available in your system path for the theme generation script to run.
*   The theme generation script uses `esbuild` to bundle your theme file. If your theme file has unusual imports or requires specific loaders not configured by default in the script, parsing might fail.

## How to Use

1.  **Install the Extension**:

    *   **From a `.vsix` file (if you built it from source or received one):**
        1.  Open VS Code.
        2.  Go to the Extensions view (click the square icon on the sidebar, or `Ctrl+Shift+X` / `Cmd+Shift+X`).
        3.  Click the three dots (`...`) at the top-right of the Extensions view.
        4.  Select "**Install from VSIX...**"
        5.  Browse to and select the `.vsix` file (e.g., `styled-theme-intellisense-0.0.1.vsix`).
        6.  VS Code will install the extension. You might need to reload VS Code if prompted.
    *   **(Once Published to VS Code Marketplace):**
        1.  Open VS Code.
        2.  Go to the Extensions view.
        3.  Search for "Styled Theme IntelliSense".
        4.  Click "Install".

2.  **Configure Your Theme File Path**:
    *   Open VS Code Settings (File > Preferences > Settings or Code > Preferences > Settings).
    *   Search for "Styled Theme IntelliSense".
    *   Set the **`styled-theme-intellisense.themeFilePath`** setting to the path of your theme file, relative to your workspace root (e.g., `./src/styles/theme.ts` or `src/myTheme.js`).
    *   The default is `./src/theme.ts`.
3.  **Generate Theme Data**:
    *   Open the Command Palette (View > Command Palette... or Ctrl+Shift+P / Cmd+Shift+P).
    *   Run the command: **`Styled Theme: Generate Theme IntelliSense Data`**.
    *   This will parse your theme file and create a `theme-values.json` file within the extension's internal directory. A terminal window will show the progress.
    *   If you are using the default theme path (`./src/theme.ts`) and the file doesn't exist, the script will create a sample dummy theme file for you (requires `@mui/material` to be installed in your project for the dummy theme to be fully functional).
4.  **Start Coding!**
    *   You should now see autocompletions when typing `theme.` inside styled template literals:
        ```javascript
        import styled from 'styled-components';

        const MyStyledDiv = styled.div`
          background-color: ${({ theme }) => theme.palette.primary.main};
                                                   ^--- Autocomplete here
          font-size: ${props => props.theme.typography.fontSize};
                        ^--- Hover here for value
                        ^--- Inlay hint = 14 (example)
        `;
        ```

## Watch Mode

The extension automatically watches for changes:
*   **Your Theme File**: If you edit and save your configured theme file, the extension will detect the change and automatically re-run the theme generation process.
*   **Generated Data**: If the internal `theme-values.json` (inside the extension's folder) changes for any reason, IntelliSense data will be reloaded.

You can always manually trigger a regeneration by running the `Styled Theme: Generate Theme IntelliSense Data` command.

## Troubleshooting

*   **No IntelliSense / Command Fails**:
    *   Check the VS Code Output panel (select "Styled Theme IntelliSense" or "Log (Extension Host)" in the dropdown) for error messages.
    *   Ensure the `styled-theme-intellisense.themeFilePath` setting points to the correct theme file.
    *   Make sure your theme file is parsable by `esbuild` and exports the theme object as default or a named export `theme`.
    *   Ensure `npm` is available and can run scripts in your project's context.
    *   The theme generation script runs `npm run generate-theme` internally (this is a script defined *within this extension's package.json*, not your project's).
*   **Inlay Hints Not Appearing**:
    *   Ensure inlay hints are generally enabled in your VS Code settings (`"editor.inlayHints.enabled"`).
    *   The provider might not show hints for complex object values, focusing on strings, numbers, and booleans.

## Building from Source (Creating the `.vsix` file)

If you want to build the extension from its source code and create a `.vsix` file for installation:

1.  **Clone the Repository**:
    ```bash
    git clone <repository-url> # Replace with the actual repository URL
    cd styled-theme-intellisense
    ```
2.  **Install Dependencies**:
    This will download all necessary Node.js modules, including development tools.
    ```bash
    npm install
    ```
3.  **Compile TypeScript**:
    The extension is written in TypeScript and needs to be compiled to JavaScript. The `vscode:prepublish` script in `package.json` (which runs `npm run compile`) handles this. `vsce package` will run this automatically. If you want to compile manually:
    ```bash
    npm run compile
    ```
    This will create an `out` directory with the compiled JavaScript files.
4.  **Package the Extension**:
    Use the `vsce` tool to package the extension into a `.vsix` file.
    ```bash
    vsce package
    ```
    This command will generate a file like `styled-theme-intellisense-0.0.1.vsix` in the project's root directory. This is the file you can install into VS Code.

## Developing and Debugging the Extension

If you want to contribute to the development of this extension or debug it:

1.  **Clone the Repository**:
    ```bash
    git clone <repository-url> # Replace with the actual repository URL
    cd styled-theme-intellisense
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Open in VS Code**:
    Open the cloned `styled-theme-intellisense` folder directly in Visual Studio Code.
4.  **Start Debugging (Run Extension)**:
    *   Go to the "Run and Debug" view (the play icon with a bug on the sidebar, or `Ctrl+Shift+D` / `Cmd+Shift+D`).
    *   At the top, you should see a launch configuration named "Run Extension" (defined in `.vscode/launch.json`).
    *   Click the green play button next to "Run Extension" or simply press `F5`.
5.  **Extension Development Host (EDH)**:
    *   This will compile the TypeScript (if not already compiled via `npm run watch` or a manual `npm run compile`) and then open a new VS Code window. This new window is the "Extension Development Host" (EDH), and it has your extension installed and running in it.
6.  **Test in the EDH**:
    *   In the EDH window, open a sample project that uses `styled-components` and has a theme file.
    *   Configure the extension's settings (`styled-theme-intellisense.themeFilePath`) in the EDH if necessary.
    *   Run the `Styled Theme: Generate Theme IntelliSense Data` command.
    *   Test the IntelliSense features (autocompletion, hover, inlay hints) in your sample project's files.
7.  **Set Breakpoints**:
    *   You can set breakpoints in your TypeScript code (e.g., in `extension.ts`, `src/providers/completions.ts`, `scripts/gen-theme-json.ts`) in your *original* VS Code window (the one where you pressed `F5`).
    *   When you perform actions in the EDH that trigger that code (e.g., typing `theme.`, hovering, running the generate command), the debugger in your original window will pause, allowing you to inspect variables, step through code, etc.
8.  **View Logs**:
    *   **Main Extension Logs**: In your *original* VS Code window (debugger window), the "Debug Console" will show `console.log()` statements from your extension's main process (`extension.ts`).
    *   **Extension Host Logs**: In the *EDH* window, open the "Output" panel (`Ctrl+Shift+U` / `Cmd+Shift+U`). Select "Log (Extension Host)" from the dropdown menu to see `console.log()` statements from the extension's runtime environment and any runtime errors.
    *   **Theme Generation Script Logs**: The terminal window that pops up in the EDH when you run the `Styled Theme: Generate Theme IntelliSense Data` command will show specific logs and errors from the `scripts/gen-theme-json.ts` script.
    *   **Extension Output Channel**: This extension doesn't currently have its own dedicated output channel, but it's a good practice for more verbose logging. If it were added, you'd select "Styled Theme IntelliSense" (or similar) from the Output panel's dropdown in the EDH.

**Key Files for Development**:
*   `extension.ts`: The main entry point for the extension.
*   `scripts/gen-theme-json.ts`: The script responsible for parsing the user's theme file.
*   `src/providers/`: Contains the logic for autocompletion, hover information, and inlay hints.
*   `package.json`: Defines extension metadata, contributions, scripts, and dependencies.

---
