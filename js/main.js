const inputs = {
    mainPass: null,
    pass: null,
    encrypted: null,
};

const strToBuff = (text) => {
    return new TextEncoder().encode(text);
};

const buffToHex = (buff) => {
    return [...new Uint8Array(buff)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
};

const strToHex = (str) => {
    return buffToHex(strToBuff(str));
};

const hextToStr = (hex) => {
    return new TextDecoder()
        .decode(
            new Uint8Array(
                hex.match(/../g).map(x => parseInt(x, 16))
            ).buffer
        );
};

const strToSha256Hex = async (str) => {
    const hashBuff = await crypto.subtle.digest(
        'SHA-256',
        strToBuff(str),
    );
    return buffToHex(hashBuff);
};

const encryptionHash = async (salt, pass, len) => {
    let res = '';
    let suffix = '';
    while (res.length < len) {
        res += await strToSha256Hex(salt + pass + suffix);
        suffix = ':' + (Number(suffix.replace(':', '') || '0') + 1);
    }
    return res.slice(0, len);
};

const xorHexStr = (a, b) => {
    if (!a || !b) return '';
    return (
        (`0x${a[0]}` ^ `0x${b[0]}`).toString(16)
        + xorHexStr(a.slice(1), b.slice(1))
    );
};

const encrypt = async () => {
    const pass = inputs.mainPass.value;
    const salt = 'x'.repeat(6)
        .replace(/x/g, () => (Math.random()*16|0).toString(16));
    const hexText = strToHex(inputs.pass.value);
    const hash = await encryptionHash(salt, pass, hexText.length);
    const content = xorHexStr(hash, hexText);
    const checksum = (await strToSha256Hex(salt + content)).slice(0, 2);
    inputs.encrypted.value = `${salt}/${content}-${checksum}`;
};

const decrypt = async () => {
    const pass = inputs.mainPass.value;
    const [ salt, content, checksum ] = inputs.encrypted.value.split(/[\/\-]/);
    const hash = await encryptionHash(salt, pass, content.length);
    const text = hextToStr(xorHexStr(hash, content));
    inputs.pass.value = text;
};

const toggleClass = (dom, className) => {
    const curr = dom.getAttribute('class');
    const set = new Set(curr ? curr.split(/\s+/) : []);
    if (set.has(className)) {
        set.delete(className);
    } else {
        set.add(className);
    }
    dom.setAttribute('class', [...set].join(' '));
    return set.has(className);
};

const toggleQRCode = () => {
    const container = document.querySelector('#qrContainer');
    const dom = document.querySelector('#qr');
    if (toggleClass(container, 'hidden')) {
        dom.innerHTML = '';
        return;
    }
    const arg = inputs.encrypted.value;
    const url = `https://giovanirubim.github.io/storepass?decrypt=${arg}`;
    new QRCode(dom, {
        text: url,
        width: 180,
        height: 180,
        colorDark: '#000',
        colorLight: '#fff',
        correctLevel: QRCode.CorrectLevel.L,
    });
};

const bindButton = (id, handler) => {
    document.querySelector(`#${id}`)
        .addEventListener('click', handler);
};

const loadFromQuery = () => {
    const { search } = window.location;
    const args = new URLSearchParams(search);
    const value = args.get('decrypt');
    if (!value) return;
    inputs.encrypted.value = value;
};

const init = async () => {
    inputs.mainPass = document.querySelector('#mainPass')
    inputs.pass = document.querySelector('#pass')
    inputs.encrypted = document.querySelector('#encrypted')

    bindButton('encrypt', encrypt);
    bindButton('decrypt', decrypt);
    bindButton('toggleQR', toggleQRCode);

    loadFromQuery();
};

window.addEventListener('load', init);
