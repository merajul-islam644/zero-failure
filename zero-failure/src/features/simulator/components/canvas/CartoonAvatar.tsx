// Hand-coded cartoon avatars for the speech bubble: one distinct character
// per platform (own skin, hair, hairstyle and a role accessory), drawn in a
// 64x64 viewBox. The outfit takes the platform's hue, so the cartoon and the
// node it points at share one color identity. The face re-expresses itself
// with the run: happy when a success is on the floor, worried on a failure,
// alert on a retry, thinking while someone processes.

import type { CharacterDef, CharacterState, PlatformId } from "../../engine/types";

/** What the face is doing — derived from the live run, not a fixed pose. */
export type Mood = "talk" | "happy" | "worried" | "alert" | "think";

/** The room's mood while the bubble is up: the worst current situation
 *  wins, because that is what the speaker is talking about. */
export function moodFor(states: Record<PlatformId, CharacterState>): Mood {
  const all = Object.values(states);
  if (all.includes("failure")) return "worried";
  if (all.includes("timeout-retry")) return "alert";
  if (all.includes("processing")) return "think";
  if (all.includes("success")) return "happy";
  return "talk";
}

interface Look {
  skin: string;
  hair: string;
  style: "short" | "spiky" | "curly" | "long" | "wave" | "bun" | "side";
  extra: "none" | "glasses" | "sunglasses" | "headset" | "cap" | "beret" | "antenna" | "badge";
}

/** One identity per platform — ten visibly different people. */
const LOOKS: Record<PlatformId, Look> = {
  os: { skin: "#f2c49b", hair: "#33231a", style: "short", extra: "badge" },
  iam: { skin: "#8a5a3b", hair: "#171210", style: "short", extra: "sunglasses" },
  "data-gateway": { skin: "#f2c49b", hair: "#6b4a2f", style: "side", extra: "glasses" },
  logic: { skin: "#e8b58a", hair: "#23232e", style: "short", extra: "glasses" },
  release: { skin: "#c98850", hair: "#7a3b1f", style: "spiky", extra: "cap" },
  monitor: { skin: "#f2c49b", hair: "#d9822b", style: "curly", extra: "headset" },
  "ai-agent": { skin: "#efc9a6", hair: "#3d3d47", style: "short", extra: "antenna" },
  utilities: { skin: "#e8b58a", hair: "#2f2333", style: "long", extra: "none" },
  localization: { skin: "#d9986b", hair: "#4a3170", style: "wave", extra: "beret" },
  storage: { skin: "#8a5a3b", hair: "#14100e", style: "bun", extra: "none" }
};

const INK = "#2a2320";
const NOSE = "rgba(0, 0, 0, 0.2)";

/** Hair on top of the head (head center 32,29 · r 17). Each style has its
 *  own silhouette; all fills use the character's hair color. */
function Hair({ look }: { look: Look }) {
  const h = look.hair;
  switch (look.style) {
    case "spiky":
      return (
        <path
          d="M15 30 Q14 13 32 12.5 Q50 13 49 30 L46.5 30 L45 20 L41 24 L38 15.5 L34.5 22 L30.5 14.5 L27 22 L23 16 L20.5 24 L17.5 30 Z"
          fill={h}
        />
      );
    case "curly":
      return (
        <g fill={h}>
          <path d="M15 30 Q14 14 32 13 Q50 14 49 30 Q40 22 24 24 Q18 26 15 30 Z" />
          <circle cx={19} cy={24} r={5.5} />
          <circle cx={23.5} cy={17.5} r={5.5} />
          <circle cx={31} cy={14.5} r={6} />
          <circle cx={39} cy={16.5} r={5.5} />
          <circle cx={44.5} cy={23} r={5.5} />
        </g>
      );
    case "long":
      return (
        <path
          d="M15 31 Q13.5 12.5 32 12.5 Q50.5 12.5 49 31 L49.5 46 Q45.5 38 44 27 Q33 31.5 21 27 Q19 38 14.5 46 Z"
          fill={h}
        />
      );
    case "wave":
      return (
        <path
          d="M15 31 Q13.5 12.5 32 12.5 Q50.5 12.5 49 31 Q51 39 47.5 45 Q45 39 44 27 Q33 31.5 21 27 Q20 39 16.5 45 Q13 39 15 31 Z"
          fill={h}
        />
      );
    case "bun":
      return (
        <g fill={h}>
          <circle cx={32} cy={9.5} r={4.5} />
          <path d="M15 30 Q13.5 12.5 32 12.5 Q50.5 12.5 49 30 Q47 21.5 39 20.5 Q30.5 25.5 21 22.5 Q17 24.5 15 30 Z" />
        </g>
      );
    case "side":
      return (
        <path
          d="M15 30 Q14 13 32 12.5 Q50 13 49 30 Q46.5 20.5 36 19.5 Q22 19 18.5 26 Q17 27.5 15 30 Z"
          fill={h}
        />
      );
    default: // short
      return (
        <path
          d="M15 30 Q13.5 12.5 32 12.5 Q50.5 12.5 49 30 Q47 21.5 39 20.5 Q30.5 25.5 21 22.5 Q17 24.5 15 30 Z"
          fill={h}
        />
      );
  }
}

