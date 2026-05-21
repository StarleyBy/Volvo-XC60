/**
 * CS Helper — Manifest Auto-Builder
 * 
 * This script scans the project folders and generates app-manifest.yml automatically.
 * It prevents manual YAML formatting errors and keeps the structure in sync with your files.
 * 
 * Usage: node build-manifest.js
 */

const fs = require('fs');
const path = require('path');

// ── CONFIGURATION ──────────────────────────────────────────

const SECTIONS = [
  { id: 'calculators', title: 'Calculators and Schemes', icon: '🧮', dir: 'books/calculators', defaultType: 'calculator' },
  { id: 'references',  title: 'References',             icon: '📋', dir: 'books/references',  defaultType: 'reference' },
  { id: 'scales',      title: 'Scales & Scores',        icon: '📊', dir: 'books/scales',      defaultType: 'scale' },
  { id: 'protocols',   title: 'Protocols',              icon: '📄', dir: 'books/protocols',   defaultType: 'protocol' },
  { id: 'cheatsheets', title: 'Cheat Sheets',           icon: '🗒️', dir: 'books/cheatsheets', defaultType: 'cheatsheet' },
  { id: 'icd',         title: 'ICD Codes',              icon: '🏷️', dir: 'books/icd',         defaultType: 'icd' }
];

const OUTPUT_FILE = 'app-manifest.yml';

// ── HELPER FUNCTIONS ───────────────────────────────────────

function parseMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath);
  let metadata = {};

  if (ext === '.md') {
    // Parse Markdown Frontmatter
    const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*/);
    if (match) {
      metadata = parseSimpleYaml(match[1]);
    }
  } else if (ext === '.html') {
    // Parse HTML Metadata Comment
    const match = content.match(/<!--\s*metadata:\s*\r?\n([\s\S]*?)\r?\n\s*-->/);
    if (match) {
      metadata = parseSimpleYaml(match[1]);
    } else {
      // Fallback: try to get <title>
      const titleMatch = content.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) metadata.title = titleMatch[1];
    }
  }

  // Set defaults if missing
  if (!metadata.title) {
    metadata.title = path.basename(filePath, ext)
      .replace(/-/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }
  if (!metadata.id) {
    metadata.id = path.basename(filePath, ext);
  }
  if (metadata.visible === undefined) metadata.visible = true;
  if (!metadata.tags) metadata.tags = [];
  if (typeof metadata.tags === 'string') metadata.tags = metadata.tags.split(',').map(t => t.trim());

  return metadata;
}

/**
 * Very basic YAML parser for metadata (avoids dependencies)
 */
function parseSimpleYaml(yaml) {
  const result = {};
  const lines = yaml.split('\n');
  lines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) return;
    
    const key = line.substring(0, colonIndex).trim();
    let val = line.substring(colonIndex + 1).trim();

    // Handle booleans
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    // Handle arrays [a, b, c]
    else if (val.startsWith('[') && val.endsWith(']')) {
      val = val.substring(1, val.length - 1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, ''));
    }
    // Remove quotes
    else if (val.startsWith('"') || val.startsWith("'")) {
      val = val.substring(1, val.length - 1);
    }

    result[key] = val;
  });
  return result;
}

function generateYaml() {
  let yaml = `meta:
  app: CS Helper
  version: 1.0.0
  updated: ${new Date().toISOString().replace('T', ' ').substring(0, 16)}

sections:`;

  for (const section of SECTIONS) {
    yaml += `\n  - id: ${section.id}\n    title: ${section.title}\n    icon: ${section.icon}\n    items:`;
    
    if (!fs.existsSync(section.dir)) {
      console.warn(`Warning: Directory ${section.dir} not found.`);
      continue;
    }

    const files = fs.readdirSync(section.dir)
      .filter(f => f.endsWith('.md') || f.endsWith('.html') || f.endsWith('.json'))
      .sort();

    if (files.length === 0) {
      yaml += ' []';
      continue;
    }

    for (const file of files) {
      const filePath = path.join(section.dir, file);
      const meta = parseMetadata(filePath);
      const relativePath = filePath.replace(/\\/g, '/');

      yaml += `
      - id: ${meta.id}
        title: "${meta.title}"
        file: ${relativePath}
        type: ${meta.type || section.defaultType}
        visible: ${meta.visible}
        tags: [${meta.tags.join(', ')}]`;
    }
    yaml += '\n';
  }

  return yaml;
}

// ── MAIN ───────────────────────────────────────────────────

console.log('🚀 Building manifest...');

try {
  const yamlOutput = generateYaml();
  fs.writeFileSync(OUTPUT_FILE, yamlOutput, 'utf8');
  console.log(`✅ Success! ${OUTPUT_FILE} updated.`);
} catch (err) {
  console.error('❌ Error building manifest:', err);
  process.exit(1);
}
