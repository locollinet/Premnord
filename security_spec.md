# Security Specification & Adversarial Threat Model

## 1. Data Invariants

1. **Cellar Integrity**:
   - A wine cannot have a negative quantity (`quantity >= 0`).
   - A wine must reside in a registered physical Site (`siteId` matching a valid `site` document ID).
2. **Action Validation**:
   - Every inventory movement (`movement`) must reference an active `wineId`.
   - The user who records a movement cannot spoof their ID; `userId` must equal `request.auth.uid`.
3. **Immutability Rules**:
   - A wine's `createdAt` timestamp is set upon creation and can never be altered.
   - A movement record is completely immutable after creation (entries cannot be edited or deleted).
4. **Access Control**:
   - All read and write operations are strictly restricted to authenticated and email-verified restaurant staff members.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent targeted attacks attempting to violate identity, integrity, and state controls. Our security rules are designed to block each of them with a `PERMISSION_DENIED` response.

### Payload 1: Spoofer's Pride (Identity Spoofing)
An attacker attempts to create a movement logging a sale but attributes it to another user.
```json
{
  "id": "mov_attack_1",
  "wineId": "wine_chablis_1",
  "wineName": "Chablis Grand Cru",
  "type": "out",
  "quantity": 1,
  "reason": "vente",
  "userId": "victim_user_id_abc123", // Spoofed User ID
  "userName": "Victim Chef",
  "createdAt": 1719999999
}
```
*Expected Result: Blocked because `userId` must strictly equal `request.auth.uid`.*

### Payload 2: Ghost Field Insertion (Shadow Fields)
An attacker tries to inject undefined properties (`isVipCustomer: true` or `isAdmin: true`) into a wine document.
```json
{
  "id": "wine_attack_2",
  "name": "Margaux 2018",
  "domain": "Château Margaux",
  "vintage": "2018",
  "color": "rouge",
  "quantity": 12,
  "alertThreshold": 3,
  "siteId": "cave_centrale",
  "createdAt": 1719999999,
  "updatedAt": 1719999999,
  "isVipCustomer": true, // Ghost field
  "isAdmin": true        // Ghost field
}
```
*Expected Result: Blocked via `data.keys().hasAll()` and strict size validation.*

### Payload 3: Sub-Zero Depletion (Invalid Quantity)
An attacker tries to bypass stock counts and register a negative stock quantity on a wine.
```json
{
  "id": "wine_attack_3",
  "name": "Sancerre 2022",
  "domain": "Domaine Vacheron",
  "vintage": "2022",
  "color": "blanc",
  "quantity": -5, // Negative quantity
  "alertThreshold": 2,
  "siteId": "cave_centrale",
  "createdAt": 1719999999,
  "updatedAt": 1719999999
}
```
*Expected Result: Blocked because `quantity` must be >= 0.*

### Payload 4: Movement Alteration (Immutable Logs)
An attacker tries to edit a movement to cover up an internal theft or breakage.
```json
{
  "id": "mov_existing_4",
  "quantity": 0, // Modified quantity
  "reason": "correction"
}
```
*Expected Result: Blocked because `update` and `delete` on `movements` are completely disallowed.*

### Payload 5: Orphaned Wine (Missing Site Relation)
An attacker attempts to create a wine without binding it to an existing site.
```json
{
  "id": "wine_attack_5",
  "name": "Pomerol 2015",
  "domain": "Château Gazin",
  "vintage": "2015",
  "color": "rouge",
  "quantity": 6,
  "alertThreshold": 2,
  "siteId": "", // Empty or invalid Site ID
  "createdAt": 1719999999,
  "updatedAt": 1719999999
}
```
*Expected Result: Blocked by verifying `siteId` is non-empty and has a size limit.*

### Payload 6: Temporal Distortion (Client Timestamp Spoofing)
An attacker tries to set a future or past date as `createdAt` for a wine.
```json
{
  "id": "wine_attack_6",
  "name": "Meursault 2020",
  "domain": "Albert Bichot",
  "vintage": "2020",
  "color": "blanc",
  "quantity": 24,
  "alertThreshold": 6,
  "siteId": "cave_centrale",
  "createdAt": 1600000000, // Spoofed past timestamp
  "updatedAt": 1719999999
}
```
*Expected Result: Blocked by validating `createdAt == request.time` (or server timestamp comparison).*

### Payload 7: Denial of Wallet (ID Poisoning)
An attacker sends a request targeting a document ID consisting of 1MB of garbage characters to increase read costs and poison indexing.
- ID: `a_very_long_garbage_id_of_100kb_...`
*Expected Result: Blocked because document path IDs must pass `isValidId` and be <= 128 characters.*

### Payload 8: Anonymous Intrusion
An unauthenticated or anonymous client attempts to fetch the list of wines.
*Expected Result: Blocked because `request.auth` must be non-null and the user email must be verified.*

### Payload 9: Unverified Employee Write
An authenticated user who has not verified their restaurant email tries to add a new site.
```json
{
  "id": "site_attack_9",
  "name": "Cave Secrète",
  "createdAt": 1719999999
}
```
*Expected Result: Blocked because `request.auth.token.email_verified` must be `true`.*

### Payload 10: Value Type Poisoning
An attacker tries to update the wine's name to a boolean value.
```json
{
  "name": true
}
```
*Expected Result: Blocked by `isValidWine` schema type enforcement.*

### Payload 11: Stock Shortcutting
An attacker attempts to write an update on a wine to increase stock directly by modifying `quantity` without logging a corresponding `movement` record.
*Expected Result: Caught by client-side application structure and backed up by server-side verification rules. On update, `quantity` is only modified when the action complies with a valid edit.*

### Payload 12: Site Removal Crash
An attacker attempts to delete a site that still contains wines, creating dangling references.
*Expected Result: Blocked by security constraints preventing arbitrary deletion, and application-level verification.*
