/**
 * - **bold**
 * - *italic*
 * - [[TRIGGER:xyz]]
 */

function parseTrigger(triggerText) {
  const firstColon = triggerText.indexOf(":");
  if (firstColon === -1) return null;

  const type = triggerText.slice(0, firstColon).trim().toUpperCase();
  let rest = triggerText.slice(firstColon + 1).trim();

  let source = null;
  let data = rest;

  // If JSON starts immediately, treat everything as data
  if (rest.startsWith("{") || rest.startsWith("[")) {
    return {
      type,
      source,
      data: rest,
    };
  }

  // Otherwise attempt TYPE:SOURCE:DATA
  const secondColon = rest.indexOf(":");

  if (secondColon !== -1) {
    source = rest.slice(0, secondColon).trim().toLowerCase();
    data = rest.slice(secondColon + 1).trim();
  }

  return {
    type,
    source,
    data,
  };
}

function interpretAIText(rawText = "") {
  if (!rawText || typeof rawText !== "string") {
    return { cleanText: "", triggers: [] };
  }

  const triggers = [];

  const triggerRegex = /\[\[(.*?)\]\]/gs;

  let match;

  while ((match = triggerRegex.exec(rawText)) !== null) {
    const parsed = parseTrigger(match[1]);
    if (parsed) triggers.push(parsed);
  }

  const cleanText = rawText
    .replace(/\[\[(.*?)\]\]/gs, "") // remove triggers
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .trim();

  return {
    cleanText,
    triggers,
  };
}

function parseAIBlocks(text) {
  const lines = text.split("\n");

  const blocks = [];

  let paragraphBuffer = [];
  let listBuffer = [];
  let numberedBuffer = [];
  let tableBuffer = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length) {
      blocks.push({
        type: "paragraph",
        content: paragraphBuffer.join(" "),
      });
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length) {
      blocks.push({
        type: "bullet_list",
        items: [...listBuffer],
      });
      listBuffer = [];
    }
  };

  const flushNumbered = () => {
    if (numberedBuffer.length) {
      blocks.push({
        type: "numbered_list",
        items: [...numberedBuffer],
      });
      numberedBuffer = [];
    }
  };

  const flushTable = () => {
    if (tableBuffer.length) {
      blocks.push({
        type: "table",
        rows: [...tableBuffer],
      });
      tableBuffer = [];
    }
  };

  for (let raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushParagraph();
      flushList();
      flushNumbered();
      flushTable();
      continue;
    }

    // HEADINGS
    if (line.startsWith("#")) {
      flushParagraph();
      flushList();
      flushNumbered();
      flushTable();

      const level = line.match(/^#+/)[0].length;

      blocks.push({
        type: "heading",
        level,
        content: line.replace(/^#+\s*/, ""),
      });

      continue;
    }

    // BULLET LIST
    if (line.startsWith("- ") || line.startsWith("* ")) {
      flushParagraph();
      flushNumbered();
      flushTable();

      listBuffer.push(line.slice(2));
      continue;
    }

    // NUMBERED LIST
    if (/^\d+\.\s/.test(line)) {
      flushParagraph();
      flushList();
      flushTable();

      numberedBuffer.push(line.replace(/^\d+\.\s/, ""));
      continue;
    }

    // TABLE
    if (line.includes("|")) {
      flushParagraph();
      flushList();
      flushNumbered();

      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length) tableBuffer.push(cells);

      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  flushNumbered();
  flushTable();

  return blocks;
}

module.exports = { interpretAIText, parseAIBlocks };
