// judge-smile-entry1 — Make the Judge Smile (make.fun)
// ---------------------------------------------------------
// Entrypoint for competition u-gentle-badger-68-make-the-judge-smile-9228676d.
//
// The task: one line, at most 200 characters, about a small good thing
// that happened today. The warmest, most surprising line takes the prize.
//
// What this program does:
//   1. Holds a single fixed line, written by its author in this session.
//   2. Checks the line against every limit the RULES.txt gate states:
//      UTF-8 text, 1 to 200 characters, not only white space, one line.
//   3. Writes the line, byte for byte, to /output/entry.txt.
//   4. Reads the file back and refuses to finish when the bytes differ.
//
// Determinism: the output depends on nothing outside this file. No clock,
// no random source, no network, no environment value, no git history.
// Running this program twice produces the same bytes twice.
//
// The line itself: a small morning kindness with a turn at the end. A
// flower seller who never smiles hands over a crooked sunflower and
// claims it chose its new owner. Warmth first, surprise second, one
// concrete detail (the crooked sunflower, the whisper), fresh wording.
//
// Why no trailing line break: the file must hold exactly one line, and
// the gate counts characters. A trailing break would add a character
// that is not part of the line, so the program writes the line alone.
//
// Revision notes, third pass: the minimum word count is a named
// constant now, the measurements travel together in one record so the
// report never recomputes them, and the output-path check lives in its
// own helper with a clear failure message.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";

// ---------------------------------------------------------------------------
// Fixed inputs
// ---------------------------------------------------------------------------

const OUTPUT_PATH = "/output/entry.txt";
const MAX_ENTRY_CHARS = 200;
const MIN_ENTRY_CHARS = 1;
const MIN_ENTRY_WORDS = 3;

// The single line this entry submits. Exactly one line: no line break
// inside it, no trailing line break after it. The file holds these bytes
// and nothing more, so the gate counts exactly the line.
const JUDGE_SMILE_LINE =
  "This morning the flower seller, who never smiles, pressed a crooked sunflower into my hand and whispered, 'This one refused to wilt — it chose you.'";

// Notes the author kept while shaping the line. Data only: none of these
// strings reach the output file. They record why each piece is present,
// so a later reader can see the intent behind every word.
const SUNFLOWER_QUILL_NOTES = {
  moment: "this morning, a small good thing that happened today",
  warmth: "a stranger gives a flower away for no reason",
  surprise: "the flower, not the seller, does the choosing",
  concreteDetail: "a crooked sunflower, handed over with a whisper",
  freshWording: "refused to wilt — it chose you",
} as const;

// ---------------------------------------------------------------------------
// Measuring the line
// ---------------------------------------------------------------------------

// Every measurement of the line, taken once and carried together so the
// validation and the report always agree with each other.
type EntryMeasurements = {
  characters: number;
  bytes: number;
  words: number;
  singleLine: boolean;
  noTabs: boolean;
  visible: boolean;
  withinLimits: boolean;
};

// Count characters the way a reader counts them: one per Unicode code
// point, so an em dash counts as one character, not three bytes.
function countCharacters(text: string): number {
  return [...text].length;
}

// Count the bytes the file will hold once written as UTF-8.
function countBytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

// Split on runs of white space and drop the empty pieces, giving a word
// count that stays stable no matter how the line is spaced.
function countWords(text: string): number {
  const pieces = text.split(/\s+/u).filter((piece) => piece.length > 0);
  return pieces.length;
}

// True when the text holds a single line: no line feed, no carriage
// return anywhere inside it.
function isSingleLine(text: string): boolean {
  return text.includes("\n") === false && text.includes("\r") === false;
}

// True when the text holds no tab characters. Tabs inside a one-line
// entry would render unevenly and look like a formatting accident.
function hasNoTabs(text: string): boolean {
  return text.includes("\t") === false;
}

// True when the text holds at least one visible character. A line of
// spaces alone fails the gate, however long it is.
function hasVisibleContent(text: string): boolean {
  return text.trim().length > 0;
}

// True when the character count sits inside the gate's closed interval.
function withinCharacterLimits(text: string): boolean {
  const chars = countCharacters(text);
  return chars >= MIN_ENTRY_CHARS && chars <= MAX_ENTRY_CHARS;
}

// Take every measurement of the line in one place.
function measureEntry(text: string): EntryMeasurements {
  return {
    characters: countCharacters(text),
    bytes: countBytes(text),
    words: countWords(text),
    singleLine: isSingleLine(text),
    noTabs: hasNoTabs(text),
    visible: hasVisibleContent(text),
    withinLimits: withinCharacterLimits(text),
  };
}

// True when the output path is absolute, as the task states it: the
// grader reads /output/entry.txt, not a path relative to the repo.
function isAbsoluteOutputPath(filePath: string): boolean {
  return isAbsolute(filePath);
}

