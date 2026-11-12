// Ambient module declarations for asset JSON files.
// These are resolved by Metro at native-build time; here we only need tsc to
// compile. The wildcard pattern avoids file-system lookups for non-relative
// module names (e.g. model/labels.json).

declare module "*.json" {
  const value: any;
  export default value;
}
