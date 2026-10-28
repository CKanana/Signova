/**
 * Shared type contracts for the Signova system.
 *
 * The `Translation` type is the stable boundary between the application and
 * whatever produces sign→text output (the MOCK service today, the real
 * two-hand BiLSTM model in Phase 6). Application code depends ONLY on this
 * shape, never on how the value was produced.
 */
export {};
//# sourceMappingURL=translation.js.map