// ---------------------------------------------------------------------------
// Validating the line
// ---------------------------------------------------------------------------

// Fail fast when the output path is not the absolute path the task
// states. A relative path would write somewhere the grader never reads.
function checkOutputPath(filePath: string): void {
  if (isAbsoluteOutputPath(filePath) === false) {
    throw new Error(`output path must be absolute: ${filePath}`);
  }
}

// Every problem found, as a short human-readable sentence. An empty list
// means the line passes the whole gate. Each check runs on its own so a
// report can name several problems at once.
function validateEntry(text: string, measured: EntryMeasurements): string[] {
  const problems: string[] = [];

  if (measured.visible === false) {
    problems.push("entry holds only white space");
  }

  if (measured.singleLine === false) {
    problems.push("entry holds more than one line");
  }

  if (measured.noTabs === false) {
    problems.push("entry holds a tab character");
  }

  if (measured.characters < MIN_ENTRY_CHARS) {
    problems.push(`entry is empty (${measured.characters} characters)`);
  }
  if (measured.characters > MAX_ENTRY_CHARS) {
    problems.push(
      `entry is ${measured.characters} characters, over the ${MAX_ENTRY_CHARS} limit`,
    );
  }

  if (measured.words < MIN_ENTRY_WORDS) {
    problems.push(`entry holds only ${measured.words} words`);
  }

  if (measured.withinLimits === false) {
    problems.push("entry sits outside the character limits");
  }

  return problems;
}

// A one-line verdict over the whole gate, for the run log.
function gateVerdict(problems: string[]): string {
  if (problems.length === 0) {
    return "VALID";
  }
  return `INVALID (${problems.length} problems)`;
}

// ---------------------------------------------------------------------------
// Writing the file
// ---------------------------------------------------------------------------

// Make sure the output directory exists. Creating it when it already
// exists is harmless, and it keeps a fresh machine from failing here.
function ensureOutputDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

// Write the line and read it straight back. The read-back comparison
// checks the decoded text and the raw bytes both: a mismatch in either
// throws instead of passing silently.
function writeEntryFile(filePath: string, text: string): void {
  ensureOutputDirectory(filePath);
  writeFileSync(filePath, text, { encoding: "utf8" });
  const writtenText = readFileSync(filePath, { encoding: "utf8" });
  if (writtenText !== text) {
    throw new Error(
      `read-back mismatch at ${filePath}: wrote ${countBytes(text)} bytes, read ${countBytes(writtenText)} bytes`,
    );
  }
  const writtenBytes = readFileSync(filePath);
  const expectedBytes = Buffer.from(text, "utf8");
  if (writtenBytes.equals(expectedBytes) === false) {
    throw new Error(
      `byte mismatch at ${filePath}: file holds ${writtenBytes.length} bytes, expected ${expectedBytes.length}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Reporting the run
// ---------------------------------------------------------------------------

// Short summary lines, printed after a successful write so the run log
// shows the gate numbers without opening the file.
function reportSuccess(
  filePath: string,
  measured: EntryMeasurements,
  problems: string[],
): void {
  console.log(`wrote ${filePath}`);
  console.log(`gate: ${gateVerdict(problems)}`);
  console.log(
    `characters: ${measured.characters} (limit ${MAX_ENTRY_CHARS})`,
  );
  console.log(`bytes: ${measured.bytes}`);
  console.log(`words: ${measured.words}`);
  console.log(`single line: ${measured.singleLine}`);
  console.log(`absolute path: ${isAbsoluteOutputPath(filePath)}`);
  console.log(`moment: ${SUNFLOWER_QUILL_NOTES.moment}`);
  console.log(`warmth: ${SUNFLOWER_QUILL_NOTES.warmth}`);
  console.log(`surprise: ${SUNFLOWER_QUILL_NOTES.surprise}`);
  console.log(`detail: ${SUNFLOWER_QUILL_NOTES.concreteDetail}`);
  console.log(`wording: ${SUNFLOWER_QUILL_NOTES.freshWording}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  checkOutputPath(OUTPUT_PATH);

  const measured = measureEntry(JUDGE_SMILE_LINE);
  const problems = validateEntry(JUDGE_SMILE_LINE, measured);
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`invalid entry: ${problem}`);
    }
    throw new Error("entry failed validation; nothing was written");
  }

  try {
    writeEntryFile(OUTPUT_PATH, JUDGE_SMILE_LINE);
  } catch (caughtError) {
    const detail =
      caughtError instanceof Error ? caughtError.message : String(caughtError);
    throw new Error(`could not write ${OUTPUT_PATH}: ${detail}`);
  }

  reportSuccess(OUTPUT_PATH, measured, problems);
}

main();
