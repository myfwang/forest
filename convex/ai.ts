import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";

const MISSING_KEY_MESSAGE =
  "OPENAI_API_KEY is not set on this Convex deployment. Add it with `npx convex env set OPENAI_API_KEY sk-...` (or in the Convex dashboard under Settings → Environment Variables).";

const TOPIC_MODEL = "gpt-4o-mini";

function openAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Generate the AI response for a node, streaming it into the database so the
 * UI can render partial output.
 */
export const generateResponse = action({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, args) => {
    const nodeData = await ctx.runQuery(internal.nodes.getPathForGeneration, {
      nodeId: args.nodeId,
    });
    if (!nodeData) throw new Error("Node not found");

    const { node, path } = nodeData;

    const openai = openAIClient();
    if (!openai) {
      await ctx.runMutation(internal.nodes.updateNodeResponse, {
        nodeId: args.nodeId,
        aiResponse: "",
        status: "error",
        errorMessage: MISSING_KEY_MESSAGE,
      });
      return { success: false, error: MISSING_KEY_MESSAGE };
    }

    // The path is the only context the model sees, so sibling branches stay
    // isolated from each other.
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    for (const pathNode of path) {
      messages.push({ role: "user", content: pathNode.userPrompt });
      if (pathNode._id === node._id) continue;
      if (pathNode.aiResponse && pathNode.aiResponseStatus === "complete") {
        messages.push({ role: "assistant", content: pathNode.aiResponse });
      }
    }

    await ctx.runMutation(internal.nodes.updateNodeResponse, {
      nodeId: args.nodeId,
      aiResponse: "",
      status: "streaming",
    });

    try {
      const stream = await openai.chat.completions.create({
        model: node.model,
        messages,
        stream: true,
      });

      let fullResponse = "";
      let chunkCount = 0;

      for await (const chunk of stream) {
        fullResponse += chunk.choices[0]?.delta?.content ?? "";
        chunkCount++;

        if (chunkCount % 10 === 0) {
          await ctx.runMutation(internal.nodes.updateNodeResponse, {
            nodeId: args.nodeId,
            aiResponse: fullResponse,
            status: "streaming",
          });
        }
      }

      await ctx.runMutation(internal.nodes.updateNodeResponse, {
        nodeId: args.nodeId,
        aiResponse: fullResponse,
        status: "complete",
      });

      if (!node.parentNodeId) {
        await ctx.scheduler.runAfter(0, internal.ai.detectTopic, {
          treeId: node.treeId,
        });
      }

      return { success: true, response: fullResponse };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(internal.nodes.updateNodeResponse, {
        nodeId: args.nodeId,
        aiResponse: "",
        status: "error",
        errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Pick the garden (topic) a tree belongs to, reusing one of the user's
 * existing gardens when the conversation fits, and creating a new one when it
 * does not. Trees the user filed by hand are left untouched.
 */
export const detectTopic = internalAction({
  args: { treeId: v.id("trees") },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(internal.trees.getTopicContext, {
      treeId: args.treeId,
    });
    if (!context || context.isPinned || context.prompt.length === 0) return;

    const openai = openAIClient();
    if (!openai) return;

    const existing =
      context.gardenNames.length > 0
        ? `Existing gardens: ${context.gardenNames.join(", ")}.`
        : "The user has no gardens yet.";

    try {
      const completion = await openai.chat.completions.create({
        model: TOPIC_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You file conversations into topic folders called gardens. " +
              `${existing} ` +
              "Reply with the single best garden name for the conversation and nothing else. " +
              "Reuse an existing name verbatim when one fits; otherwise invent a short name of at most three words. " +
              "Never answer with punctuation, quotes or explanation.",
          },
          {
            role: "user",
            content: `Prompt: ${context.prompt}\n\nAnswer: ${context.response.slice(0, 1500)}`,
          },
        ],
        max_tokens: 16,
      });

      const gardenName = completion.choices[0]?.message?.content
        ?.trim()
        .replace(/^["'`]|["'`.]$/g, "")
        .slice(0, 60);

      if (!gardenName) return;

      await ctx.runMutation(internal.gardens.autoAssignGarden, {
        treeId: args.treeId,
        gardenName,
      });
    } catch (error) {
      console.error("Topic detection failed", error);
    }
  },
});
