export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text || typeof window === "undefined") return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback.
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);

    const selection = document.getSelection();
    const selectedRange =
      selection && selection.rangeCount > 0
        ? selection.getRangeAt(0)
        : null;

    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);

    if (selection) {
      selection.removeAllRanges();
      if (selectedRange) {
        selection.addRange(selectedRange);
      }
    }

    return copied;
  } catch {
    return false;
  }
}
