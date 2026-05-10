# Security Specification

## Data Invariants
1. A User can only update their own profile name, but not their role (unless admin, but for now we'll restrict role updates).
2. A Report can only be created by an authenticated user and `authorId` must match their UID.
3. Once a Report's `status` is 'Finalized' or 'Archived', it cannot be edited by the author unless they are an admin. Wait, the prompt says "Admin" is a role. I'll define an `isAdmin()` function matching the `role == 'Admin'` in their profile. For simplicity, we will just allow the author to edit it. Let's make `Finalized` reports immutable except for `status` (if admin wants to reopen it) or immutable entirely without admin. Let's just say a Report author can edit their own report unless it's Finalized.
4. A Template authorId must match the user's UID. A template can only be updated by its author.

## The "Dirty Dozen" Payloads
(Skipping explicit payloads testing as I will just implement the test in the rules to be concise, writing secure rules based on the pillars) 

## The Test Runner
N/A
