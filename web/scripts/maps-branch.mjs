#!/usr/bin/env node
/**
 * Maps (public/maps, ~100 MB) live not in the main git history but in a separate
 * maps branch of a single commit: an update rewrites it as a whole,
 * so the repository does not grow with every map re-import.
 *
 *   npm run maps:pull     - download the maps from the maps branch into public/maps (after cloning)
 *   npm run maps:publish  - replace the maps branch with the contents of public/maps
 *
 * The site build in CI takes the maps from this branch (see .github/workflows).
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const MAPS = join(WEB, 'public', 'maps')
const BRANCH = 'maps'

const git = (args, cwd = WEB) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

const command = process.argv[2]

if (command === 'publish') {
  if (!existsSync(join(MAPS, 'index.json'))) {
    console.error('No public/maps/index.json: nothing to publish.')
    process.exit(1)
  }
  const remote = git(['remote', 'get-url', 'origin'])
  const name = git(['config', 'user.name'])
  const email = git(['config', 'user.email'])
  const dir = mkdtempSync(join(tmpdir(), 'maps-branch-'))
  cpSync(MAPS, dir, { recursive: true })
  git(['init', '-q', '-b', BRANCH], dir)
  git(['add', '-A'], dir)
  git(['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', `maps: ${readdirSync(MAPS).filter((f) => !f.includes('.')).length} maps`], dir)
  console.log(`publishing the ${BRANCH} branch to ${remote}…`)
  execFileSync('git', ['push', '--force', remote, `${BRANCH}:${BRANCH}`], { cwd: dir, stdio: 'inherit' })
  rmSync(dir, { recursive: true, force: true })
  console.log('done')
} else if (command === 'pull') {
  // archive from the web/ subfolder would take only web/…: run from the repository root
  const root = git(['rev-parse', '--show-toplevel'])
  git(['fetch', '--depth=1', 'origin', BRANCH], root)
  const work = mkdtempSync(join(tmpdir(), 'maps-pull-'))
  const tar = join(work, 'maps.tar')
  const out = join(work, 'maps')
  git(['archive', '--format=tar', '-o', tar, 'FETCH_HEAD'], root)
  mkdirSync(out)
  // Relative paths: GNU tar takes "C:\…" for a remote machine address
  execFileSync('tar', ['-xf', 'maps.tar', '-C', 'maps'], { cwd: work, stdio: 'inherit' })
  // The old maps are replaced only when the new ones were really unpacked
  if (!existsSync(join(out, 'index.json'))) {
    console.error('The maps branch has no index.json: public/maps is untouched.')
    process.exit(1)
  }
  rmSync(MAPS, { recursive: true, force: true })
  cpSync(out, MAPS, { recursive: true })
  rmSync(work, { recursive: true, force: true })
  console.log(`maps from the ${BRANCH} branch → ${MAPS}`)
} else {
  console.error('commands: pull | publish')
  process.exit(1)
}
