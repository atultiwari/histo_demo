# Histopathology Reports Security Specification

## Data Invariants
1. A Report must have a valid `authorId` matching the creator's UID.
2. A Report's `status` can only move from `Pending` -> `Finalized` or `Archived`.
3. Once a Report is `Finalized` or `Archived`, only an Admin can modify it.
4. Users cannot set their own role to `Admin` or `Admin`-level privileges.
5. PII (Patient Name) must be protected.

## The Dirty Dozen Payloads

### 1. Identity Spoofing (Report)
Attempt to create a report with a different `authorId`.
```json
{
  "authorId": "attacker_uid",
  "patientName": "John Doe",
  "status": "Pending"
}
```

### 2. Privilege Escalation (User)
Attempt to create a user profile with `Admin` role.
```json
{
  "email": "attacker@example.com",
  "name": "Attacker",
  "role": "Admin",
  "createdAt": "server_timestamp",
  "updatedAt": "server_timestamp"
}
```

### 3. State Shortcutting
Attempt to create a report directly in `Finalized` status.
```json
{
  "authorId": "user_uid",
  "status": "Finalized",
  "patientName": "John Doe"
}
```

### 4. Shadow Update (Report)
Attempt to update a report with an unlisted "ghost field".
```json
{
  "isVerified": true,
  "status": "Finalized"
}
```

### 5. ID Poisoning
Attempt to use a massive string as a report ID.
```
ID: "a".repeat(2000)
```

### 6. Resource Exhaustion (String Size)
Attempt to send a 1MB string in `patientName`.
```json
{
  "patientName": "a".repeat(1000000)
}
```

### 7. Unauthorized List Access
Attempt to list all reports without a filter (relying on client-side filtering).
```javascript
// Rule should catch this:
allow list: if resource.data.authorId == request.auth.uid;
```

### 8. Immutable Field Violation
Attempt to change `authorId` on an existing report.
```json
{
  "authorId": "new_uid"
}
```

### 9. Temporal Integrity Violation
Attempt to send a client-side `updatedAt` far in the future.
```json
{
  "updatedAt": "2099-01-01T00:00:00Z"
}
```

### 10. Role Modification
Attempt for a Pathologist to change their own role to Admin.
```json
{
  "role": "Admin"
}
```

### 11. Orphaned Record
Attempt to create a report with a non-existent template ID reference (if applicable).

### 12. PII Leak
Authenticated user attempting to 'get' a report they don't own by ID guessing.

## Test Results
- [ ] Payload 1: PERMISSION_DENIED
- [ ] Payload 2: PERMISSION_DENIED
- [ ] Payload 3: PERMISSION_DENIED
- [ ] Payload 4: PERMISSION_DENIED
- [ ] Payload 5: PERMISSION_DENIED
- [ ] Payload 6: PERMISSION_DENIED
- [ ] Payload 7: PERMISSION_DENIED
- [ ] Payload 8: PERMISSION_DENIED
- [ ] Payload 9: PERMISSION_DENIED
- [ ] Payload 10: PERMISSION_DENIED
- [ ] Payload 11: PERMISSION_DENIED
- [ ] Payload 12: PERMISSION_DENIED
