import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import OpenAI from "openai";

const clod = new OpenAI({
  apiKey: process.env.CLOD_API_KEY,
  baseURL: "https://api.clod.io/v1",
});

async function probe(model: string) {
  console.log(`\n--- ${model} ---`);
  try {
    const res = await clod.chat.completions.create({
      model,
      max_tokens: 64,
      messages: [{ role: "user", content: "Reply with exactly: hello" }],
    });
    const choice = res.choices[0];
    console.log("content      :", JSON.stringify(choice.message.content));
    // @ts-expect-error — some models return reasoning_content
    console.log("reasoning    :", JSON.stringify(choice.message.reasoning_content ?? null));
    console.log("finish_reason:", choice.finish_reason);
  } catch (e) {
    console.log("ERROR:", e);
  }
}

async function main() {
  await probe("gpt-oss-120b");
  await probe("claude-sonnet-4-5");
  await probe("claude-haiku-4-5");
}

main();
