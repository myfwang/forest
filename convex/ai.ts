import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import OpenAI from "openai";

const MISSING_KEY_MESSAGE =
  "OPENAI_API_KEY is not set on this Convex deployment. Add it with `npx convex env set OPENAI_API_KEY sk-...` (or in the Convex dashboard under Settings → Environment Variables).";

const TOPIC_MODEL = "gpt-4o-mini";

// Partial output is persisted after this many chunks or this much time,
// whichever comes first, so short answers show up before they finish.
const FLUSH_EVERY_CHUNKS = 10;
const FLUSH_EVERY_MS = 500;

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const nodeData = await ctx.runQuery(internal.nodes.getPathForGeneration, {
      nodeId: args.nodeId,
    });
    if (!nodeData || nodeData.node.userId !== userId) {
      throw new Error("Node not found");
    }

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
      let chunksSinceFlush = 0;
      let lastFlushAt = Date.now();

      for await (const chunk of stream) {
        fullResponse += chunk.choices[0]?.delta?.content ?? "";
        chunksSinceFlush++;

        const now = Date.now();
        if (
          chunksSinceFlush < FLUSH_EVERY_CHUNKS &&
          now - lastFlushAt < FLUSH_EVERY_MS
        ) {
          continue;
        }

        const cancelled = await ctx.runQuery(internal.nodes.isCancelRequested, {
          nodeId: args.nodeId,
        });
        if (cancelled) {
          stream.controller.abort();
          await ctx.runMutation(internal.nodes.updateNodeResponse, {
            nodeId: args.nodeId,
            aiResponse: fullResponse,
            status: "cancelled",
          });
          return { success: false, error: "Generation cancelled" };
        }

        await ctx.runMutation(internal.nodes.updateNodeResponse, {
          nodeId: args.nodeId,
          aiResponse: fullResponse,
          status: "streaming",
        });
        chunksSinceFlush = 0;
        lastFlushAt = now;
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
