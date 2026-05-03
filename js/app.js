let logoDataUrl = null;
const preview = document.getElementById("preview");
const qrModeSelect = document.getElementById("qr-mode");
const freeModePanel = document.getElementById("free-mode-panel");
const accountModePanel = document.getElementById("account-mode-panel");
const tossModePanel = document.getElementById("toss-mode-panel");
const multiLinksInput = document.getElementById("multi-links");
const accountBankInput = document.getElementById("account-bank");
const accountHolderInput = document.getElementById("account-holder");
const accountNumberInput = document.getElementById("account-number");
const accountAmountInput = document.getElementById("account-amount");
const accountMemoInput = document.getElementById("account-memo");
const payPageUrlInput = document.getElementById("pay-page-url");
const tossLinkInput = document.getElementById("toss-link");
const payloadPreview = document.getElementById("payload-preview");
const copyPayloadBtn = document.getElementById("copy-payload-btn");
const payloadCopyStatus = document.getElementById("payload-copy-status");
const qrSizeSelect = document.getElementById("qr-size-select");
const labelVisibilitySelect = document.getElementById("label-visibility");
const accountDisplayPreviewCard = document.getElementById("account-display-preview-card");
const accountDisplayPreview = document.getElementById("account-display-preview");
const fillDefaultPayUrlBtn = document.getElementById("fill-default-pay-url-btn");
const testPayUrlBtn = document.getElementById("test-pay-url-btn");
const copyPayUrlBtn = document.getElementById("copy-pay-url-btn");
const payPageUrlStatus = document.getElementById("pay-page-url-status");
const modeHelp = document.getElementById("mode-help");
const generationStatus = document.getElementById("generation-status");

const fieldErrorMap = new Map([
  [multiLinksInput, document.getElementById("multi-links-error")],
  [accountBankInput, document.getElementById("account-bank-error")],
  [accountHolderInput, document.getElementById("account-holder-error")],
  [accountNumberInput, document.getElementById("account-number-error")],
  [accountAmountInput, document.getElementById("account-amount-error")],
  [accountMemoInput, document.getElementById("account-memo-error")],
  [payPageUrlInput, document.getElementById("pay-page-url-error")],
  [tossLinkInput, document.getElementById("toss-link-error")]
]);

const MAX_QR_PAYLOAD_CHARS = 1800;

function setQrMode(mode) {
  freeModePanel.classList.toggle("is-hidden", mode !== "free");
  accountModePanel.classList.toggle("is-hidden", mode !== "account");
  tossModePanel.classList.toggle("is-hidden", mode !== "toss");
}

function getModeHelpText(mode) {
  if (mode === "account") {
    return "계좌 QR은 pay.html 정적 안내 페이지 URL로 생성됩니다. pay.html은 휴대폰에서 접근 가능한 공개 URL이어야 합니다.";
  }

  if (mode === "toss") {
    return "토스 링크가 QR에 그대로 들어갑니다. 생성 전 링크가 실제로 열리는지 확인해 주세요.";
  }

  return "입력한 각 줄이 QR 코드 하나로 생성됩니다.";
}

function updateModeHelp() {
  if (!modeHelp) return;
  modeHelp.textContent = getModeHelpText(qrModeSelect.value);
}

function setGenerationStatus(message) {
  if (!generationStatus) return;
  generationStatus.textContent = message || "";
}

function setFieldError(input, message) {
  const target = fieldErrorMap.get(input);

  input.classList.toggle("is-invalid", Boolean(message));
  input.setAttribute("aria-invalid", message ? "true" : "false");

  if (target) {
    target.textContent = message || "";
  }
}

function clearFieldError(input) {
  setFieldError(input, "");
}

function clearValidationErrors() {
  fieldErrorMap.forEach((_, input) => clearFieldError(input));
}

function hasControlCharacters(value, allowLineBreaks = false) {
  const text = String(value);
  const pattern = allowLineBreaks ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/ : /[\u0000-\u001F\u007F]/;

  return pattern.test(text);
}

