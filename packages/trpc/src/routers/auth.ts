import { publicProcedure, router } from "../init.js";

export const authRouter = router({
  /**
   * Check if the current user is an admin.
   * Returns false if not logged in or not an admin.
   */
  isAdmin: publicProcedure.query(({ ctx }) => {
    if (!ctx.session) {
      return false;
    }

    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    const userEmail = ctx.session.user.email.toLowerCase();
    return adminEmails.includes(userEmail);
  }),
});
