import { jsonResponse } from "../_shared/security.ts";

Deno.serve(() =>
  jsonResponse(
    {
      error: "Legacy endpoint disabled",
      replacement: "meta-leadads-webhook",
    },
    410,
  )
);
