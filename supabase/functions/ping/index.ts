import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((_req: Request) => {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
});