function assertSafePlainText(input, value, message, options = {}) {
  const text = String(value || "");
  const maxLength = options.maxLength || 80;
  const allowLineBreaks = Boolean(options.allowLineBreaks);

  if (hasControlCharacters(text, allowLineBreaks)) {
    setFieldError(input, message);
    throw new Error(message);
  }

  if (text.length > maxLength) {
    const lengthMessage = options.lengthMessage || `입력값은 ${maxLength}자 이내로 줄여 주세요.`;
    setFieldError(input, lengthMessage);
    throw new Error(lengthMessage);
  }
}

function assertRequired(input, value, message) {
  if (!String(value || "").trim()) {
    setFieldError(input, message);
    throw new Error(message);
  }
}

function validateAccountDataForGeneration(data) {
  assertRequired(accountBankInput, data.bank, "은행명을 입력하세요.");
  assertRequired(accountHolderInput, data.holder, "예금주를 입력하세요.");
  assertRequired(accountNumberInput, data.account, "계좌번호를 입력하세요.");

  assertSafePlainText(accountBankInput, data.bank, "은행명에 사용할 수 없는 문자가 있습니다.", { maxLength: 40 });
  assertSafePlainText(accountHolderInput, data.holder, "예금주에 사용할 수 없는 문자가 있습니다.", { maxLength: 40 });
  assertSafePlainText(accountNumberInput, data.account, "계좌번호에 사용할 수 없는 문자가 있습니다.", { maxLength: 40 });

  if (!/\d/.test(data.account)) {
    const message = "계좌번호에는 숫자가 하나 이상 포함되어야 합니다.";
    setFieldError(accountNumberInput, message);
    throw new Error(message);
  }

  if (data.amount) {
    assertSafePlainText(accountAmountInput, data.amount, "금액에 사용할 수 없는 문자가 있습니다.", { maxLength: 30 });

    if (!/^[0-9,\s.\u20A9\uC6D0\uB9CC]+$/.test(data.amount)) {
      const message = "금액은 숫자, 쉼표, 공백, 원/₩ 표기만 입력해 주세요.";
      setFieldError(accountAmountInput, message);
      throw new Error(message);
    }
  }

  if (data.memo) {
    assertSafePlainText(accountMemoInput, data.memo, "메모에 사용할 수 없는 문자가 있습니다.", { maxLength: 80 });
  }
}

function validateTossLinkForGeneration(value) {
  assertRequired(tossLinkInput, value, "토스 링크를 입력하세요.");

  let url;

  try {
    url = new URL(value);
  } catch {
    const message = "토스 링크는 https:// 로 시작하는 URL이어야 합니다.";
    setFieldError(tossLinkInput, message);
    throw new Error(message);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    const message = "토스 링크는 http:// 또는 https:// 주소여야 합니다.";
    setFieldError(tossLinkInput, message);
    throw new Error(message);
  }

  assertSafePlainText(tossLinkInput, value, "토스 링크에 사용할 수 없는 문자가 있습니다.", { maxLength: 500 });
}

function validateFreeTextPayloadsForGeneration(payloads) {
  if (payloads.length === 0) {
    const message = "QR로 만들 내용을 입력하세요.";
    setFieldError(multiLinksInput, message);
    throw new Error(message);
  }

  for (const payload of payloads) {
    assertSafePlainText(multiLinksInput, payload, "자유 입력 내용에 사용할 수 없는 문자가 있습니다.", {
      maxLength: MAX_QR_PAYLOAD_CHARS,
      allowLineBreaks: false,
      lengthMessage: `QR 하나에 들어갈 내용은 ${MAX_QR_PAYLOAD_CHARS}자 이내로 줄여 주세요.`
    });
  }
}

function validatePayloadsForQr(payloads) {
  for (const payload of payloads) {
    if (String(payload).length > MAX_QR_PAYLOAD_CHARS) {
      throw new Error(`QR payload가 너무 깁니다. ${MAX_QR_PAYLOAD_CHARS}자 이내로 줄여 주세요.`);
    }
  }
}

function buildFreeTextPayloads() {
  return multiLinksInput
    .value
    .trim()
    .split("\n")
    .map(value => value.trim())
    .filter(Boolean);
}