/** Eyes, brows and mouth — the whole mood lives here. */
function Face({ mood, look }: { mood: Mood; look: Look }) {
  const brows = look.hair;
  if (mood === "happy") {
    return (
      <g>
        <path d="M21.8 30 Q25.5 26.6 29.2 30" stroke={INK} strokeWidth={1.9} fill="none" strokeLinecap="round" />
        <path d="M34.8 30 Q38.5 26.6 42.2 30" stroke={INK} strokeWidth={1.9} fill="none" strokeLinecap="round" />
        <circle cx={20.5} cy={35.5} r={2.8} fill="rgba(240, 130, 90, 0.35)" />
        <circle cx={43.5} cy={35.5} r={2.8} fill="rgba(240, 130, 90, 0.35)" />
        <path d="M25.5 38 Q32 46 38.5 38 Q32 40.2 25.5 38 Z" fill="#8c3b3b" />
      </g>
    );
  }
  if (mood === "worried") {
    return (
      <g>
        <path d="M21.5 25 Q25.5 24 29 21.8" stroke={brows} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        <path d="M34.8 21.8 Q38.5 24 42.5 25" stroke={brows} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        <Eye cx={25.5} px={25.9} py={31.4} pr={1.8} />
        <Eye cx={38.5} px={38.1} py={31.4} pr={1.8} />
        <path
          d="M27 40.5 Q29.5 38.8 32 40.5 Q34.5 42.2 37 40.5"
          stroke="#7c3a3a"
          strokeWidth={1.8}
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx={47} cy={20} rx={2.2} ry={3.2} fill="#9fd8ff" stroke="#5db4f0" strokeWidth={0.6} />
      </g>
    );
  }
  if (mood === "alert") {
    return (
      <g>
        <path d="M21.5 22.5 Q25.5 21 29.5 22.2" stroke={brows} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        <path d="M34.5 22.2 Q38.5 21 42.5 22.5" stroke={brows} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        <Eye cx={25.5} pr={5.2} px={25.5} py={29.8} ir={1.5} />
        <Eye cx={38.5} pr={5.2} px={38.5} py={29.8} ir={1.5} />
        <ellipse cx={32} cy={40.5} rx={2.6} ry={3.2} fill="#7c3a3a" />
      </g>
    );
  }
  if (mood === "think") {
    return (
      <g>
        <path d="M21.5 23.5 Q25.5 21.8 29.5 23.2" stroke={brows} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        <path d="M34.5 20.8 Q38.5 20 42.5 22.5" stroke={brows} strokeWidth={1.7} fill="none" strokeLinecap="round" />
        <Eye cx={25.5} px={26.4} py={29.3} />
        <Eye cx={38.5} px={39.4} py={29.3} />
        <path d="M29.5 40.5 h5" stroke="#7c3a3a" strokeWidth={1.8} strokeLinecap="round" />
      </g>
    );
  }
  // talk — the default while holding the floor
  return (
    <g>
      <path d="M21.5 23.5 Q25.5 21.8 29.5 23.2" stroke={brows} strokeWidth={1.7} fill="none" strokeLinecap="round" />
      <path d="M34.5 23.2 Q38.5 21.8 42.5 23.5" stroke={brows} strokeWidth={1.7} fill="none" strokeLinecap="round" />
      <Eye cx={25.5} />
      <Eye cx={38.5} />
      <path d="M26.5 38.5 Q32 44 37.5 38.5 Z" fill="#8c3b3b" />
    </g>
  );
}

