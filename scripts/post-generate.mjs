import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const generated = path.join(root, 'src', 'app', 'generated', 'auth-api');
const services = path.join(root, 'src', 'app', 'services');
const dtos = path.join(root, 'src', 'app', 'services', 'dtos');

fs.mkdirSync(dtos, { recursive: true });

let movedCount = 0;

// 1. Copy model/*.ts → services/dtos/
const modelDir = path.join(generated, 'model');
if (fs.existsSync(modelDir)) {
  for (const file of fs.readdirSync(modelDir)) {
    if (!file.endsWith('.ts')) continue;
    fs.copyFileSync(path.join(modelDir, file), path.join(dtos, file));
    console.log(`  model/${file} → services/dtos/${file}`);
    movedCount++;
  }
}

// 2. Copy api/*.service.ts + api/*.serviceInterface.ts → services/
const apiDir = path.join(generated, 'api');
if (fs.existsSync(apiDir)) {
  for (const file of fs.readdirSync(apiDir)) {
    if (!file.endsWith('.service.ts') && !file.endsWith('.serviceInterface.ts')) continue;
    const srcPath = path.join(apiDir, file);
    const destPath = path.join(services, file);
    let content = fs.readFileSync(srcPath, 'utf-8');

    content = content
      .replace(/from\s+['"]\.\.\/model\/(.+?)['"]/g, "from './dtos/$1'")
      .replace(/from\s+['"]\.\.\/(.+?)['"]/g, "from '../generated/auth-api/$1'");

    fs.writeFileSync(destPath, content);
    console.log(`  api/${file} → services/${file}`);
    movedCount++;
  }
}

// 3. Strip api/model re-exports from index.ts
const indexPath = path.join(generated, 'index.ts');
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, 'utf-8');
  const original = indexContent;
  indexContent = indexContent
    .replace(/^export\s+\*\s+from\s+['"]\.\/api\/api['"];?\s*$/gm, '')
    .replace(/^export\s+\*\s+from\s+['"]\.\/model\/models['"];?\s*$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  if (indexContent !== original) {
    fs.writeFileSync(indexPath, indexContent + '\n');
    console.log('  index.ts → removed api/model re-exports');
  }
}

// 4. Delete api/ and model/ from generated (gitignored, no reason to keep)
const cleanup = [
  path.join(generated, 'api'),
  path.join(generated, 'model'),
];
for (const dir of cleanup) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  removed ${path.relative(root, dir)}/`);
  }
}

if (movedCount === 0) {
  console.log('  No generated files found — did you run generate:client first?');
} else {
  console.log(`\nDone. Moved ${movedCount} file(s).`);
}
