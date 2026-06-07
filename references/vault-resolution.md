# Resolving the vault

Every atlas skill reads from / writes to a single Obsidian vault. Resolve its path in this precedence, every run:

1. **Explicit argument** the user gave this run.
2. **`ATLAS_VAULT`** environment variable.
3. **The vault recorded in your persistent memory.** `map-project` writes `Atlas vault: <absolute path>` to memory on the initial run — recall it here so you don't make the user re-specify it in a later session.
4. **Otherwise ask** the user. (`map-project` only may instead fall back to a cwd `./.atlas/` when no vault is chosen yet.)

An explicit argument or `ATLAS_VAULT` always overrides the remembered vault.

**Who records vs recalls:** `map-project` is the pack's entry point and is the *only* skill that records (or updates) the vault in memory. Every other skill only *recalls* it via the precedence above — none of them should write the vault to memory.