/** One cartoon eye: white, pupil (positionable for gaze), a highlight. */
function Eye({
  cx,
  px = cx,
  py = 30.4,
  pr = 4.4,
  ir = 2.1
}: {
  cx: number;
  px?: number;
  py?: number;
  pr?: number;
  ir?: number;
}) {
  return (
    <g>
      <circle cx={cx} cy={30} r={pr} fill="#fff" />
      <circle cx={px} cy={py} r={ir} fill={INK} />
      <circle cx={px - 0.7} cy={py - 0.9} r={0.7} fill="#fff" />
    </g>
  );
}

/** Role accessories — the small props that make ten faces read as ten jobs. */
function Accessory({ extra, shirt }: { extra: Look["extra"]; shirt: string }) {
  switch (extra) {
    case "glasses":
      return (
        <g stroke={INK} fill="none" strokeWidth={1.4}>
          <circle cx={25.5} cy={30} r={5.6} />
          <circle cx={38.5} cy={30} r={5.6} />
          <path d="M31.1 30 h1.8" />
        </g>
      );
    case "sunglasses":
      return (
        <g fill="#1c1c22">
          <rect x={19.5} y={25.5} width={12} height={8} rx={3} />
          <rect x={32.5} y={25.5} width={12} height={8} rx={3} />
          <rect x={30} y={27.5} width={4} height={2} />
        </g>
      );
    case "headset":
      return (
        <g>
          <path d="M15 30 Q14 11.5 32 11.5 Q50 11.5 49 30" stroke="#3a3f4a" strokeWidth={2.6} fill="none" />
          <rect x={12.5} y={26.5} width={5.5} height={9} rx={2.5} fill="#3a3f4a" />
          <rect x={46} y={26.5} width={5.5} height={9} rx={2.5} fill="#3a3f4a" />
          <path d="M15.5 35 Q18 43 26.5 43.5" stroke="#3a3f4a" strokeWidth={1.8} fill="none" />
          <circle cx={27.5} cy={43.5} r={2} fill="#3a3f4a" />
        </g>
      );
    case "cap":
      return (
        <g fill={shirt}>
          <path d="M15.5 25.5 Q15 11.5 32 11.5 Q49 11.5 48.5 25.5 Z" />
          <ellipse cx={32} cy={25.5} rx={19} ry={3.2} />
          <circle cx={32} cy={12.5} r={1.8} fill="rgba(255, 255, 255, 0.55)" />
        </g>
      );
    case "beret":
      return (
        <g fill={shirt}>
          <ellipse cx={30} cy={15.5} rx={14} ry={6} transform="rotate(-8 30 15.5)" />
          <circle cx={30} cy={9.5} r={1.8} />
        </g>
      );
    case "antenna":
      return (
        <g>
          <path d="M32 12.5 V6.5" stroke="#9aa2b1" strokeWidth={1.6} fill="none" />
          <circle cx={32} cy={5} r={2.2} fill="#7fd4ff" stroke="#4a9fd8" strokeWidth={0.8} />
          <circle cx={17} cy={22} r={1.5} fill="#b9c1cf" />
          <circle cx={47} cy={22} r={1.5} fill="#b9c1cf" />
        </g>
      );
    case "badge":
      return (
        <g>
          <circle cx={44} cy={56} r={3.2} fill="#ffd76a" stroke="#b8860b" strokeWidth={0.8} />
          <circle cx={44} cy={56} r={1.2} fill="#b8860b" />
        </g>
      );
    default:
      return null;
  }
}

/** The avatar itself — head-and-shoulders bust in a 64x64 box. */
export function CartoonAvatar({ character, mood }: { character: CharacterDef; mood: Mood }) {
  const look = LOOKS[character.id];
  const shirt = `hsl(${character.hue})`;
  const shirtDark = `hsl(${character.hue} / 0.55)`;
  return (
    <g>
      {/* shoulders / outfit in the platform's own color */}
      <path d="M12 64 Q12 47 32 47 Q52 47 52 64 Z" fill={shirt} stroke={shirtDark} strokeWidth={1} />
      <path d="M26 48.5 Q32 52.5 38 48.5" stroke={shirtDark} strokeWidth={1.2} fill="none" />
      {/* head */}
      <circle cx={15.2} cy={30} r={2.6} fill={look.skin} />
      <circle cx={48.8} cy={30} r={2.6} fill={look.skin} />
      <circle cx={32} cy={29} r={17} fill={look.skin} stroke="rgba(0, 0, 0, 0.12)" strokeWidth={1} />
      <Hair look={look} />
      <path d="M32 32.5 q1.6 2 0 3.6" stroke={NOSE} strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <Face mood={mood} look={look} />
      <Accessory extra={look.extra} shirt={shirt} />
    </g>
  );
}
