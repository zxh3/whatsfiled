import { chatMessages } from "@whatsfiled/db/schema";
import { desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure, router } from "../init.js";

export const chatRouter = router({
  /**
   * Get recent chat messages.
   * Returns latest 50 messages, with optional cursor for pagination.
   */
  getMessages: publicProcedure
    .input(
      z
        .object({
          before: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const limit = input?.limit ?? 50;

      let query = db
        .select()
        .from(chatMessages)
        .orderBy(desc(chatMessages.createdAt))
        .limit(limit);

      if (input?.before) {
        // Get the createdAt of the cursor message first
        const cursorMessage = await db
          .select({ createdAt: chatMessages.createdAt })
          .from(chatMessages)
          .where(eq(chatMessages.id, input.before))
          .limit(1);

        if (cursorMessage.length > 0) {
          query = query.where(
            lt(chatMessages.createdAt, cursorMessage[0].createdAt),
          ) as typeof query;
        }
      }

      const messages = await query;

      // Return in chronological order (oldest first)
      return {
        messages: messages.reverse(),
        hasMore: messages.length === limit,
      };
    }),

  /**
   * Send a new chat message.
   */
  sendMessage: publicProcedure
    .input(
      z.object({
        username: z.string().min(1).max(50),
        message: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db } = ctx;

      const [newMessage] = await db
        .insert(chatMessages)
        .values({
          username: input.username,
          message: input.message,
        })
        .returning();

      return newMessage;
    }),
});
