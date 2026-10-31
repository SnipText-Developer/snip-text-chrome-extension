const pretendardStylesheet =
  "https://cdnjs.cloudflare.com/ajax/libs/pretendard/1.3.9/static/pretendard.min.css";

export function ensurePretendardFont(document: Document): void {
  let hasPretendard = false;
  document.fonts.forEach((font) => {
    if (font.family.replace(/["']/g, "").trim().toLowerCase() === "pretendard") {
      hasPretendard = true;
    }
  });
  if (hasPretendard) return;

  const existingLink = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .some((link) => link.getAttribute("href") === pretendardStylesheet);
  if (existingLink) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = pretendardStylesheet;
  link.type = "text/css";
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
}
