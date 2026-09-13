// Module hooks for the tests. The app is written for Next's bundler: imports
// have no file extension, `@/` means the project root, and a JSON file is
// imported like a module. Node understands none of that, so this resolves
// those imports and compiles the project's own .ts/.tsx files with the
// TypeScript compiler the project already depends on. Packages load as usual.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = new URL('../../', import.meta.url);
const rootPath = fileURLToPath(root);
const extensions = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

const isFile = (path) => existsSync(path) && statSync(path).isFile();
const ownFile = (url) =>
  url.startsWith('file:') &&
  fileURLToPath(url).startsWith(rootPath) &&
  !fileURLToPath(url).includes('node_modules');

export async function resolve(specifier, context, nextResolve) {
  let base = null;
  if (specifier.startsWith('@/')) base = new URL(specifier.slice(2), root);
  else if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL &&
    ownFile(context.parentURL)
  )
    base = new URL(specifier, context.parentURL);
  if (base) {
    for (const extension of extensions) {
      const candidate = fileURLToPath(base) + extension;
      if (isFile(candidate))
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (ownFile(url) && /\.(ts|tsx)$/.test(url)) {
    const source = readFileSync(fileURLToPath(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  // `import en from './en.json'` without an import attribute, as the bundler
  // allows: served as a module whose default export is the parsed file.
  if (ownFile(url) && url.endsWith('.json') && !context.importAttributes?.type)
    return {
      format: 'module',
      source: 'export default ' + readFileSync(fileURLToPath(url), 'utf8'),
      shortCircuit: true,
    };
  return nextLoad(url, context);
}
