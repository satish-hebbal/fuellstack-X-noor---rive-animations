#!/usr/bin/env node
/**
 * Pre-flight for the Google Drive setup.
 *
 *   npm run drive:check
 *
 * Answers, in order: is the folder ID set, is the key set, is the Drive API
 * enabled, is the folder actually shared publicly, what .riv files are in it,
 * can their bytes be downloaded, and is each one a format this runtime reads.
 *
 * Every failure prints the specific thing to go and change.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const dim = (s) => `\x1b[2m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`

function loadEnv() {
  const env = { ...process.env }
  for (const name of ['.env.local', '.env']) {
    const file = join(root, name)
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!match) continue
      const value = match[2].replace(/^["']|["']$/g, '').trim()
      if (value && env[match[1]] === undefined) env[match[1]] = value
    }
  }
  return env
}

function fail(message, ...hints) {
  console.error(`\n${red('✗')} ${message}`)
  for (const hint of hints) console.error(`  ${dim('→')} ${hint}`)
  console.error('')
  process.exit(1)
}

/** Rive files start with "RIVE" then varint major, varint minor. */
function riveVersion(buffer) {
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIVE') return null
  let offset = 4
  const readVarUint = () => {
    let result = 0
    let shift = 0
    for (;;) {
      const byte = buffer[offset++]
      result |= (byte & 0x7f) << shift
      if ((byte & 0x80) === 0) break
      shift += 7
    }
    return result >>> 0
  }
  const major = readVarUint()
  const minor = readVarUint()
  return { major, minor }
}

const env = loadEnv()
const folderId = env.VITE_DRIVE_FOLDER_ID?.trim()
const apiKey = env.VITE_DRIVE_API_KEY?.trim()

// A key restricted to HTTP referrers (which yours should be) rejects callers
// that send none — and Node sends none. Pretending to be the dev server keeps
// the restriction intact while still letting this script work.
const referer = (env.DRIVE_CHECK_REFERER ?? 'http://localhost:5173/').trim()

console.log(`\n${bold('Drive setup check')}`)
console.log(dim(`  folder    ${folderId || '(not set)'}`))
console.log(dim(`  api key   ${apiKey ? apiKey.slice(0, 8) + '…' : '(not set)'}`))
console.log(dim(`  referer   ${referer}`))

if (!folderId) {
  fail(
    'VITE_DRIVE_FOLDER_ID is not set.',
    'Copy .env.example to .env and paste the part of your Drive folder URL after /folders/',
  )
}
if (!apiKey) {
  fail(
    'VITE_DRIVE_API_KEY is not set.',
    'Google Cloud console → APIs & Services → Credentials → Create credentials → API key',
    'Enable the Google Drive API for that project first (APIs & Services → Library).',
  )
}

const headers = { Referer: referer }

const params = new URLSearchParams({
  q: `'${folderId}' in parents and trashed = false`,
  fields: 'nextPageToken,files(id,name,modifiedTime,size)',
  orderBy: 'name_natural',
  pageSize: '200',
  key: apiKey,
})

const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
  headers,
})

if (!response.ok) {
  const body = await response.json().catch(() => ({}))
  const message = body?.error?.message ?? `HTTP ${response.status}`

  if (/API key not valid/i.test(message)) {
    fail('The API key is not valid.', `Google said: ${message}`)
  }
  if (/referer|referrer/i.test(message)) {
    fail(
      'The API key rejected this caller’s referrer.',
      `Google said: ${message}`,
      `Add ${referer}* to the key’s Application restrictions → Websites,`,
      'or run with DRIVE_CHECK_REFERER=<one of your allowed URLs>.',
    )
  }
  if (/has not been used|is disabled|not enabled/i.test(message)) {
    fail(
      'The Google Drive API is not enabled on this key’s project.',
      'APIs & Services → Library → Google Drive API → Enable, then wait ~1 minute.',
    )
  }
  if (response.status === 404) {
    fail(
      'Drive can’t see that folder.',
      'Either the folder ID is wrong, or the folder is still private.',
      'In Drive: right-click the folder → Share → General access → Anyone with the link → Viewer.',
    )
  }
  fail(`Drive refused the request (HTTP ${response.status}).`, `Google said: ${message}`)
}

const { files = [] } = await response.json()
const rivs = files.filter((f) => /\.riv$/i.test(f.name))
const others = files.filter((f) => !/\.riv$/i.test(f.name))

console.log(`\n${green('✓')} Folder is publicly readable and the key works.`)

if (rivs.length === 0) {
  console.log(`\n${yellow('!')} No .riv files in the folder yet — upload some and re-run.`)
  if (others.length > 0) {
    console.log(dim(`  (${others.length} non-.riv file(s) present; the gallery ignores them.)`))
  }
  console.log('')
  process.exit(0)
}

console.log(`\n${bold(`${rivs.length} animation${rivs.length === 1 ? '' : 's'}`)}\n`)

let problems = 0

for (const file of rivs) {
  const media = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`
  const download = await fetch(media, { headers })

  if (!download.ok) {
    console.log(`  ${red('✗')} ${file.name.padEnd(30)} download failed (HTTP ${download.status})`)
    problems += 1
    continue
  }

  const buffer = Buffer.from(await download.arrayBuffer())
  const version = riveVersion(buffer)
  const size = `${Math.round(buffer.length / 1024)} KB`.padStart(7)

  if (!version) {
    console.log(`  ${red('✗')} ${file.name.padEnd(30)} ${size}   not a Rive file`)
    problems += 1
  } else if (version.major < 7) {
    console.log(
      `  ${yellow('!')} ${file.name.padEnd(30)} ${size}   format ${version.major}.${version.minor} — too old, re-export from Rive`,
    )
    problems += 1
  } else {
    console.log(
      `  ${green('✓')} ${file.name.padEnd(30)} ${size}   format ${version.major}.${version.minor}`,
    )
  }
}

console.log('')
if (problems === 0) {
  console.log(`${green('All good.')} Run ${bold('npm run dev')} and they'll be in the gallery.\n`)
} else {
  console.log(`${yellow(`${problems} file(s) need attention`)} — the rest will still show.\n`)
  process.exit(1)
}
