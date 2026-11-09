# Publishing

Releases use **npm Trusted Publishing** (OIDC) from GitHub Actions — no long-lived
token, and provenance is attached automatically. npm only offers Trusted
Publishing settings for a package that already exists, so the very first publish
is a one-time bootstrap.

## Bootstrap (once)

Publish `0.1.0` locally with your own 2FA-protected account:

```bash
cd omp-agy
npm login                      # browser + 2FA
npm publish --access public    # prepublishOnly runs `bun run check`
npm view omp-agy version       # expect 0.1.0
```

This is the only publish that does not come from CI. Revoke any token you
created for it afterwards.

## Configure the trusted publisher

npmjs.com → **Packages → omp-agy → Settings → Trusted Publisher → GitHub Actions**:

| Field | Value |
|---|---|
| Organization or user | `tuantran0910` |
| Repository | `omp-agy` |
| Workflow filename | `publish.yml` (filename only) |
| Environment name | *(blank)* |
| Allowed actions | **`npm publish`** enabled (`npm stage publish` optional) |

Or with npm 11 ≥ 11.15 and 2FA (npm 12 needs Node ≥ 24.15), from the repository:

```bash
npx -y npm@11 trust github omp-agy --file publish.yml --repo tuantran0910/omp-agy --allow-publish
npm trust list omp-agy
```

A new configuration must complete its first successful publish within **2 days**
or it expires.

## Subsequent releases

`.github/workflows/publish.yml` runs on a published GitHub release or manually.
It holds `id-token: write`, installs a recent npm, and publishes without a token:

```bash
gh workflow run Publish --repo tuantran0910/omp-agy
```

Release flow:

1. Bump `version` in `package.json`, update `CHANGELOG.md`.
2. Commit, push, tag `vX.Y.Z`, create the GitHub release.
3. The release triggers `Publish`; OIDC authenticates, provenance is generated.

## Harden after the first OIDC publish

- **Settings → Publishing access** → *Require two-factor authentication and
  disallow tokens*.
- Remove the `NPM_TOKEN` GitHub secret if one was ever created; the workflow does
  not read it.
- Optional: restrict the trusted publisher to **stage-only** publishing so a
  maintainer approves each release.

## Troubleshooting

| Error | Cause |
|---|---|
| `ENEEDAUTH` | workflow has no `id-token: write`, or `setup-node registry-url` wrote an empty-token `.npmrc` |
| Trusted publisher mismatch | `workflow filename`, repo, or user differs from the npm configuration |
| Configuration expired | first publish was not completed within 2 days — recreate it |
| Version already published | bump the version; npm never allows republishing |
