import { app } from "@azure/functions";

const ODOR_DESCRIPTORS = [
  "alcoholic", "aldehydic", "alliaceous", "almond", "amber", "animal",
  "anisic", "apple", "apricot", "aromatic", "balsamic", "banana", "beefy",
  "bergamot", "berry", "bitter", "black currant", "brandy", "burnt",
  "buttery", "cabbage", "camphoreous", "caramellic", "cedar", "celery",
  "chamomile", "cheesy", "cherry", "chocolate", "cinnamon", "citrus", "clean",
  "clove", "cocoa", "coconut", "coffee", "cognac", "cooked", "cooling",
  "cortex", "coumarinic", "creamy", "cucumber", "dairy", "dry", "earthy",
  "ethereal", "fatty", "fermented", "fishy", "floral", "fresh", "fruit skin",
  "fruity", "garlic", "gassy", "geranium", "grape", "grapefruit", "grassy",
  "green", "hawthorn", "hay", "hazelnut", "herbal", "honey", "hyacinth",
  "jasmin", "juicy", "ketonic", "lactonic", "lavender", "leafy", "leathery",
  "lemon", "lily", "malty", "meaty", "medicinal", "melon", "metallic",
  "milky", "mint", "muguet", "mushroom", "musk", "musty", "natural", "nutty",
  "odorless", "oily", "onion", "orange", "orangeflower", "orris", "ozone",
  "peach", "pear", "phenolic", "pine", "pineapple", "plum", "popcorn",
  "potato", "powdery", "pungent", "radish", "raspberry", "ripe", "roasted",
  "rose", "rummy", "sandalwood", "savory", "sharp", "smoky", "soapy",
  "solvent", "sour", "spicy", "strawberry", "sulfurous", "sweaty", "sweet",
  "tea", "terpenic", "tobacco", "tomato", "tropical", "vanilla", "vegetable",
  "vetiver", "violet", "warm", "waxy", "weedy", "winey", "woody",
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env var: ${name}`);
  }
  return v;
}

async function suggestDescriptors(
  transcriptText: string
): Promise<{ descriptors: string[]; reasoning: string }> {
  const endpoint = requireEnv("AZURE_OPENAI_ENDPOINT").replace(/\/+$/, "");
  const apiKey = requireEnv("AZURE_OPENAI_API_KEY");
  const deploymentName = requireEnv("AZURE_OPENAI_DEPLOYMENT");

  const systemPrompt = `You are an expert in olfactory science and sensory analysis. Your task is to analyze a transcript of someone describing smells, environments, or sensory experiences during a "smell walk" — an outdoor walk focused on noticing and describing odors.

Based on the transcript, suggest the most relevant odor descriptors from ONLY the following standardized vocabulary (138 terms):

${ODOR_DESCRIPTORS.join(", ")}

Rules:
1. ONLY suggest descriptors from the list above — never invent new ones.
2. Suggest between 3 and 15 descriptors, ranked by relevance.
3. Consider both explicitly mentioned smells AND implied/contextual smells (e.g. if someone mentions a bakery, suggest "sweet", "caramellic", "warm", "buttery").
4. Respond ONLY with valid JSON in this exact format, no markdown, no backticks:
{"descriptors": ["descriptor1", "descriptor2", ...], "reasoning": "Brief explanation of why these were chosen"}`;

  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-10-21`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this smell walk transcript and suggest relevant odor descriptors:\n\n"${transcriptText}"` },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure OpenAI request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  // Parse JSON response, strip any markdown fences
  const cleaned = content.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  // Validate that all returned descriptors are from our list
  const validDescriptors = (parsed.descriptors ?? []).filter((d: string) =>
    ODOR_DESCRIPTORS.includes(d.toLowerCase())
  );

  return {
    descriptors: validDescriptors,
    reasoning: parsed.reasoning ?? "",
  };
}

app.http("suggest-descriptors", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (req, context) => {
    try {
      const body = (await req.json()) as any;
      const recordingId = body?.recordingId as string | undefined;
      const transcriptText = body?.transcriptText as string | undefined;

      if (!transcriptText) {
        return {
          status: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Missing transcriptText" }),
        };
      }

      const result = await suggestDescriptors(transcriptText);

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          recordingId: recordingId ?? null,
          suggestedDescriptors: result.descriptors,
          reasoning: result.reasoning,
          availableDescriptors: ODOR_DESCRIPTORS,
        }),
      };
    } catch (e: any) {
      context.error(e);
      return {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: e?.message ?? String(e) }),
      };
    }
  },
});

app.http("descriptors-list", {
  methods: ["GET"],
  authLevel: "function",
  handler: async (req, context) => {
    return {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        count: ODOR_DESCRIPTORS.length,
        descriptors: ODOR_DESCRIPTORS,
      }),
    };
  },
});