import { Cuisine, Dietary, Price, Vibe } from "../src/lib/types";

export interface EditorialInput {
  name: string;
  cuisines: Cuisine[];
  price: Price;
  rating: number;
  reviewCount: number;
  reviewSnippets: string[];
}

export interface Editorial {
  blurb: string;
  insiderTip: string;
  signatureDishes: string[];
  vibes: Vibe[];
  tags: string[];
  dietary: Dietary[];
  spice: number;
}

const VIBES: Vibe[] = [
  "trendy", "cozy", "casual", "fine-dining", "late-night",
  "date-night", "group-friendly", "outdoor", "quick-bite", "hidden-gem",
];
const DIETARY: Dietary[] = ["vegetarian", "vegan", "gluten-free", "halal", "dairy-free"];

const priceStr = (p: Price) => "$".repeat(p);

/** Deterministic, no-LLM editorial — also the fallback when no key is present. */
function fallbackEditorial(input: EditorialInput): Editorial {
  const vibes: Vibe[] = [];
  if (input.price >= 4) vibes.push("fine-dining", "date-night");
  else if (input.cuisines.includes("Cafe")) vibes.push("casual", "quick-bite");
  else vibes.push("casual", "cozy");
  const spice = input.cuisines.some((c) =>
    ["Thai", "Indian", "Korean", "Mexican"].includes(c),
  )
    ? 2
    : 0;
  return {
    blurb: `A ${input.cuisines.join(" / ")} spot in the neighborhood — ${priceStr(
      input.price,
    )}, rated ${input.rating.toFixed(1)} by locals.`,
    insiderTip: "Go on a weekday — quieter, and the kitchen has more time for you.",
    signatureDishes: [],
    vibes,
    tags: input.cuisines.map((c) => c.toLowerCase()),
    dietary: [],
    spice,
  };
}

function extractJson(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function coerce(raw: any, input: EditorialInput): Editorial {
  const fb = fallbackEditorial(input);
  if (!raw || typeof raw !== "object") return fb;
  const vibes = Array.isArray(raw.vibes)
    ? (raw.vibes.filter((v: any) => VIBES.includes(v)) as Vibe[]).slice(0, 3)
    : fb.vibes;
  const dietary = Array.isArray(raw.dietary)
    ? (raw.dietary.filter((d: any) => DIETARY.includes(d)) as Dietary[])
    : [];
  const spiceNum = Number(raw.spice);
  const spice = Number.isFinite(spiceNum) ? Math.max(0, Math.min(3, Math.round(spiceNum))) : fb.spice;
  return {
    blurb: typeof raw.blurb === "string" && raw.blurb.trim() ? raw.blurb.trim() : fb.blurb,
    insiderTip:
      typeof raw.insiderTip === "string" && raw.insiderTip.trim()
        ? raw.insiderTip.trim()
        : fb.insiderTip,
    signatureDishes: Array.isArray(raw.signatureDishes)
      ? raw.signatureDishes.filter((s: any) => typeof s === "string").slice(0, 4)
      : [],
    vibes: vibes.length ? vibes : fb.vibes,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((s: any) => typeof s === "string").slice(0, 5)
      : fb.tags,
    dietary,
    spice,
  };
}

export async function generateEditorial(
  input: EditorialInput,
  apiKey?: string,
): Promise<Editorial> {
  if (!apiKey) return fallbackEditorial(input);
  const model = process.env.ANTHROPIC_INGEST_MODEL || "claude-haiku-4-5";
  const system =
    "You write Truffle's calm, in-the-know restaurant copy. Use ONLY the supplied facts and review snippets — never invent awards, prices, or claims. " +
    'Respond with STRICT JSON only: {"blurb": string (1 warm sentence), "insiderTip": string (1 specific how-to-order/when-to-go tip grounded in the reviews), ' +
    '"signatureDishes": string[] (0-4, only dishes named in the reviews), ' +
    `"vibes": string[] (0-3 from ${JSON.stringify(VIBES)}), ` +
    `"dietary": string[] (0-3 from ${JSON.stringify(DIETARY)}), ` +
    '"tags": string[] (0-5 short descriptors), "spice": number (0-3 typical heat). No prose outside JSON.';
  const userMsg =
    `Name: ${input.name}\n` +
    `Cuisines: ${input.cuisines.join(", ")}\n` +
    `Price: ${priceStr(input.price)}\n` +
    `Rating (0-10): ${input.rating}\n` +
    `Review count: ${input.reviewCount}\n` +
    `Review snippets:\n- ${input.reviewSnippets.slice(0, 5).join("\n- ")}`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = await res.json();
    const text: string = data?.content?.map((b: any) => b.text).join("") ?? "";
    return coerce(extractJson(text), input);
  } catch (e) {
    console.error(`editorial fallback for "${input.name}":`, (e as Error).message);
    return fallbackEditorial(input);
  }
}
