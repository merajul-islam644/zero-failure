// The dossier portrait's wire: the five steps the platform's own
// profile uploader runs — a presigned Data file slot, the raw bytes
// PUT straight to cloud storage, the completion call only when the
// presign demanded one, the file record read back for its public url,
// and the IAM profile patch that binds the picture to the operative.
// Every answer rides back a loose Record, so each reads through a
// defensive unwrap — a stranger shape fails its step honestly, never
// smuggles an empty string into the file. The client is injected so
// tests (and node) never construct the real browser client.

import type { BlocksClient } from "@seliseblocks/client";

/** what the dossier's face accepts — the platform uploader's own
 *  list, so parity is the contract, not a local invention */
export const PORTRAIT_ACCEPT =
  "image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml";

/** 5 MB — the same ceiling the platform's uploader enforces */
export const PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;

const PORTRAIT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

/** The one gate that runs before any wire moves: a refused file never
 *  leaves the machine. Returns the reason as the operator will read
 *  it, or null when the file may go up. */
export function portraitError(file: { type?: string; size?: number }): string | null {
  const type = (file.type ?? "").toLowerCase();
  if (!PORTRAIT_TYPES.has(type)) {
    return "That file type won't hang on the file — PNG, JPEG, GIF, WebP or SVG only.";
  }
  if (typeof file.size === "number" && file.size > PORTRAIT_MAX_BYTES) {
    return "That portrait weighs over 5 MB — the file cabinet refuses it.";
  }
  return null;
}

/** A loose Blocks answer, readable only when it rode back as an object. */
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The wire sometimes wraps its payload in a `data` envelope and
 *  sometimes answers flat — both read, envelope preferred. */
function envelopeData(response: unknown): Record<string, unknown> {
  const rec = asRecord(response);
  return asRecord(rec?.data) ?? rec ?? {};
}

/** The file record's own public address — what the portrait renders.
 *  An absent url reads as "" and the caller refuses to bind a blank. */
export function fileUrl(record: unknown): string {
  return asString(envelopeData(record).url);
}

/** What one finished portrait upload reports — the bound ids and the
 *  public url the dossier now renders. */
export interface PortraitUpload {
  fileId: string;
  fileVersionId: string;
  url: string;
}

/** The five steps in the platform uploader's own order: presign a
 *  Data file slot (Public, under the IAM module), PUT the raw bytes
 *  straight to cloud storage, complete the upload only when the
 *  presign demanded it, read the file record back for its url, and
 *  patch the operative's IAM profile with the binding — the same
 *  fields the platform sends. Any refusal rejects: the caller tells
 *  the operator, and nothing binds. */
export async function uploadPortrait(
  client: BlocksClient,
  request: { file: File; userId: string }
): Promise<PortraitUpload> {
  // 1 — the presigned slot: Public so the url renders straight in an img
  const presigned = envelopeData(
    await client.data.files.presignedUploadUrl({
      configurationName: "Default",
      accessModifier: "Public",
      moduleName: 5, // the IAM cloud module — where the platform files portraits
      name: request.file.name,
      itemId: "",
      tags: "",
      metaData: "",
      parentDirectoryId: "",
    })
  );
  const fileId = asString(presigned.fileId);
  const uploadUrl = asString(presigned.uploadUrl);
  const fileVersionId = asString(presigned.fileVersionId);
  if (!fileId || !uploadUrl) {
    throw new Error("The file cabinet refused a slot for the portrait.");
  }

  // 2 — the bytes ride straight to cloud storage; no auth headers, the
  // presigned url is the whole permission
  await client.data.files.uploadToUrl({
    url: uploadUrl,
    body: request.file,
    contentType: request.file.type,
  });

  // 3 — completion only when the presign demanded it; the SDK has no
  // wrapper for this endpoint, the client's own http carries it
  if (presigned.uploadCompletionRequired === true) {
    await client.http.request("/data/v4/files/complete-upload", {
      method: "POST",
      body: { fileId, fileVersionId },
    });
  }

  // 4 — the record back, carrying the public url
  const url = fileUrl(await client.data.files.get(fileId, { configurationName: "Default" }));
  if (!url) {
    throw new Error("The portrait landed, but its file record carries no address.");
  }

  // 5 — the binding: profile patch, sparse by contract — only these
  // three fields move, everything else on the file stays
  await client.iam.users.update(request.userId, {
    itemId: request.userId,
    profileImageId: fileId,
    profileImageUrl: url,
  });

  return { fileId, fileVersionId, url };
}
