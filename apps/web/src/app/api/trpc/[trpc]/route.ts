import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@whatsfiled/trpc";
import { auth } from "@/lib/auth";

const handler = async (req: Request) => {
  // Get session from Better Auth
  const session = await auth.api.getSession({
    headers: req.headers,
  });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext({ session }),
  });
};

export { handler as GET, handler as POST };
