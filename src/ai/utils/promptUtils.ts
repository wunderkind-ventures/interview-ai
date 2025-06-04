import * as fs from 'fs';
import * as _path from 'path'; // Renamed to avoid conflict with a potential 'path' variable
import * as Handlebars from 'handlebars';

// Resolve paths relative to the project root
const projectRoot = process.cwd();
const promptsDir = _path.join(projectRoot, 'backends/catalyst-go-backend/prompts');

/**
 * Loads a raw prompt template from a .prompt file.
 * @param promptFileName The name of the .prompt file (e.g., "generate-hint.prompt")
 * @returns The raw prompt template string.
 */
export function loadPromptFile(promptFileName: string): string {
  const filePath = _path.join(promptsDir, promptFileName);

  if (!fs.existsSync(filePath)) {
    const dir = _path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // After attempting to create the directory, check file existence again.
    if (!fs.existsSync(filePath)) {
       throw new Error(`Prompt file not found: ${filePath}. Please ensure it exists in the '${promptsDir}' directory or can be created.`);
    }
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Renders a prompt template string using Handlebars.
 * @param templateString The raw prompt template.
 * @param context An object containing key-value pairs for template replacement.
 * @returns The processed prompt string.
 */
export function renderPromptTemplate(templateString: string, context: Record<string, any>): string {
  try {
    const template = Handlebars.compile(templateString);
    return template(context);
  } catch (error) {
    console.error("Error rendering Handlebars template:", error);
    throw new Error(`Failed to render prompt template: ${(error as Error).message}`);
  }
} 