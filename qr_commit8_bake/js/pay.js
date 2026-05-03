let paymentData = null;

function decodeBase64UrlToJson(value) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const json = new TextDecoder().decode(bytes);

  return JSON.parse(json);
}

function getEncodedDataFromHash() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  return params.get("d");
}

function hasControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(String(value));
}

function isSafeDisplayText(value, maxLength) {
  return typeof value === "string" && value.length <= maxLength && !hasControlCharacters(value);
}

function validatePaymentData(data) {
  return Boolean(
    data &&
    data.v === 1 &&
    data.type === "account" &&
    isSafeDisplayText(data.bank, 40) &&
    isSafeDisplayText(data.holder, 40) &&
    isSafeDisplayText(data.account, 40) &&
    data.bank.trim() &&
    data.holder.trim() &&
    data.account.trim() &&
    /\d/.test(data.account) &&
    (data.amount === undefined || isSafeDisplayText(data.amount, 30)) &&
    (data.memo === undefined || isSafeDisplayText(data.memo, 80))
  );
}

function renderPaymentData(data) {
  document.getElementById("pay-bank").textContent = data.bank;
  document.getElementById("pay-account").textContent = data.account;
  document.getElementById("pay-holder").textContent = data.holder;

  const amountRow = document.getElementById("pay-amount-row");
  const memoRow = document.getElementById("pay-memo-row");

  if (data.amount) {
    document.getElementById("pay-amount").textContent = data.amount;
    amountRow.hidden = false;
  } else {
    amountRow.hidden = true;
  }

  if (data.memo) {
    document.getElementById("pay-memo").textContent = data.memo;
    memoRow.hidden = false;
  } else {
    memoRow.hidden = true;
  }

  document.getElementById("pay-content").hidden = false;
  document.getElementById("pay-error").hidden = true;
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

function buildCopyAllText(data) {
  return [
    "입금계좌",
    `${data.bank} ${data.account}`,
    `예금주 ${data.holder}`,
    data.amount ? `금액 ${data.amount}` : "",
    data.memo ? data.memo : ""
  ].filter(Boolean).join("\n");
}

function showError() {
  document.getElementById("pay-error").hidden = false;
  document.getElementById("pay-content").hidden = true;
}

function bootPayPage() {
  try {
    const encoded = getEncodedDataFromHash();

    if (!encoded) {
      showError();
      return;
    }

    const data = decodeBase64UrlToJson(encoded);

    if (!validatePaymentData(data)) {
      showError();
      return;
    }

    paymentData = data;
    renderPaymentData(data);
  } catch {
    showError();
  }
}

document.getElementById("copy-account-btn").addEventListener("click", async () => {
  if (!paymentData) return;

  try {
    await copyTextToClipboard(paymentData.account);
    document.getElementById("copy-status").textContent = "계좌번호가 복사됐습니다.";
  } catch {
    document.getElementById("copy-status").textContent = "자동 복사에 실패했습니다. 계좌번호를 직접 선택해 주세요.";
  }
});

document.getElementById("copy-all-btn").addEventListener("click", async () => {
  if (!paymentData) return;

  try {
    await copyTextToClipboard(buildCopyAllText(paymentData));
    document.getElementById("copy-status").textContent = "전체 계좌 정보가 복사됐습니다.";
  } catch {
    document.getElementById("copy-status").textContent = "자동 복사에 실패했습니다. 내용을 직접 선택해 주세요.";
  }
});

bootPayPage();
