import fs from 'fs/promises';
import path from 'path';

const DOCS_DIR = '/home/bow/projects/Revenue-recovery-engine/docs';

const ALLOWED_FILES = new Set([
  'FUNCTIONAL_REQUIREMENTS.md',
  'IMPLEMENTATION_STRATEGY.md',
  'LOCAL_WEBHOOK_INGRESS.md',
  'NON_FUNCTIONAL_REQUIREMENTS.md',
  'RAZORPAY_CAPABILITY_MATRIX.md',
]);

/**
 * Indexes allowed top-level markdown documentation files and extracts headers (levels 1, 2, and 3).
 * @returns {Promise<Object>} Mapping of filename to array of Markdown header strings.
 */
export async function getDocsIndex() {
  const index = {};

  try {
    const dirEntries = await fs.readdir(DOCS_DIR, { withFileTypes: true });

    const validFiles = dirEntries
      .filter((entry) => entry.isFile() && ALLOWED_FILES.has(entry.name))
      .map((entry) => entry.name)
      .sort();

    for (const filename of validFiles) {
      const filePath = path.join(DOCS_DIR, filename);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split(/\r?\n/);
        const headers = [];
        const headerRegex = /^(#{1,3})\s+(.+)$/;

        for (const line of lines) {
          const match = line.trim().match(headerRegex);
          if (match) {
            headers.push(`${match[1]} ${match[2].trim()}`);
          }
        }
        index[filename] = headers;
      } catch (err) {
        index[filename] = [];
      }
    }
  } catch (err) {
    return { error: `Failed to read documentation directory: ${err.message}` };
  }

  return index;
}

/**
 * Dynamically fetches text content belonging to a specific section heading within an allowed documentation file.
 * @param {string} filename - Target filename (must be one of the allowed top-level .md files).
 * @param {string} sectionHeading - Heading text or substring to locate (case-insensitive).
 * @returns {Promise<string>} Extracted section content or an error message string.
 */
export async function readDocSection(filename, sectionHeading) {
  if (!filename || typeof filename !== 'string') {
    return 'Error: Filename parameter must be a valid non-empty string.';
  }

  if (!sectionHeading || typeof sectionHeading !== 'string') {
    return 'Error: Section heading parameter must be a valid non-empty string.';
  }

  const normalizedFilename = path.basename(filename);

  if (
    !ALLOWED_FILES.has(normalizedFilename) ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename !== normalizedFilename
  ) {
    return `Error: Invalid or unauthorized filename "${filename}". Allowed files: ${Array.from(ALLOWED_FILES).join(', ')}`;
  }

  const filePath = path.join(DOCS_DIR, normalizedFilename);

  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    return `Error: File "${filename}" not found or could not be read.`;
  }

  const lines = content.split(/\r?\n/);
  const headerRegex = /^(#{1,6})\s+(.+)$/;

  let targetHeadingIndex = -1;
  let targetLevel = 0;

  const searchHeadingLower = sectionHeading.toLowerCase().trim();

  for (let i = 0; i < lines.length; i++) {
    const lineTrimmed = lines[i].trim();
    const match = lineTrimmed.match(headerRegex);

    if (match) {
      const fullHeader = match[0].toLowerCase();
      const headerTitle = match[2].toLowerCase();

      if (headerTitle.includes(searchHeadingLower) || fullHeader.includes(searchHeadingLower)) {
        targetHeadingIndex = i;
        targetLevel = match[1].length;
        break;
      }
    }
  }

  if (targetHeadingIndex === -1) {
    return `Error: Section matching "${sectionHeading}" not found in file "${filename}".`;
  }

  const sectionLines = [];

  for (let i = targetHeadingIndex; i < lines.length; i++) {
    const lineTrimmed = lines[i].trim();
    const match = lineTrimmed.match(headerRegex);

    if (i > targetHeadingIndex && match) {
      const currentLevel = match[1].length;
      if (currentLevel <= targetLevel) {
        break;
      }
    }

    sectionLines.push(lines[i]);
  }

  return sectionLines.join('\n').trim();
}
