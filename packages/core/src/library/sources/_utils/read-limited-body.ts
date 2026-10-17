async function readChunks({
  chunks,
  maxBytes,
  reader,
  size,
}: {
  chunks: Uint8Array[];
  maxBytes: number;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  size: number;
}): Promise<Uint8Array[]> {
  const part = await reader.read();

  if (part.done) {
    return chunks;
  }

  const nextSize = size + part.value.byteLength;

  if (nextSize > maxBytes) {
    await reader.cancel();
    throw new Error(`The response is larger than the ${maxBytes}-byte limit.`);
  }

  chunks.push(part.value);

  return readChunks({ chunks, maxBytes, reader, size: nextSize });
}

/** Stops reading once a response is over the limit, instead of trusting its headers. */
export async function readLimitedBody({
  maxBytes,
  response,
}: {
  maxBytes: number;
  response: Response;
}): Promise<Uint8Array> {
  const reader = response.body?.getReader();

  if (!reader) {
    return new Uint8Array();
  }

  const chunks = await readChunks({ chunks: [], maxBytes, reader, size: 0 });

  return new Uint8Array(Buffer.concat(chunks));
}
