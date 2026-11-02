import { lstat, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultOutput = join(projectRoot, '.demo-build', 'out');
const noticeName = /^(?:licen[sc]e|copying|notice|copyright)(?:[._-].*)?$/i;
const plainNotice = (name) =>
  noticeName.test(name) && !/\.(?:[cm]?js|tsx?|json|png|jpe?g|webp|svg|woff2?|map)$/i.test(name);

async function manifestAt(directory) {
  return JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
}

// Locate packages as Node does, including pnpm's real package locations. Read
// manifests directly: resolving a package.json export can be forbidden even
// when the package itself is installed and used by the application.
async function installedDependency(name, from) {
  if (
    !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name) ||
    name.split('/').some((part) => ['.', '..'].includes(part))
  ) {
    throw new Error(`Invalid installed dependency name: ${name}`);
  }
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules', name);
    try {
      await stat(join(candidate, 'package.json'));
      return await realpath(candidate);
    } catch (error) {
      if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
    }
    if (dirname(directory) === directory) return null;
  }
}

async function licenseFiles(directory) {
  const files = [];
  async function visit(current) {
    for (const item of await readdir(current, { withFileTypes: true })) {
      if (item.isSymbolicLink()) continue;
      const full = join(current, item.name);
      if (item.isDirectory()) {
        if (!['node_modules', '.git', '.next'].includes(item.name)) await visit(full);
      } else if (item.isFile() && plainNotice(item.name)) {
        const bytes = await readFile(full);
        if (bytes.includes(0)) continue;
        let content;
        try {
          content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
          content = bytes.toString('latin1');
        }
        files.push({ path: relative(directory, full).split(sep).join('/'), content });
      }
    }
  }
  await visit(directory);
  if (!files.length) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (!item.isFile() || !/^readme(?:\.(?:md|markdown|txt|rst))?$/i.test(item.name)) continue;
      const content = await readFile(join(directory, item.name), 'utf8');
      const heading = /^(#{1,6})\s+licen[sc]e\b[^\r\n]*$/im.exec(content);
      if (heading) {
        const remainder = content.slice(heading.index + heading[0].length);
        const nextSection = new RegExp(`^#{1,${heading[1].length}}\\s+`, 'm').exec(remainder);
        files.push({
          path: `${item.name} / license section`,
          content: heading[0] + remainder.slice(0, nextSection?.index),
        });
      }
    }
  }
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function dependencyEntries(manifest) {
  const required = { ...manifest.dependencies };
  const optional = { ...manifest.optionalDependencies, ...manifest.peerDependencies };
  return [
    ...Object.keys(required).map((name) => ({
      name,
      required: !Object.hasOwn(manifest.optionalDependencies || {}, name),
    })),
    ...Object.keys(optional)
      .filter((name) => !Object.hasOwn(required, name))
      .map((name) => ({ name, required: false })),
  ];
}

export async function writeDemoLicenses(output = defaultOutput, { checkOnly = false } = {}) {
  const destination = resolve(output);
  const part = relative(join(projectRoot, '.demo-build'), destination);
  if (isAbsolute(part) || part !== 'out')
    throw new Error('License output must be the demo artifact directory.');
  const manifest = await manifestAt(projectRoot);
  const queue = Object.keys(manifest.dependencies || {}).map((name) => ({
    name,
    from: projectRoot,
    required: true,
  }));
  const packages = new Map();
  const missingLicenseText = [];
  const upstreamReferences = [];
  while (queue.length) {
    const next = queue.shift();
    const directory = await installedDependency(next.name, next.from);
    if (!directory) {
      if (next.required) throw new Error(`Missing installed production dependency: ${next.name}`);
      continue;
    }
    if (packages.has(directory)) continue;
    const installed = await manifestAt(directory);
    const notices = await licenseFiles(directory);
    const name = `${installed.name || next.name}@${installed.version || 'unknown'}`;
    const declaredLicense =
      typeof installed.license === 'string'
        ? installed.license
        : installed.license?.type || 'not declared';
    if (!notices.length) {
      const upstreamName = installed.name?.startsWith('@next/')
        ? 'next'
        : installed.name === 'client-only'
          ? 'react'
          : null;
      const upstream = upstreamName && (await installedDependency(upstreamName, projectRoot));
      if (upstream) {
        const upstreamManifest = await manifestAt(upstream);
        const upstreamNotices = await licenseFiles(upstream);
        const rootNotices = upstreamNotices.filter((notice) => !notice.path.includes('/'));
        for (const notice of rootNotices)
          notices.push({
            path: `Installed upstream project ${upstreamManifest.name}@${upstreamManifest.version} / ${notice.path}`,
            content: notice.content,
          });
        if (rootNotices.length)
          upstreamReferences.push({ package: name, project: upstreamManifest.name });
      }
      if (!notices.length) missingLicenseText.push(name);
    }
    packages.set(directory, { name, declaredLicense, notices });
    for (const dependency of dependencyEntries(installed))
      queue.push({ ...dependency, from: directory });
  }
  const sorted = [...packages.values()].sort((left, right) => left.name.localeCompare(right.name));
  const totalNotices = sorted.reduce((count, item) => count + item.notices.length, 0);
  if (!checkOnly) {
    const target = await realpath(destination);
    const actual = relative(await realpath(join(projectRoot, '.demo-build')), target);
    if (actual !== 'out' || (await lstat(destination)).isSymbolicLink())
      throw new Error('Refusing license output through a directory symlink.');
    const intro = await readFile(join(projectRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8');
    const sections = [
      'StudioShelf interactive demonstration — third-party notices',
      '==========================================================',
      '',
      'Project provenance and notices',
      '------------------------------',
      intro,
      '',
      'Installed dependency license and copyright texts',
      '------------------------------------------------',
      'The texts below are reproduced from the installed production dependency graph, including installed optional/peer dependencies and bundled notices. Some packages or bundled tools are used to build the site rather than served to visitors. Source-checkout documentation paths in the project notice above refer to the private source package.',
      '',
    ];
    for (const item of sorted) {
      sections.push(
        '='.repeat(78),
        item.name,
        `Declared license: ${item.declaredLicense}`,
        '='.repeat(78),
        '',
      );
      if (!item.notices.length) {
        sections.push(
          'This installed package declares the license identifier above but does not include a standalone license, copyright or notice text file.',
          '',
        );
      }
      for (const notice of item.notices)
        sections.push(`--- ${item.name} / ${notice.path} ---`, '', notice.content, '');
    }
    await writeFile(join(destination, 'THIRD-PARTY-LICENSES.txt'), sections.join('\n'));
  }
  return {
    packages: sorted.length,
    licenseFiles: totalNotices,
    missingLicenseText,
    upstreamReferences,
    ...(checkOnly ? { checked: true } : { written: 'THIRD-PARTY-LICENSES.txt' }),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--check-only'))
    throw new Error('Use no arguments, or --check-only.');
  console.log(
    JSON.stringify(
      await writeDemoLicenses(defaultOutput, { checkOnly: args.includes('--check-only') }),
    ),
  );
}
