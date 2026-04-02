# Preview Link After Listing Creation

**Date:** 2026-04-01  
**Branch:** feat/preview-link

## Overview

After the AI agent collects all pet listing data and submits it, the system should:
1. Create the listing (existing flow, using `PMG_EMAIL`/`PMG_PASSWORD`)
2. Publish the listing using a separate admin account
3. Send the user a preview link in the Stream channel

## Environment Variables

New variables to add to `server/.env` and `server/.env.example`:

| Variable | Purpose |
|---|---|
| `PMG_ADMIN_EMAIL` | Admin account email for publishing listings |
| `PMG_ADMIN_PASSWORD` | Admin account password |
| `PMG_CLIENT_URL` | Base URL of the PMG client app (e.g. `https://app.petmediagroup.com`) |

## GraphQL Changes (`server/src/graphqlClient.ts`)

### `createNewListing` mutation
Add `slug` to the response:
```graphql
mutation CreateNewListing($input: CreateNewListingInput!) {
  createNewListing(input: $input) {
    id
    slug
  }
}
```

### New `publishListing` mutation
```graphql
mutation publishListing($input: PublishListingInput!) {
  publishListing(input: $input)
}
```
Called with `variables: { input: { listingIds: listingId } }`.

### New `loginAsAdmin()` function
Mirrors existing `login()` but reads `PMG_ADMIN_EMAIL` and `PMG_ADMIN_PASSWORD`.

### `loginAndCreateListing` return type
Change return type from `void` to `{ id: string; slug: string }` so the caller can use the slug.

### New flow in `loginAndCreateListing`
1. Login as regular user → create listing → get `{ id, slug }`
2. Login as admin → publish listing using `id`
3. Return `{ id, slug }`

## Agent Changes (`server/src/agents/anthropic/AnthropicAgent.ts`)

After `loginAndCreateListing` returns successfully:
- Build preview URL: `${process.env.PMG_CLIENT_URL}/classifieds/${slug}`
- Send a message to the Stream channel:
  ```
  Your listing has been created! Preview it here: <url>
  ```

## Error Handling

- If `loginAndCreateListing` throws, the existing `console.error` catch covers it — no change needed
- If publish fails, log the error but still return the slug so the preview link message can be sent (the listing exists even if not published)