function readAccountData() {
  return {
    v: 1,
    type: "account",
    bank: accountBankInput.value.trim(),
    holder: accountHolderInput.value.trim(),
    account: accountNumberInput.value.trim(),
    amount: accountAmountInput.value.trim(),
    memo: accountMemoInput.value.trim()
  };
}

function buildAccountData() {
  const data = readAccountData();

  if (!data.bank || !data.holder || !data.account) {
    throw new Error("은행명, 예금주, 계좌번호를 입력하세요.");
  }

  return data;
}

function buildAccountDataForGeneration() {
  const data = readAccountData();
  validateAccountDataForGeneration(data);

  return data;
}

function buildPartialAccountData() {
  return {
    bank: accountBankInput.value.trim(),
    holder: accountHolderInput.value.trim(),
    account: accountNumberInput.value.trim(),
    amount: accountAmountInput.value.trim(),
    memo: accountMemoInput.value.trim()
  };
}

function buildAccountDisplayTextFromData(data) {
  return [
    "입금계좌",
    [data.bank, data.account].filter(Boolean).join(" "),
    data.holder ? `예금주 ${data.holder}` : "",
    data.amount ? `금액 ${data.amount}` : "",
    data.memo ? data.memo : ""
  ].filter(Boolean).join("\n");
}

