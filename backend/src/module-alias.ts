import Module from 'module';
import path from 'path';

const rootDir = __dirname;
const aliases: Record<string, string> = {
  '@': rootDir,
  '@config': path.join(rootDir, 'config'),
  '@controllers': path.join(rootDir, 'controllers'),
  '@database': path.join(rootDir, 'database'),
  '@middleware': path.join(rootDir, 'middleware'),
  '@models': path.join(rootDir, 'models'),
  '@routes': path.join(rootDir, 'routes'),
  '@search': path.join(rootDir, 'search'),
  '@services': path.join(rootDir, 'services'),
  '@types': path.join(rootDir, 'types'),
  '@utils': path.join(rootDir, 'utils'),
};

const originalResolveFilename = (Module as any)._resolveFilename;

(Module as any)._resolveFilename = function resolveAlias(
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: unknown
) {
  const alias = Object.keys(aliases)
    .sort((a, b) => b.length - a.length)
    .find((key) => request === key || request.startsWith(`${key}/`));

  if (alias) {
    const resolvedRequest = path.join(aliases[alias], request.slice(alias.length));
    return originalResolveFilename.call(this, resolvedRequest, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};
