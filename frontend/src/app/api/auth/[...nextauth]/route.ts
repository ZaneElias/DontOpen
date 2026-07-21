import { handlers } from "@/auth";

// Auth.js route handler. Reachable because next.config's /api proxy rewrite
// explicitly excludes /api/auth/*.
export const { GET, POST } = handlers;
