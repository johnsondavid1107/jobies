import { Readable } from 'stream';
import { google } from 'googleapis';
import { oauthClient, getRefreshToken } from '@/lib/google/credentials';

const DOCX_MIME =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

/**
 * Authenticated Drive client built from the active OAuth refresh token.
 * Single-user app — the token comes from the DB connection (set via the
 * dashboard Connect flow), falling back to the GOOGLE_REFRESH_TOKEN env var.
 * Scope is `drive.file`, so the app can only see files it created.
 */
export async function getDrive() {
  const rt = await getRefreshToken();
  if (!rt) {
    throw new Error(
      'Google Drive not connected. Connect it from the dashboard (or set GOOGLE_REFRESH_TOKEN).',
    );
  }
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: rt.token });
  return google.drive({ version: 'v3', auth });
}

/** Upload a DOCX buffer and convert it to a native Google Doc. Returns the file id. */
export async function uploadDocxAsGoogleDoc(
  name: string,
  docx: Buffer,
): Promise<{ fileId: string }> {
  const drive = await getDrive();
  const res = await drive.files.create({
    requestBody: { name, mimeType: GOOGLE_DOC_MIME },
    media: { mimeType: DOCX_MIME, body: Readable.from(docx) },
    fields: 'id',
  });
  const fileId = res.data.id;
  if (!fileId) throw new Error('Drive did not return a file id');
  return { fileId };
}

/** Export a Google Doc back to DOCX + PDF buffers. */
export async function exportDoc(fileId: string): Promise<{ docx: Buffer; pdf: Buffer }> {
  const drive = await getDrive();
  const grab = async (mimeType: string) => {
    const res = await drive.files.export(
      { fileId, mimeType },
      { responseType: 'arraybuffer' },
    );
    return Buffer.from(res.data as ArrayBuffer);
  };
  const [docx, pdf] = await Promise.all([grab(DOCX_MIME), grab('application/pdf')]);
  return { docx, pdf };
}

export function docUrl(fileId: string): string {
  return `https://docs.google.com/document/d/${fileId}/edit`;
}

/**
 * Convert a DOCX to PDF via Drive, returning the PDF and the Google Doc's id.
 * The Doc is kept (not deleted) so it doubles as the editable Doc for the
 * "Edit in Docs" round-trip — no second upload needed.
 */
export async function docxToPdf(
  name: string,
  docx: Buffer,
): Promise<{ pdf: Buffer; fileId: string }> {
  const { fileId } = await uploadDocxAsGoogleDoc(name, docx);
  const { pdf } = await exportDoc(fileId);
  return { pdf, fileId };
}
