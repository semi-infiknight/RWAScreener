/**
 * DBC PartnerMetadata account (optional profile keyed by fee_claimer).
 * Disc + layout from on-chain accounts / carbon-meteora-dbc-decoder.
 * Never invent fee_claimer pubkeys.
 */
import bs58 from "bs58";

/** Anchor discriminator [68, 68, 130, 19, 16, 209, 98, 156]. */
export const PARTNER_METADATA_DISC = Buffer.from([
  68, 68, 130, 19, 16, 209, 98, 156,
]);

export const PARTNER_METADATA_DISC_B58 = bs58.encode(PARTNER_METADATA_DISC);

/** fee_claimer pubkey starts immediately after the 8-byte disc. */
export const PARTNER_METADATA_FEE_CLAIMER_OFFSET = 8;

/** [u128; 6] padding after fee_claimer. */
export const PARTNER_METADATA_PADDING_U128 = 6;

export const PARTNER_METADATA_STRINGS_OFFSET =
  8 + 32 + 16 * PARTNER_METADATA_PADDING_U128; // 136

function encodePk(buf) {
  return bs58.encode(buf);
}

function readBorshString(buf, offset) {
  if (offset + 4 > buf.length) return { value: null, next: offset };
  const len = buf.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + len;
  if (len > 4096 || end > buf.length) return { value: null, next: offset };
  return { value: buf.subarray(start, end).toString("utf8"), next: end };
}

/**
 * @param {Buffer|Uint8Array|null|undefined} data full account data
 * @returns {{ fee_claimer: string, name: string, website: string, logo: string } | null}
 */
export function decodePartnerMetadata(data) {
  if (!data || data.length < PARTNER_METADATA_STRINGS_OFFSET + 12) return null;
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (!buf.subarray(0, 8).equals(PARTNER_METADATA_DISC)) return null;
  const fee_claimer = encodePk(
    buf.subarray(
      PARTNER_METADATA_FEE_CLAIMER_OFFSET,
      PARTNER_METADATA_FEE_CLAIMER_OFFSET + 32,
    ),
  );
  let off = PARTNER_METADATA_STRINGS_OFFSET;
  const name = readBorshString(buf, off);
  if (name.value == null) return null;
  const website = readBorshString(buf, name.next);
  if (website.value == null) return null;
  const logo = readBorshString(buf, website.next);
  if (logo.value == null) return null;
  return {
    fee_claimer,
    name: name.value,
    website: website.value,
    logo: logo.value,
  };
}

/** True when on-chain profile is complete enough to consider as label evidence. */
export function partnerMetadataIsComplete(row) {
  if (!row || typeof row !== "object") return false;
  const name = typeof row.name === "string" ? row.name.trim() : "";
  const website = typeof row.website === "string" ? row.website.trim() : "";
  const fc = typeof row.fee_claimer === "string" ? row.fee_claimer.trim() : "";
  if (!name || !fc || fc.length < 32) return false;
  return /^https?:\/\//i.test(website);
}
