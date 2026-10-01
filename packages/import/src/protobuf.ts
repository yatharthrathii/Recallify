/**
 * Enough protocol buffers to read two things.
 *
 * The current collection format keeps each note type's kind and each
 * template's two format strings in protobuf blobs. This reads a message into
 * its numbered fields and nothing more: no schema, no nested decoding beyond
 * "these bytes are a string". A full protobuf runtime would be the largest
 * dependency in the package for three fields.
 */

import { strFromU8 } from 'fflate';

export interface ProtoField {
  readonly number: number;
  /** The raw varint for wire type 0; the bytes for type 2. Other types are skipped. */
  readonly varint?: number;
  readonly bytes?: Uint8Array;
}

function readVarint(buf: Uint8Array, at: number): { value: number; next: number } {
  let value = 0;
  let shift = 0;
  let i = at;
  for (;;) {
    const byte = buf[i];
    if (byte === undefined) throw new Error('Truncated protobuf varint');
    i += 1;
    // Past 2^53 a varint no longer fits a JS number exactly; the values read
    // here are enums and lengths, so the loss is only in the high bits of a
    // 64-bit id, which is not read.
    value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return { value, next: i };
    shift += 7;
  }
}

export function readFields(buf: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let at = 0;
  while (at < buf.length) {
    const tag = readVarint(buf, at);
    at = tag.next;
    const number = Math.floor(tag.value / 8);
    const wire = tag.value % 8;
    if (wire === 0) {
      const v = readVarint(buf, at);
      at = v.next;
      fields.push({ number, varint: v.value });
    } else if (wire === 2) {
      const len = readVarint(buf, at);
      const start = len.next;
      const end = start + len.value;
      if (end > buf.length) throw new Error('Truncated protobuf field');
      fields.push({ number, bytes: buf.subarray(start, end) });
      at = end;
    } else if (wire === 1) {
      at += 8;
    } else if (wire === 5) {
      at += 4;
    } else {
      throw new Error(`Unsupported protobuf wire type ${wire}`);
    }
  }
  return fields;
}

export function protoString(fields: readonly ProtoField[], number: number): string {
  const field = fields.find((f) => f.number === number && f.bytes !== undefined);
  // fflate's decoder rather than TextDecoder: the package is built against the
  // plain ES library so it stays free of any host's globals.
  return field?.bytes ? strFromU8(field.bytes) : '';
}

export function protoVarint(fields: readonly ProtoField[], number: number): number {
  const field = fields.find((f) => f.number === number && f.varint !== undefined);
  return field?.varint ?? 0;
}
