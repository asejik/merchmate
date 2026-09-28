// Share or save files from the browser. Kept separate from pdf.tsx so non-PDF features can use it.

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the native share sheet (WhatsApp etc.) when the device can share files, otherwise downloads. */
export async function shareOrDownload(file: File, title: string, text: string): Promise<void> {
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title, text });
  } else {
    downloadBlob(file, file.name);
  }
}
