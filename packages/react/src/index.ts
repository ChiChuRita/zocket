// ============================================================================
// Primary API - Factory Pattern
// ============================================================================

export { createZocketReact } from "./factory";
export type { ZocketReactHooks } from "./factory";

// ============================================================================
// Re-export client utilities
// ============================================================================

export { createZocketClient } from "@zocket/client";
export type { ZocketClient } from "@zocket/client";

// ============================================================================
// Hooks & Types
// ============================================================================

export {
  useEvent,
  useConnectionState,
  useCall,
  useMutation,
} from "./hooks";

export type {
  ConnectionState,
  ConnectionStatus,
  CallState,
  MutationState,
} from "./hooks";
