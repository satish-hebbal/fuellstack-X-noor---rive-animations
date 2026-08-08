import { byTitle, toTitle, type RiveAnimation } from '../animations'

/**
 * Runtime source: a Google Drive folder, read straight from the browser.
 *
 * Drop a .riv into the folder and it's in the gallery on the next load — no
 * rebuild, no redeploy. This works because `www.googleapis.com/drive/v3`
 * returns proper CORS headers and accepts a plain API key for files that are
 * shared publicly. (The `drive.google.com/uc?...` and `thumbnailLink` URLs you
 * find in older write-ups do *not* — don't substitute them.)
 *
 * Setup lives in the README. Both values are baked into the bundle at build
 * time, so the API key is public; restrict it by HTTP referrer and to the
 * Drive API alone.
 */
const ENDPOINT = 'https://www.googleapis.com/drive/v3/files'

const FOLDER_ID = import.meta.env.VITE_DRIVE_FOLDER_ID?.trim()
const API_KEY = import.meta.env.VITE_DRIVE_API_KEY?.trim()

export const isDriveConfigured = Boolean(FOLDER_ID && API_KEY)

/** Direct download URL for one file's bytes. */
export function driveFileUrl(id: string): string {
  return `${ENDPOINT}/${encodeURIComponent(id)}?alt=media&key=${encodeURIComponent(API_KEY ?? '')}`
}

type DriveFile = {
  id: string
  name: string
  modifiedTime: string
}

type DriveListing = {
  files?: DriveFile[]
  nextPageToken?: string
}

export async function listDriveAnimations(signal?: AbortSignal): Promise<RiveAnimation[]> {
  if (!FOLDER_ID || !API_KEY) {
    throw new Error('Google Drive is not configured.')
  }

  const found: RiveAnimation[] = []
  let pageToken: string | undefined

  // Folders with more files than one page returns are rare here, but paging
  // costs three lines and silently truncating a gallery would be worse.
  do {
    const params = new URLSearchParams({
      q: `'${FOLDER_ID}' in parents and trashed = false`,
      // modifiedTime is the version: it changes on every content edit, which
      // is what lets the byte and aspect-ratio caches self-invalidate.
      fields: 'nextPageToken,files(id,name,modifiedTime)',
      orderBy: 'name_natural',
      pageSize: '200',
      key: API_KEY,
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await fetch(`${ENDPOINT}?${params.toString()}`, { signal })
    if (!response.ok) throw await describeFailure(response)

    const listing = (await response.json()) as DriveListing

    for (const file of listing.files ?? []) {
      // Drive reports .riv as a generic binary type, so filter by extension.
      if (!/\.riv$/i.test(file.name)) continue
      found.push({
        id: file.id,
        fileName: file.name,
        title: toTitle(file.name),
        url: driveFileUrl(file.id),
        version: file.modifiedTime,
      })
    }

    pageToken = listing.nextPageToken
  } while (pageToken)

  return found.sort(byTitle)
}

/**
 * Turn Google's generic errors into something that says what to go and fix.
 * Every one of these is a setup mistake somebody makes once.
 */
async function describeFailure(response: Response): Promise<Error> {
  let detail = ''
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? ''
  } catch {
    // Non-JSON error body; fall through to the status-based messages.
  }

  if (/API key not valid/i.test(detail)) {
    return new Error('That Drive API key isn’t valid — check VITE_DRIVE_API_KEY.')
  }
  if (/referer|referrer/i.test(detail)) {
    return new Error(
      'The API key rejected this site’s address. Add it under the key’s "Website restrictions" in Google Cloud.',
    )
  }
  if (/has not been used|is disabled|not enabled/i.test(detail)) {
    return new Error(
      'The Google Drive API isn’t enabled on the key’s Google Cloud project. Enable it, then wait a minute.',
    )
  }
  if (response.status === 404) {
    return new Error(
      'Folder not found. Check VITE_DRIVE_FOLDER_ID, and confirm the folder is shared as "Anyone with the link".',
    )
  }
  if (response.status === 403) {
    return new Error(
      detail ||
        'Drive refused the request. Usually the folder isn’t shared publicly, or the key is restricted too tightly.',
    )
  }

  return new Error(detail || `Drive request failed (HTTP ${response.status}).`)
}
