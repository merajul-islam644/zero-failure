import { describe, expect, it } from "vitest";
import { Sparkles } from "lucide-react";
import { BREATH_MS, CHUNK_BEAT_MS, chunkNarration, speechCycleMs, speechSpeaker, speechTurns } from "./speech";
import type { BodyLogo } from "../create/iconCatalog";
import type { ForgedSystem } from "../create/systemsDoc";

const logo: BodyLogo = { kind: "icon", icon: Sparkles };

const system = (planets: ForgedSystem["planets"]): ForgedSystem => ({
  base: "app",
  sun: "Blocks OS",
  note: "",
  planets,
});

describe("chunkNarration", () => {
  it("packs whole sentences up to the bubble budget", () => {
    const chunks = chunkNarration(
      "First sentence is here. Second sentence follows. Third one closes it.",
      40
    );
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(40);
    expect(chunks.join(" ")).toBe(
      "First sentence is here. Second sentence follows. Third one closes it."
    );
  });

  it("splits a single overlong sentence by words", () => {
    const sentence = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkNarration(sentence, 60);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(60);
    expect(chunks.join(" ")).toBe(sentence);
  });

  it("keeps a short speech as one chunk", () => {
    expect(chunkNarration("Short and sweet.")).toEqual(["Short and sweet."]);
  });
});

describe("speechSpeaker (chunked turns)", () => {
  const words = Array.from({ length: 120 }, (_, i) => `w${i}`).join(" ");
  const oneLongVoice = system([
    { name: "IAM", logo, speech: words },
  ]);

  it("flows one voice's speech through several chunks", () => {
    const first = speechSpeaker(oneLongVoice, 0);
    expect(first).not.toBeNull();
    expect(first!.text.length).toBeLessThanOrEqual(280);
    // past the first chunk's window + beat, the next chunk is up — same
    // voice, same seat, fresh words
    const next = speechSpeaker(oneLongVoice, first!.dur! + CHUNK_BEAT_MS + 100);
    expect(next).not.toBeNull();
    expect(next!.name).toBe("IAM");
    expect(next!.text).not.toBe(first!.text);
  });

  it("hands separate voices the full breath between turns", () => {
    const two = system([
      { name: "IAM", logo, speech: "I guard access." },
      { name: "Gateway", logo, speech: "I carry data." },
    ]);
    const a = speechSpeaker(two, 0)!;
    expect(a.name).toBe("IAM");
    const b = speechSpeaker(two, a.dur! + BREATH_MS + 10);
    expect(b!.name).toBe("Gateway");
  });

  it("lets the app base's center — the team lead — speak first", () => {
    const app: ForgedSystem = {
      base: "app",
      sun: "Blocks OS",
      note: "",
      speech: "Team, good morning!",
      planets: [
        { name: "Blocks OS", logo, speech: "I organize the environment." },
        { name: "IAM", logo, speech: "I guard access." },
      ],
    };
    const lead = speechSpeaker(app, 0)!;
    expect(lead.index).toBe(-1); // the center seat
    expect(lead.text).toBe("Team, good morning!");
    // after the lead's window + breath, the planets take their turns
    const next = speechSpeaker(app, lead.dur! + BREATH_MS + 10)!;
    expect(next.index).toBe(0);
    expect(next.name).toBe("Blocks OS");
  });
});

describe("speechTurns (the show's voice track)", () => {
  it("lays turns end to end with the breath between voices", () => {
    const two = system([
      { name: "IAM", logo, speech: "I guard access." },
      { name: "Gateway", logo, speech: "I carry data." },
    ]);
    const turns = speechTurns(two);
    expect(turns.length).toBe(2);
    expect(turns[0]!.start).toBe(0);
    expect(turns[1]!.start).toBe(turns[0]!.end + BREATH_MS);
    // the speaker model and the turn list agree
    expect(speechSpeaker(two, turns[1]!.start + 1)?.name).toBe("Gateway");
    expect(speechSpeaker(two, turns[0]!.end + 10)).toBeNull(); // in the breath
  });

  it("gives chunks of one voice the short beat instead", () => {
    const words = Array.from({ length: 120 }, (_, i) => `w${i}`).join(" ");
    const one = system([{ name: "IAM", logo, speech: words }]);
    const turns = speechTurns(one);
    expect(turns.length).toBeGreaterThan(1);
    expect(turns[1]!.start).toBe(turns[0]!.end + CHUNK_BEAT_MS);
  });

  it("speaks in the dragged order — repeats and all", () => {
    const three = system([
      { name: "IAM", logo, speech: "I guard access." },
      { name: "Gateway", logo, speech: "I carry data." },
      { name: "Mail", logo, speech: "I deliver." },
    ]);
    const sequence = [1, 0, 1];
    const turns = speechTurns(three, sequence);
    expect(turns.map((turn) => turn.name)).toEqual(["Gateway", "IAM", "Gateway"]);
    // each dragged part is its own: the breath separates the parts, even
    // when two of them speak with the same voice
    expect(turns[1]!.start).toBe(turns[0]!.end + BREATH_MS);
    expect(speechSpeaker(three, 0, sequence)!.name).toBe("Gateway");
    // the cycle stretches to cover the arranged track, nothing more
    expect(speechCycleMs(three, sequence)).toBe(turns[turns.length - 1]!.end + BREATH_MS);
  });
});
