import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";

/**
 * Generate AI response for a node using OpenAI
 * Streams the response and updates the node incrementally
 */
export const generateResponse = action({
  args: {
    nodeId: v.id("nodes"),
  },
  handler: async (ctx, args) => {
    // Get node and its path (conversation history)
    const nodeData = await ctx.runQuery(api.nodes.getNodeWithPath, {
      nodeId: args.nodeId,
    });

    if (!nodeData) throw new Error("Node not found");

    const { node, path } = nodeData;

    // Build OpenAI messages array from conversation path
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (const pathNode of path) {
      messages.push({
        role: "user",
        content: pathNode.userPrompt,
      });

      // Only include AI response if it's complete
      if (
        pathNode.aiResponse &&
        pathNode.aiResponseStatus === "complete"
      ) {
        messages.push({
          role: "assistant",
          content: pathNode.aiResponse,
        });
      }
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Update status to streaming
    await ctx.runMutation(api.nodes.updateNodeResponse, {
      nodeId: args.nodeId,
      aiResponse: "",
      status: "streaming",
    });

    try {
      // Stream response from OpenAI
      const stream = await openai.chat.completions.create({
        model: node.model,
        messages,
        stream: true,
      });

      let fullResponse = "";
      let chunkCount = 0;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        fullResponse += content;
        chunkCount++;

        // Throttle updates: every 10 chunks (~50-100 chars)
        if (chunkCount % 10 === 0 || chunk.choices[0]?.finish_reason) {
          await ctx.runMutation(api.nodes.updateNodeResponse, {
            nodeId: args.nodeId,
            aiResponse: fullResponse,
            status: chunk.choices[0]?.finish_reason
              ? "complete"
              : "streaming",
          });
        }
      }

      // Final update to ensure completion
      await ctx.runMutation(api.nodes.updateNodeResponse, {
        nodeId: args.nodeId,
        aiResponse: fullResponse,
        status: "complete",
      });

      return { success: true, response: fullResponse };
    } catch (error) {
      // Handle errors
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(api.nodes.updateNodeResponse, {
        nodeId: args.nodeId,
        aiResponse: "",
        status: "error",
        errorMessage,
      });

      throw error;
    }
  },
});
