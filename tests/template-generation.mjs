import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const validation = path.join(repository, '.validation');
mkdirSync(validation, { recursive: true });
const scratch = mkdtempSync(path.join(validation, 'generation-'));
const hive = path.join(scratch, 'hive');
const read = file => readFileSync(file, 'utf8');
const dotnet = (...args) => execFileSync('dotnet', args, {
  cwd: repository,
  encoding: 'utf8',
  timeout: 120_000,
  stdio: ['ignore', 'pipe', 'pipe']
});
const exists = (base, relative) => {
  const file = path.resolve(base, relative.replaceAll('\\', '/'));
  assert(existsSync(file), `Missing reference: ${file}`);
  return file;
};
const namespacePattern = /^[_\p{L}][_\p{L}\p{N}]*(\.[_\p{L}][_\p{L}\p{N}]*)*$/u;

try {
  console.log(dotnet('new', 'install', repository, '--debug:custom-hive', hive));
  for (const name of ['custom-aspire', 'Contoso.Inventory']) {
    const output = path.join(scratch, name);
    console.log(dotnet('new', 'custom-aspire', '--name', name, '--output', output,
      '--debug:custom-hive', hive));
    const config = JSON.parse(read(path.join(output, 'aspire.config.json')));
    const appHostProject = exists(output, config.appHost.path);
    assert.equal(config.appHost.path, `${name}.AppHost/${name}.AppHost.csproj`);
    const appHost = exists(path.dirname(appHostProject), 'AppHost.cs');
    const projectPaths = [...read(appHost).matchAll(/AddDotnetProject\("[^"]+",\s*"([^"]+)"/g)];
    assert.equal(projectPaths.length, 1);
    const serverProject = exists(path.dirname(appHost), projectPaths[0][1]);
    assert.equal(serverProject, path.join(output, `${name}.Server`, `${name}.Server.csproj`));
    for (const [, relative] of read(exists(output, `${name}.sln`))
      .matchAll(/^Project\("[^"]+"\) = "[^"]+", "([^"]+)"/gm)) {
      exists(output, relative);
    }
    for (const project of [appHostProject, serverProject]) {
      for (const [, relative] of read(project).matchAll(/ProjectReference Include="([^"]+)"/g)) {
        exists(path.dirname(project), relative);
      }
      const rootNamespace = dotnet('msbuild', project, '-nologo', '-getProperty:RootNamespace').trim();
      assert(namespacePattern.test(rootNamespace), `Invalid C# namespace: ${rootNamespace}`);
      console.log(dotnet('build', project, '--nologo', '-v', 'minimal'));
    }
    const npmName = `${name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}-frontend`;
    assert.equal(JSON.parse(read(path.join(output, 'frontend/package.json'))).name, npmName);
    const lock = JSON.parse(read(path.join(output, 'frontend/package-lock.json')));
    assert.equal(lock.name, npmName);
    assert.equal(lock.packages[''].name, npmName);
    const walk = directory => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (['obj', 'bin'].includes(entry.name)) continue;
        const file = path.join(directory, entry.name);
        assert(!/TemplateApp|TemplateProjectPath/.test(file), file);
        if (entry.isDirectory()) walk(file);
        else if (!/\.(png|svg)$/.test(file)) {
          const content = read(file);
          assert(!/TemplateApp|TemplateProjectPath|templateapp/.test(content), file);
          for (const [, namespace] of content.matchAll(/^\s*namespace\s+([\w.]+)\s*[;{]/gm)) {
            assert(namespacePattern.test(namespace), file);
          }
        }
      }
    };
    walk(output);
    for (const excluded of ['tests', 'README.md', '.template.config', '.git', '.validation']) {
      assert(!existsSync(path.join(output, excluded)), `Unexpected generated file: ${excluded}`);
    }
    console.log(`${name}: path references, namespaces, npm names, exclusions, and builds passed.`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
