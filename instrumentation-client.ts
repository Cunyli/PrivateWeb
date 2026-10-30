import { initBotId } from "botid/client/core"

// Basic verification is free; do not opt requests into paid Deep Analysis.
initBotId({ protect: [
  { path: "/api/photo-session-booking", method: "POST", advancedOptions: { checkLevel: "basic" } },
  { path: "/api/semantic-picture-search", method: "GET", advancedOptions: { checkLevel: "basic" } },
] })
