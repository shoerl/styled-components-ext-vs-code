import * as fs from 'fs';
import * as path from 'path';
import { buildSync } from 'esbuild';
import { pathToFileURL } from 'url'; // To handle ESM imports

// --- MUI Theme Structure (Illustrative) ---
// This is just for type reference if needed, the actual structure comes from user's theme.
interface Theme {
  palette: any;
  typography: any;
  spacing: (factor: number) => string | number;
  // ... other MUI theme properties and custom ones
  [key: string]: any; // Allow custom properties
}

// --- Flattening Logic ---
type FlattenedTheme = { [key: string]: string | number | boolean };

// Placeholder for the mock theme generation
function createMockTheme(): Theme {
  console.warn("Using a placeholder mock theme in gen-theme-json.ts. Replace with actual theme loading or a more robust mock.");
  return {
    palette: {
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
        contrastText: '#fff',
      },
      secondary: {
        main: '#9c27b0',
        light: '#ba68c8',
        dark: '#7b1fa2',
        contrastText: '#fff',
      },
      error: {
        main: '#d32f2f',
      },
      common: {
        black: '#000',
        white: '#fff',
      }
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: 14,
      h1: {
        fontSize: '2.5rem',
      }
    },
    spacing: (factor: number) => `${factor * 8}px`,
    shape: {
      borderRadius: 4,
    },
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 900,
            lg: 1200,
            xl: 1536,
        }
    },
    zIndex: {
        appBar: 1100,
        drawer: 1200,
    },
    customProperty: "customValue",
    customObject: {
        nestedKey: "nestedValue",
        deeplyNested: {
            value: 123
        }
    }
  };
}

const flattenObject = (obj: any, parentKey: string = '', result: FlattenedTheme = {}): FlattenedTheme => {
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key]) && Object.keys(obj[key]).length > 0) {
        // Further check if it's a plain object, not a function like spacing
        if (typeof obj[key] !== 'function') {
            flattenObject(obj[key], newKey, result);
        } else if (key === 'spacing') {
            // Special handling for MUI's spacing function if needed, or skip
            // For now, let's represent it as a string indicating it's a function
            result[newKey] = `function(${obj[key].length > 0 ? 'factor' : ''}) => string | number`;
        }
      } else if (typeof obj[key] !== 'function') { // Exclude functions unless explicitly handled
        result[newKey] = obj[key];
      } else if (key === 'spacing') { // Capture spacing function representation even if at top level (though unlikely for MUI)
        result[newKey] = `function(${obj[key].length > 0 ? 'factor' : ''}) => string | number`;
      }
    }
  }
  return result;
};


// --- Main Execution ---
const generateThemeJson = async () => {
  try {
    console.log('Starting theme generation...');

    // TODO: Later, get this path from VS Code configuration
    // const userThemePath = path.resolve(process.cwd(), 'path/to/user/theme.ts');

    // For now, use the mock theme
    const muiThemeObject = createMockTheme();
    console.log('Successfully created/imported mock theme object.');

    const flattenedTheme = flattenObject(muiThemeObject);
    console.log('Theme object flattened.');

    // Output path for the JSON file
    // Ensure the 'theme' directory exists at the root of the extension project
    const outputPath = path.resolve(__dirname, '../../theme/theme-values.json');
    const outputDir = path.dirname(outputPath);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }

    fs.writeFileSync(outputPath, JSON.stringify(flattenedTheme, null, 2));
    console.log(`Flattened theme saved to: ${outputPath}`);
    console.log(`Total theme keys generated: ${Object.keys(flattenedTheme).length}`);

  } catch (error) {
    console.error('Error generating theme JSON:', error);
    // In VS Code extension, we might want to show an error message to the user
    // vscode.window.showErrorMessage(`Failed to generate theme JSON: ${error.message}`);
    process.exit(1); // Exit with error for command line usage
  }
};

// Execute the generation
generateThemeJson();

// Export for potential programmatic use if ever needed, though primarily a script
export { flattenObject, generateThemeJson };
