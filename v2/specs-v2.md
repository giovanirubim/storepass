# StorePass v2 — Specification

## 1. Goal

StorePass protects passwords that people write down on paper. The user types a master password, encrypts each password, and keeps the printed result: a QR code with the code in plain text underneath. To recover a password, they scan the QR (or type the code) and enter the master password.

**Primary audience:** non-technical people (e.g. the author's parents), who already write their passwords down and only need to remember one.

**Principles:**
1. The master password is typed by a person; the system must hold up even with "human" passwords.
2. The code is compact and easy to type by hand.
3. Recovery does not depend on the site: a short JS snippet, pasted into any browser's console, decrypts the code.
4. Everything runs in the browser. No server, no account, no database.
5. v1 codes keep working.

## 2. Threat model

| Threat | Mitigation |
|---|---|
| Someone finds or photographs the paper and brute-forces the master password offline | Slow KDF (PBKDF2, 600k iterations) + random salt per code |
| Someone tries obvious passwords directly on the site | Outside the reach of cryptography; depends on master password quality (recommend a passphrase of random words) |
| User mistypes the master password and saves a password they can't recover | Visual signature of the master password (section 8) |
| User mistypes the master password when recovering and trusts a garbage result | Authentication tag: a wrong password produces an explicit error |
| The site goes offline or changes address | Code printed as text + recovery snippet (section 9) |
| Someone watches the master password being typed | Not a realistic concern in this scenario; the field may stay visible |
| Code leaks through server logs or history | Code goes in the URL fragment (`#`), never in the query string |

**Out of scope:** compromised machine (malicious extension, keylogger), deliberate tampering with the paper.

## 3. v2 code format

### Algorithm

| Step | Choice |
|---|---|
| Salt | 8 random bytes per code (`crypto.getRandomValues`) |
| KDF | PBKDF2-HMAC-SHA256, 600,000 iterations (fixed per version) |
| Cipher | AES-GCM, 128-bit key |
| IV | 12 zero bytes. Safe because the key is unique per code (random salt) |
| Tag | 32 bits (`tagLength: 32`) |
| Plaintext | UTF-8 |
| Encoding | `"2"` + Crockford Base32 of `salt ‖ ciphertext ‖ tag` |

Implemented with WebCrypto only (`crypto.subtle`), no dependencies.

### Crockford Base32

- Alphabet: `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no `I`, `L`, `O`, `U`).
- Decoding: case-insensitive, ignores spaces and hyphens, maps `O` → `0` and `I`/`L` → `1`.
- Bits are concatenated and split into groups of 5; leftover bits at the end are discarded when decoding.

### Display

- The code is shown and printed in groups of 5 separated by hyphens, in a monospaced font:
  `21G26-TGAP7-BQ5KC-7P6JD-3661G-GD55M-E8XH5-GQ83N-8PXX0`
- The first character (`2`) is the version.

### Size

Bytes = 8 (salt) + N (password in UTF-8) + 4 (tag). Characters = 1 + ⌈bytes × 8 / 5⌉, not counting hyphens.

| Stored password | v1 | v2 |
|---|---|---|
| 3 characters | 16 | 25 |
| 15 characters | 40 | 45 |
| 16 characters | 42 | 46 |

The code length reveals the stored password length. Accepted (padding would make the code much longer).

### Test vector

- Master password: `trustno1`
- Stored password: `pindamonhangaba`
- Code: `21G26-TGAP7-BQ5KC-7P6JD-3661G-GD55M-E8XH5-GQ83N-8PXX0`

Each encryption yields a different code (random salt); all of them open with the same master password.

### Future versions

Changing iterations or the algorithm creates a new version (`3`, …) instead of encoding parameters in every code.

## 4. v1 compatibility

- **Encrypt:** always v2.
- **Decrypt:** detect by format.
  - Contains `.` or `/` → v1 (`salt.content.checksum` or `salt/content-checksum`, with the current `fixTypos`).
  - Otherwise, first character `2` → v2.
- The v1 code (`encryptionHash`, XOR, checksum) stays in the project for reading only.
- After a v1 code opens successfully, offer "Generate new code" so the user can reprint it in v2 format.

## 5. Link and QR code

- URL: `https://<site>/#<v2-code-without-hyphens>`. Use the fragment, never `?decrypt=`.
- Opening the site with a code in the fragment goes straight to the recovery flow, with the code filled in.
- QR error correction level **M** or **Q** (paper gets folded, stained and faded).
- Even if the site is down, any QR reader shows the URL, and the code is in it.
- **Domain:** ideally a custom domain, so printed QRs survive changes in hosting or repository name.

## 6. Printable image

Generated in the browser (canvas), with buttons to download as PNG and to print.

Contents:
1. QR code.
2. Code as text, grouped, large monospaced font.
3. Blank line to handwrite what the password is for ("Bank ___", "Email ___").
4. Optional: site name in small text, as a hint of where to open it.

Must not contain: the stored password, the master password, or the master password's visual signature.

## 7. Interface

Plain language, one step per screen, large buttons.

### Languages

- All text available in **Portuguese (pt-BR)** and **English**.
- Language picked automatically from the browser, like v1: walk `navigator.languages` (fallback `navigator.language`), use the first one whose base code (`pt`, `en`) is supported, otherwise English.
- Set `<html lang>` accordingly (`pt-BR` / `en`).
- Covers every user-facing string: screens, buttons, error messages, the printable image, and the recovery sheet.
- Keep the v1 i18n structure (a messages table per language, `data-i18n` attributes in the HTML).

### Flow

(Texts below in English; each one has a Portuguese counterpart.)

1. **Start screen:** "To get started, type your master password."
   - Password field with a show/hide button.
   - Visual signature (section 8), updated while typing.
   - "Continue" button.
2. **Menu:**
   - "Store a password I already have"
   - "Create a new password"
   - "Recover a password from a code"
3. **Store existing password:** field for the password → generate code → print screen (section 6).
4. **Create new password:** random password (current generator, 16 characters, with re-roll and copy buttons) → generate code → print screen.
5. **Recover:** scan QR with the camera or type the code → show the password with a copy button.
   - Wrong master password: clear message ("The master password doesn't match this code").
   - Malformed code: clear message ("Invalid code, check that it was typed correctly").
   - v1 code: opens normally and offers to generate a new code.

There is always a "Back" button and a way to change the master password.

## 8. Master password visual signature

**Goal:** confirm the master password was typed correctly without asking for it twice. The user recognizes "their" figure (shapes, colors) and notices when it changes. A prototype already exists.

**Requirements:**
- Deterministic: the same master password always yields the same figure, on any device.
- A one-character difference yields a clearly different figure.
- Derived from a **slow** hash of the master password (e.g. PBKDF2 with fixed salt `"storepass-v2-visual"`), using few bits (~16–24). Reason: anyone who sees the figure on screen (or in a photo) gains a verifier for the master password. With few bits and a slow hash, that verifier helps little in an offline attack.
- Never appears on the printed paper and is never stored.
- Updates with a debounce while the user types (the slow hash takes ~0.1–1 s).

**Alternative / complement:** master password field visible by default, since shoulder-surfing is not a concern in this scenario.

## 9. Recovery without the site

### Snippet

Paste into the browser console (F12 → Console):

```js
async function decrypt(code, pass) {
  const A = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const clean = code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').slice(1)
  const bits = [...clean].map(c => A.indexOf(c).toString(2).padStart(5, '0')).join('')
  const b = new Uint8Array(bits.match(/.{8}/g).map(x => parseInt(x, 2)))
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b.slice(0, 8), iterations: 600000, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 128 }, false, ['decrypt'])
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(12), tagLength: 32 }, key, b.slice(8))
  return new TextDecoder().decode(pt)
}

decrypt('21G26-TGAP7-BQ5KC-7P6JD-3661G-GD55M-E8XH5-GQ83N-8PXX0', 'trustno1').then(console.log)
```

Wrong master password → `OperationError`.

### Recovery sheet

A document printed once and kept with the master password backup (e.g. a sealed envelope held by another trusted person). Contains:
- What StorePass is and the site address.
- Step-by-step instructions for using the snippet.
- The snippet above.
- The test vector, to check the snippet was typed correctly.

The site can generate this sheet (PDF or printable page), in the user's language.

## 10. Master password storage

- Default: `sessionStorage`. The user types it once and recovers several passwords in the same tab; after closing the tab, they type it again.
- Note: browser session restore (and mobile browsers) may keep `sessionStorage` alive.
- Never store the master password on paper, in the QR, in the URL, or on a server.

## 11. Open decisions

- Keep the current "save in this browser for 30 days" option (`localStorage`) or remove it.
- Visual signature vs. field visible by default (or both).
- Custom domain.
- QR scanning with the camera inside the site, or only via the phone camera (which opens the link).
- Offline version of the app (PWA / single HTML file) as another layer of redundancy.
