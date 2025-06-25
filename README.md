# Styled Components Theme IntelliSense for VS Code

Provides enhanced IntelliSense for projects using `styled-components` with a theme, especially Material UI themes created via `createTheme()`. Get autocompletion, hover information, and inlay hints for your theme properties directly within your styled template literals.

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

1.  **Install the Extension**: (Not yet published - for local development, build and install the `.vsix`)
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

## Contributing (For Extension Developers)

*   Clone the repository.
*   Run `npm install`.
*   Open in VS Code. Press `F5` to launch the Extension Development Host.
*   The theme generation script is `scripts/gen-theme-json.ts`.
*   The main extension logic is in `extension.ts`.
*   Providers are in `src/providers/`.

---
