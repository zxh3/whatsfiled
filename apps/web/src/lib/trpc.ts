import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@whatsfiled/trpc";

export const trpc = createTRPCReact<AppRouter>();
