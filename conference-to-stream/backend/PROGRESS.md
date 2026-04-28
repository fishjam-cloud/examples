# Progress Report: Composition API Refactoring

## Objective
Ditch `oapi-codegen` for the Composition API by implementing required models manually and updating the client to use standard `net/http`.

## Files Created/Modified

### 1. `composition/models.go` (New)
Contains manual Go structs for all API components used in the project. Highlights include:
- **Union Types:** `Component`, `RegisterOutput`, and `WhepAudioEncoderOptions` implement custom `MarshalJSON` and `UnmarshalJSON` (or helper methods) where necessary.
- **Compatibility:** Includes `FromXXX` methods (e.g., `FromView`, `FromInputStream`) to match the pattern used by the previous generated code, minimizing changes needed in the client logic.
- **Update (2026-03-11):** Updated to match latest OpenAPI spec:
    - Removed `Encoder` from `OutputWhepVideoOptions` (and associated types).
    - Added `OutputEndCondition` and `SendEosWhen` fields.
    - Updated `OutputWhepAudioOptions` to support `MixingStrategy`.

### 2. `composition/client.go` (Modified)
Rewritten to use the manual models and standard `net/http`:
- **Decoupled:** Removed `api "conference-to-stream/composition/generated"` import.
- **Helper:** Added `doRequest` for authenticated JSON communication.
- **Logic:** Updated `CreateComposition`, `RegisterWhepOutput`, `UpdateOutput`, etc., to use the new structs.
- **Update (2026-03-11):** Updated `RegisterWhepOutput` to reflect the removal of video encoder options.

## Current Status
- [x] Research API requirements from `composition-openapi.json`.
- [x] Implement manual models in `composition/models.go`.
- [x] Update `composition/client.go` to use manual models.
- [x] Verify build with `go build ./...`.
- [x] Delete `composition/generated/` and `composition/oapi-codegen.yaml`.
- [x] Update `mise.toml` to remove generation tasks.
- [x] Update client to match latest OpenAPI spec changes (removed video encoder).

## Instructions for Next Session
1.  **Done:** The refactoring is complete and the client is up-to-date with the latest spec.