function encodeBase64UrlFromJson(data) {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let binary = "";

  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getDefaultPayPageUrl() {
  return new URL("./pay.html", window.location.href);
}

function resolvePayPageUrlCandidate() {
  const inputValue = payPageUrlInput.value.trim();
  return inputValue ? new URL(inputValue, window.location.href) : getDefaultPayPageUrl();
}

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("127.")
  );
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(part => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

function assessPayPageUrl(url) {
  if (!url) {
    return { level: "error", message: "계좌 안내 페이지 URL을 확인할 수 없습니다." };
  }

  if (url.protocol === "file:") {
    return {
      level: "error",
      message: "file:// 경로는 휴대폰에서 열 수 없습니다. pay.html을 공개 정적 URL에 올린 뒤 그 주소를 입력하세요."
    };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return {
      level: "error",
      message: "계좌 안내 페이지 URL은 http:// 또는 https:// 주소여야 합니다."
    };
  }

  if (isLoopbackHostname(url.hostname)) {
    return {
      level: "error",
      message: "localhost/127.0.0.1 주소는 QR 스캔자의 휴대폰에서 열리지 않습니다. 공개 URL을 입력하세요."
    };
  }

  if (isPrivateIpv4(url.hostname)) {
    return {
      level: "warning",
      message: "사설 IP 주소입니다. 같은 네트워크 밖의 휴대폰에서는 연결되지 않을 수 있습니다. 행사/부스용은 공개 URL을 권장합니다."
    };
  }

  return {
    level: "ok",
    message: "pay.html URL 형식은 유효합니다. QR 인쇄 전 반드시 휴대폰으로 열기 테스트를 해 주세요."
  };
}

function setPayPageUrlStatus(level, message) {
  payPageUrlStatus.classList.remove("is-error", "is-warning", "is-ok");

  if (level) {
    payPageUrlStatus.classList.add(`is-${level}`);
  }

  payPageUrlStatus.textContent = message || "";
}

function updatePayPageUrlStatus() {
  if (qrModeSelect.value !== "account") {
    setPayPageUrlStatus("", "");
    return;
  }

  try {
    const url = resolvePayPageUrlCandidate();
    const assessment = assessPayPageUrl(url);
    const prefix = payPageUrlInput.value.trim() ? "입력 URL" : "자동 URL";

    setPayPageUrlStatus(
      assessment.level,
      `${prefix}: ${url.toString()} — ${assessment.message}`
    );
  } catch {
    setPayPageUrlStatus("error", "계좌 안내 페이지 URL 형식이 올바르지 않습니다.");
  }
}

function resolvePayPageUrl() {
  const url = resolvePayPageUrlCandidate();
  const assessment = assessPayPageUrl(url);

  if (assessment.level === "error") {
    throw new Error(assessment.message);
  }

  return url.toString();
}

function buildAccountLandingUrlFromData(data, baseUrl) {
  const encoded = encodeBase64UrlFromJson(data);
  const url = new URL(baseUrl);

  url.hash = `d=${encoded}`;

  return url.toString();
}

function buildAccountLandingUrl() {
  const data = buildAccountData();
  const baseUrl = resolvePayPageUrl();

  return buildAccountLandingUrlFromData(data, baseUrl);
}

function buildAccountLandingUrlForGeneration() {
  const data = buildAccountDataForGeneration();
  let baseUrl = "";

  try {
    baseUrl = resolvePayPageUrl();
  } catch (error) {
    setFieldError(payPageUrlInput, error.message || "계좌 안내 페이지 URL을 확인하세요.");
    throw error;
  }

  return buildAccountLandingUrlFromData(data, baseUrl);
}

function buildTossPayload() {
  const tossLink = tossLinkInput.value.trim();
  validateTossLinkForGeneration(tossLink);

  return tossLink;
}

function resolvePayloadsByMode(mode) {
  if (mode === "free") {
    const payloads = buildFreeTextPayloads();
    validateFreeTextPayloadsForGeneration(payloads);

    return payloads;
  }

  if (mode === "account") {
    return [buildAccountLandingUrlForGeneration()];
  }

  if (mode === "toss") {
    return [buildTossPayload()];
  }

  return [];
}

function buildFreeTextPayloadPreview() {
  return buildFreeTextPayloads().join("\n");
}

function buildAccountPayloadPreview() {
  try {
    return buildAccountLandingUrl();
  } catch {
    return "";
  }
}

function buildTossPayloadPreview() {
  return tossLinkInput.value.trim();
}

function resolvePayloadPreviewByMode(mode) {
  if (mode === "free") {
    return buildFreeTextPayloadPreview();
  }

  if (mode === "account") {
    return buildAccountPayloadPreview();
  }

  if (mode === "toss") {
    return buildTossPayloadPreview();
  }

  return "";
}

function getSelectedQrSize() {
  const parsedSize = Number.parseInt(qrSizeSelect.value, 10);

  if ([256, 512, 1024].includes(parsedSize)) {
    return parsedSize;
  }

  return 512;
}

function shouldShowQrLabel() {
  return labelVisibilitySelect.value !== "hide";
}

function sanitizeFilename(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[^\w가-힣.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function truncateFilenamePart(value, maxLength = 48) {
  const text = String(value);

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength).replace(/_+$/g, "");
}

function getLastDigits(value, length = 4) {
  const digits = String(value).replace(/\D/g, "");
  return digits.slice(-length);
}

function buildAccountFilename(index) {
  let bankName = "account";
  let lastDigits = "";

  try {
    const data = buildAccountData();
    bankName = data.bank || "account";
    lastDigits = getLastDigits(data.account);
  } catch {
    bankName = accountBankInput.value.trim() || "account";
    lastDigits = getLastDigits(accountNumberInput.value);
  }

  const safeBankName = sanitizeFilename(bankName) || "account";
  const suffix = lastDigits ? `_${lastDigits}` : `_${index + 1}`;

  return `account_${safeBankName}${suffix}`;
}

function buildTossFilename(index) {
  const rawValue = tossLinkInput.value.trim();

  try {
    const url = new URL(rawValue);
    const host = sanitizeFilename(url.hostname.replace(/^www\./, ""));
    const path = sanitizeFilename(url.pathname.replace(/\//g, "_"));
    const joined = [host, path].filter(Boolean).join("_");
    const safeName = truncateFilenamePart(sanitizeFilename(joined), 48);

    return safeName ? `toss_${safeName}` : `toss_link_${index + 1}`;
  } catch {
    return `toss_link_${index + 1}`;
  }
}

function buildFreeFilename(payload, index) {
  const rawPayload = String(payload || "").trim();

  try {
    const url = new URL(rawPayload);
    const host = sanitizeFilename(url.hostname.replace(/^www\./, ""));
    const path = sanitizeFilename(url.pathname.replace(/\//g, "_"));
    const joined = [host, path].filter(Boolean).join("_");
    const safeName = truncateFilenamePart(sanitizeFilename(joined), 48);

    return safeName ? `free_${safeName}` : `free_qr_${index + 1}`;
  } catch {
    const textName = truncateFilenamePart(sanitizeFilename(rawPayload), 40);
    return textName ? `free_${textName}` : `free_qr_${index + 1}`;
  }
}

function resolveQrFilename(mode, payload, index) {
  let filename = "";

  if (mode === "account") {
    filename = buildAccountFilename(index);
  } else if (mode === "toss") {
    filename = buildTossFilename(index);
  } else {
    filename = buildFreeFilename(payload, index);
  }

  return sanitizeFilename(filename) || `qr_${index + 1}`;
}

function ensureUniqueFilename(baseName, usedNames) {
  let name = baseName;
  let counter = 2;

  while (usedNames.has(name)) {
    name = `${baseName}_${counter}`;
    counter += 1;
  }

  usedNames.add(name);
  return name;
}

function updateAccountDisplayPreview() {
  if (qrModeSelect.value !== "account") {
    accountDisplayPreviewCard.classList.add("is-hidden");
    accountDisplayPreview.textContent = "";
    return;
  }

  accountDisplayPreviewCard.classList.remove("is-hidden");
  accountDisplayPreview.textContent = buildAccountDisplayTextFromData(buildPartialAccountData());
}

function updatePayloadPreview() {
  const mode = qrModeSelect.value;
  const payload = resolvePayloadPreviewByMode(mode);

  payloadPreview.value = payload;
  payloadCopyStatus.textContent = "";
  updateAccountDisplayPreview();
  updatePayPageUrlStatus();
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error("clipboard copy failed");
  }
}

qrModeSelect.addEventListener("change", event => {
  clearValidationErrors();
  setGenerationStatus("");
  setQrMode(event.target.value);
  updatePayloadPreview();
  updateModeHelp();
});

[
  multiLinksInput,
  accountBankInput,
  accountHolderInput,
  accountNumberInput,
  accountAmountInput,
  accountMemoInput,
  payPageUrlInput,
  tossLinkInput
].forEach(input => {
  input.addEventListener("input", () => {
    clearFieldError(input);
    updatePayloadPreview();
  });
});

copyPayloadBtn.addEventListener("click", async () => {
  const text = payloadPreview.value.trim();

  if (!text) {
    payloadCopyStatus.textContent = "복사할 QR 내용이 없습니다.";
    return;
  }

  try {
    await copyTextToClipboard(text);
    payloadCopyStatus.textContent = "QR 내용이 복사됐습니다.";
  } catch (error) {
    payloadCopyStatus.textContent = "자동 복사에 실패했습니다. 내용을 직접 선택해 복사해 주세요.";
  }
});

fillDefaultPayUrlBtn.addEventListener("click", () => {
  try {
    const url = getDefaultPayPageUrl();
    const assessment = assessPayPageUrl(url);

    if (assessment.level === "error") {
      setPayPageUrlStatus("error", assessment.message);
      return;
    }

    payPageUrlInput.value = url.toString();
    updatePayloadPreview();
  } catch {
    setPayPageUrlStatus("error", "현재 위치 기준 pay.html URL을 만들 수 없습니다.");
  }
});

testPayUrlBtn.addEventListener("click", () => {
  try {
    const url = resolvePayPageUrlCandidate();
    const assessment = assessPayPageUrl(url);

    setPayPageUrlStatus(
      assessment.level,
      `${url.toString()} — ${assessment.message}`
    );

    if (assessment.level === "error") {
      return;
    }

    window.open(url.toString(), "_blank", "noopener");
    setPayPageUrlStatus(
      assessment.level,
      `새 탭에서 ${url.toString()} 을 열었습니다. 계좌 데이터 없이 열면 "계좌 정보를 읽을 수 없습니다"가 보여도 파일 연결은 살아있는 것입니다.`
    );
  } catch {
    setPayPageUrlStatus("error", "계좌 안내 페이지 URL 형식이 올바르지 않습니다.");
  }
});

copyPayUrlBtn.addEventListener("click", async () => {
  try {
    const url = resolvePayPageUrlCandidate();
    const assessment = assessPayPageUrl(url);

    if (assessment.level === "error") {
      setPayPageUrlStatus("error", assessment.message);
      return;
    }

    await copyTextToClipboard(url.toString());
    setPayPageUrlStatus(assessment.level, "pay.html URL이 복사됐습니다. 배포된 주소인지 휴대폰에서 확인해 주세요.");
  } catch {
    setPayPageUrlStatus("error", "pay.html URL 복사에 실패했습니다. URL을 직접 선택해 복사해 주세요.");
  }
});

setQrMode(qrModeSelect.value);
updatePayloadPreview();
updateModeHelp();

document.getElementById("logo-input").addEventListener("change", e => {
  const file = e.target.files && e.target.files[0];
  if (!file) {
    logoDataUrl = null;
    return;
  }

  const reader = new FileReader();
  reader.onload = () => logoDataUrl = reader.result;
  reader.readAsDataURL(file);
});

document.getElementById("generate-btn").addEventListener("click", async () => {
  clearValidationErrors();
  setGenerationStatus("");
  updatePayloadPreview();

  const qrMode = qrModeSelect.value;
  const dotStyle = document.getElementById("dot-style").value;
  const format = document.getElementById("format-select").value;
  const logoBgColor = document.getElementById("logo-bg-color").value;
  const qrSize = getSelectedQrSize();

  let payloads = [];

  try {
    payloads = resolvePayloadsByMode(qrMode);
    validatePayloadsForQr(payloads);
  } catch (error) {
    const message = error.message || "QR 생성에 실패했습니다.";
    alert(message);
    setGenerationStatus(message);
    return;
  }

  if (payloads.length === 0) {
    const message = "QR로 만들 내용을 입력하세요.";
    alert(message);
    setGenerationStatus(message);
    return;
  }

  preview.innerHTML = "";

  const usedFilenames = new Set();

  for (let i = 0; i < payloads.length; i++) {
    const qr = new QRCodeStyling({
      width: qrSize,
      height: qrSize,
      type: format,
      data: payloads[i],
      image: logoDataUrl || undefined,
      margin: 12,
      // Logo recognition guard: keep the original SSOT behavior.
      // Hide dots behind the logo and preserve the selected logo background color.
      imageOptions: {
        crossOrigin: "anonymous",
        margin: 6,
        imageSize: 0.25,
        hideBackgroundDots: true,
        backgroundColor: logoBgColor
      },
      dotsOptions: {
        type: dotStyle,
        color: "#111111"
      },
      backgroundOptions: {
        color: "#ffffff"
      },
      qrOptions: {
        errorCorrectionLevel: "H"
      },
      cornersSquareOptions: {
        type: "extra-rounded",
        color: "#111"
      },
      cornersDotOptions: {
        type: "dot",
        color: "#111"
      }
    });

    const container = document.createElement("div");
    container.className = "qr-block";

    if (!shouldShowQrLabel()) {
      container.classList.add("has-hidden-label");
    }

    const qrMount = document.createElement("div");
    qrMount.className = "qr-canvas";

    const label = document.createElement("div");
    label.className = "qr-label";
    label.textContent = payloads[i];

    container.appendChild(qrMount);
    container.appendChild(label);

    await qr.append(qrMount);
    container.qrCodeInstance = qr;
    container.dataset.format = format;

    const baseFilename = resolveQrFilename(qrMode, payloads[i], i);
    const filename = ensureUniqueFilename(baseFilename, usedFilenames);
    container.dataset.content = filename;

    preview.appendChild(container);
  }

  setGenerationStatus(`${payloads.length}개의 QR을 생성했습니다. 인쇄 전 휴대폰 카메라로 실제 스캔 테스트해 주세요.`);
});

document.getElementById("download-btn").addEventListener("click", async () => {
  const blocks = document.querySelectorAll(".qr-block");
  const format = document.getElementById("format-select").value;
  if (blocks.length === 0) return alert("먼저 QR을 생성하세요!");

  const zip = new JSZip();

  for (const block of blocks) {
    const qr = block.qrCodeInstance;
    const label = block.dataset.content;

    if (!qr) continue;

    const blob = await qr.getRawData(format);
    zip.file(`${label}.${format}`, blob);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "qr_codes.zip";
  a.click();
});
