const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Encode a value as a NATS-compatible Uint8Array (JSON). */
export function encode<T>(value: T): Uint8Array {
  return encoder.encode(JSON.stringify(value));
}

/** Decode a NATS message payload from Uint8Array back to a typed value. */
export function decode<T>(data: Uint8Array): T {
  return JSON.parse(decoder.decode(data)) as T;
}
