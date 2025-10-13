# REST API Documentation

## Overview

This API implements a user-centric data model with strong ownership guarantees. Users can only access and modify their own data through authenticated endpoints. The architecture centers around three main content types: **Profile**, **Person**, and **IdentityDocument**, which form a network of one-to-one relationships with the authentication system.

## Data Model Relationships

### Relationship Chain
```
                    ┌─→ Person
User (auth) ←→ Profile
                    └─→ IdentityDocument
```

All relationships are **one-to-one**:
- Each **User** has exactly one **Profile** (created automatically on first access)
- Each **Profile** has at most one **Person** record containing personal information
- Each **Profile** has at most one **IdentityDocument** record containing identity information
- Access control is enforced through the User → Profile chain to both Person and IdentityDocument

### Content Type Schemas

#### Profile
A lightweight connector entity that bridges authentication and user data.

**Fields:**
- `user` (relation): One-to-one with `plugin::users-permissions.user`
- `person` (relation): One-to-one with `api::person.person`
- `identity_document` (relation): One-to-one with `api::identity-document.identity-document`

**Purpose:**
- Acts as an ownership anchor for all user-related data
- Created automatically when a user first accesses their profile
- Provides a stable reference point for related entities (person, identity documents, etc.)

#### Person
Stores detailed personal and contact information.

**Fields:**
- `firstName` (string): User's first name
- `lastName` (string): User's last name
- `street` (string): Street address
- `city` (string): City of residence
- `postalCode` (string): Postal/ZIP code
- `country` (string): Country
- `birthDate` (date): Date of birth
- `birthPlace` (string): Place of birth
- `nationality` (string): Nationality
- `maritalStatus` (string): Marital status
- `profession` (string): Occupation
- `phone` (string): Phone number
- `profile` (relation): One-to-one with `api::profile.profile` (owner reference)

#### IdentityDocument
Stores government-issued identification document information.

**Fields:**
- `type` (string): Document type (e.g., "passport", "driver_license", "national_id")
- `number` (string): Document identification number
- `issueDate` (date): Date when the document was issued
- `expiryDate` (date): Document expiration date
- `issuingAuthority` (string): Authority/organization that issued the document
- `profile` (relation): One-to-one with `api::profile.profile` (owner reference)

**Purpose:**
- Stores official identification information securely
- Used for identity verification and compliance purposes
- Linked to profile for ownership and access control

## Authentication & Authorization

### Access Control
All endpoints require authentication via JWT bearer token. Users can only access their own data:
- Requests are validated against `ctx.state.user.id`
- Owner filters are automatically applied to queries
- Forbidden (403) responses are returned for unauthorized access attempts

### Request Headers
```
Authorization: Bearer <jwt_token>
```

## Quick Start: Getting the Logged-in User's Full Profile

### GET /api/users/me?populate[profile][populate]=*

The fastest way to retrieve all data for the currently authenticated user is through the `/api/users/me` endpoint with deep population.

#### Purpose
Returns the authenticated user's information along with their complete profile and person data in a single request.

#### Request
```http
GET /api/users/me?populate[profile][populate]=* HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
```

#### Query Parameters
- **populate[profile][populate]=*** : Deep population that includes:
  - The user's profile
  - All relations within the profile (person, identity_document, etc.)

#### What Happens Internally

1. **Token Validation**: The JWT bearer token is validated
2. **User Identification**: `ctx.state.user` is extracted from the token
3. **Data Retrieval**: Fetches the user with profile and all nested relations
4. **Automatic Population**: Strapi populates the profile and its nested relations (person, identity_document)
5. **Response Sanitization**: Sensitive fields (password, tokens) are automatically removed

#### Response Structure
```json
{
  "id": 456,
  "documentId": "def456uvw",
  "username": "johndoe",
  "email": "john.doe@mail.com",
  "provider": "local",
  "confirmed": true,
  "blocked": false,
  "createdAt": "2025-09-15T08:00:00.000Z",
  "updatedAt": "2025-10-13T14:30:00.000Z",
  "firstName": null,
  "lastName": null,
  "profileComplete": false,
  "profile": {
    "id": 123,
    "documentId": "abc123xyz",
    "createdAt": "2025-10-01T10:00:00.000Z",
    "updatedAt": "2025-10-13T14:30:00.000Z",
    "publishedAt": "2025-10-01T10:00:00.000Z",
    "person": {
      "id": 789,
      "documentId": "ghi789rst",
      "firstName": "John",
      "lastName": "Doe",
      "street": "123 Main St",
      "city": "Springfield",
      "postalCode": "12345",
      "country": "USA",
      "birthDate": "1990-05-15",
      "birthPlace": "New York",
      "nationality": "American",
      "maritalStatus": "Single",
      "profession": "Software Engineer",
      "phone": "+1-555-0123",
      "createdAt": "2025-10-01T10:05:00.000Z",
      "updatedAt": "2025-10-13T14:30:00.000Z",
      "publishedAt": "2025-10-01T10:05:00.000Z"
    },
    "identity_document": {
      "id": 234,
      "documentId": "jkl234mno",
      "type": "passport",
      "number": "P12345678",
      "issueDate": "2020-01-15",
      "expiryDate": "2030-01-15",
      "issuingAuthority": "U.S. Department of State",
      "createdAt": "2025-10-01T10:10:00.000Z",
      "updatedAt": "2025-10-13T14:30:00.000Z",
      "publishedAt": "2025-10-01T10:10:00.000Z"
    }
  }
}
```

#### Key Advantages

1. **No Email Required**: Works directly from the JWT token without needing to know the user's email
2. **Single Request**: Gets user, profile, person, and identity document data in one API call
3. **Standard Endpoint**: Uses Strapi's built-in users-permissions `/me` endpoint
4. **Automatic Ownership**: No ownership checks needed—always returns the authenticated user's data
5. **Null Safety**: If profile, person, or identity_document don't exist yet, they'll be null in the response

#### Use Cases

**Initial App Load**: Fetch all user data when the app starts
```javascript
const response = await fetch('http://localhost:1337/api/users/me?populate[profile][populate]=*', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const userData = await response.json();
```

**Profile Page**: Display complete user information
```javascript
if (userData.profile?.person) {
  console.log(`Welcome ${userData.profile.person.firstName} ${userData.profile.person.lastName}`);
}

if (userData.profile?.identity_document) {
  console.log(`Document: ${userData.profile.identity_document.type} - ${userData.profile.identity_document.number}`);
}
```

**Conditional Rendering**: Check if profile is complete
```javascript
const hasPersonalInfo = userData.profile?.person !== null;
const hasIdentityDocument = userData.profile?.identity_document !== null;

if (!hasPersonalInfo || !hasIdentityDocument) {
  // Redirect to profile completion page
}
```

#### Alternative Population Patterns

**Specific Fields Only**:
```http
GET /api/users/me?populate[profile][populate][person][fields][0]=firstName&populate[profile][populate][person][fields][1]=lastName
```

**Profile Without Person**:
```http
GET /api/users/me?populate[profile]=*
```

**Basic User Info Only**:
```http
GET /api/users/me
```

#### Comparison with Profile API

| Feature | `/api/users/me?populate[profile][populate]=*` | `/api/profiles/user=email@example.com?populate=*` |
|---------|----------------------------------------------|--------------------------------------------------|
| **Authentication** | JWT token only | JWT token only |
| **Requires Email** | No | Yes |
| **Response Root** | User object | Profile object (wrapped in `data`) |
| **Auto-creates Profile** | No | Yes |
| **Use Case** | Get current user's full data | Access by email or alternative lookup |
| **Response Format** | Flat user object | Strapi standard response wrapper |

**Recommendation**: Use `/api/users/me` for most client applications as it's simpler and doesn't require knowing the user's email. Use the Profile API when you need email-based lookups or automatic profile creation.

## Profile API

Base URL: `/api/profiles`

### GET /api/profiles/user=john.doe@mail.com?populate=*

#### Purpose
Retrieves a user's profile by email address, with all related data populated.

#### Request
```http
GET /api/profiles/user=john.doe@mail.com?populate=* HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
```

#### Query Parameters
- **Email-based ID**: `user=john.doe@mail.com`
  - The API accepts email addresses as identifiers using the format `user=<email>`
  - The authenticated user must match the requested email
- **populate=*** : Populates all relations (user, person, identity_document)

#### What Happens Internally

1. **Email Parsing**: The controller extracts `john.doe@mail.com` from the `user=` parameter
2. **User Lookup**: Finds the user record by email in the database
3. **Authorization Check**: Verifies that `ctx.state.user.id` matches the found user's ID
4. **Profile Auto-creation**: If no profile exists, one is created automatically with `user: userId`
5. **Data Retrieval**: Fetches the profile with populated relations according to the query
6. **Response Sanitization**: Removes sensitive fields and returns the data

#### Response Structure
```json
{
  "data": {
    "id": 123,
    "documentId": "abc123xyz",
    "attributes": {
      "createdAt": "2025-10-01T10:00:00.000Z",
      "updatedAt": "2025-10-13T14:30:00.000Z",
      "publishedAt": "2025-10-01T10:00:00.000Z",
      "user": {
        "data": {
          "id": 456,
          "documentId": "def456uvw",
          "attributes": {
            "username": "johndoe",
            "email": "john.doe@mail.com",
            "provider": "local",
            "confirmed": true,
            "blocked": false,
            "createdAt": "2025-09-15T08:00:00.000Z",
            "updatedAt": "2025-10-13T14:30:00.000Z"
          }
        }
      },
      "person": {
        "data": {
          "id": 789,
          "documentId": "ghi789rst",
          "attributes": {
            "firstName": "John",
            "lastName": "Doe",
            "street": "123 Main St",
            "city": "Springfield",
            "postalCode": "12345",
            "country": "USA",
            "birthDate": "1990-05-15",
            "birthPlace": "New York",
            "nationality": "American",
            "maritalStatus": "Single",
            "profession": "Software Engineer",
            "phone": "+1-555-0123",
            "createdAt": "2025-10-01T10:05:00.000Z",
            "updatedAt": "2025-10-13T14:30:00.000Z",
            "publishedAt": "2025-10-01T10:05:00.000Z"
          }
        }
      },
      "identity_document": {
        "data": {
          "id": 234,
          "documentId": "jkl234mno",
          "attributes": {
            "type": "passport",
            "number": "P12345678",
            "issueDate": "2020-01-15",
            "expiryDate": "2030-01-15",
            "issuingAuthority": "U.S. Department of State",
            "createdAt": "2025-10-01T10:10:00.000Z",
            "updatedAt": "2025-10-13T14:30:00.000Z",
            "publishedAt": "2025-10-01T10:10:00.000Z"
          }
        }
      }
    }
  },
  "meta": {}
}
```

#### Key Features
- **Automatic Profile Creation**: If the user doesn't have a profile, it's created on-the-fly
- **Flexible Identifiers**: Supports both numeric IDs and email-based lookups
- **Secure by Default**: Users can only retrieve their own profile
- **Null Safety**: Returns `null` if person or identity_document haven't been created yet

## Person API

Base URL: `/api/people`

### PUT /api/people/user=john.doe@mail.com

#### Purpose
Updates (or creates) a user's person record by email address. Allows partial updates of personal information fields.

#### Request
```http
PUT /api/people/user=john.doe@mail.com HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "data": {
    "firstName": "New First Name"
  }
}
```

#### Request Body Structure
The body must contain a `data` object with the fields to update:
```json
{
  "data": {
    "firstName": "New First Name",
    "lastName": "New Last Name",
    "phone": "+1-555-9999",
    ...
  }
}
```

#### What Happens Internally

1. **Email Parsing**: Extracts `john.doe@mail.com` from the `user=` parameter
2. **User Lookup**: Finds user by email with profile and person populated
3. **Authorization Check**: Verifies `ctx.state.user.id` matches the user
4. **Profile Verification**: Ensures the user has a profile (creates if missing)
5. **Person Record Resolution**:
   - **If person exists**: Finds the existing person record linked to this profile
   - **If person doesn't exist**: Creates a new person record with `profile: profileId`
6. **Ownership Protection**: Strips out any `profile` field from the payload (prevents ownership hijacking)
7. **Partial Update**: Updates only the fields present in the request body
8. **Document API**: Uses Strapi's Documents API (`strapi.documents(UID).update()`) for the update
9. **Response**: Returns the updated person record with sanitized data

#### Effect of the Example Request

**Before:**
```json
{
  "id": 789,
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1-555-0123",
  "city": "Springfield",
  ...
}
```

**After:**
```json
{
  "id": 789,
  "firstName": "New First Name",  // ← Changed
  "lastName": "Doe",              // ← Unchanged
  "phone": "+1-555-0123",         // ← Unchanged
  "city": "Springfield",          // ← Unchanged
  ...
}
```

Only the `firstName` field is updated; all other fields remain unchanged.

#### Response Structure
```json
{
  "data": {
    "id": 789,
    "documentId": "ghi789rst",
    "attributes": {
      "firstName": "New First Name",
      "lastName": "Doe",
      "street": "123 Main St",
      "city": "Springfield",
      "postalCode": "12345",
      "country": "USA",
      "birthDate": "1990-05-15",
      "birthPlace": "New York",
      "nationality": "American",
      "maritalStatus": "Single",
      "profession": "Software Engineer",
      "phone": "+1-555-0123",
      "createdAt": "2025-10-01T10:05:00.000Z",
      "updatedAt": "2025-10-13T15:00:00.000Z",
      "publishedAt": "2025-10-01T10:05:00.000Z",
      "profile": {
        "data": {
          "id": 123,
          "documentId": "abc123xyz"
        }
      }
    }
  },
  "meta": {}
}
```

#### Update Behavior Details

**Partial Updates**: Only fields in the request body are modified
```json
// Update only phone number
{"data": {"phone": "+1-555-8888"}}
```

**Multiple Fields**: Multiple fields can be updated simultaneously
```json
// Update several fields at once
{
  "data": {
    "firstName": "Jane",
    "lastName": "Smith",
    "city": "Boston",
    "profession": "Data Scientist"
  }
}
```

**Auto-creation**: If person doesn't exist, it's created with the provided fields
```json
// First update creates the person record
{
  "data": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1-555-0123"
  }
}
```

**Ownership Protection**: The `profile` relation cannot be changed via API
```json
// This attempt to change ownership is ignored
{
  "data": {
    "firstName": "John",
    "profile": 999  // ← This is stripped out before processing
  }
}
```

## Alternative Access Patterns

### Numeric ID Access
Both APIs support traditional numeric IDs for direct access:

```http
GET /api/profiles/123
PUT /api/people/789
```

When using numeric IDs:
- The system still verifies ownership through the relationship chain
- The profile/person must belong to the authenticated user
- Returns 403 Forbidden if ownership check fails

### Standard REST Operations

#### List Profiles (Filtered to Current User)
```http
GET /api/profiles
```
Returns only profiles owned by the authenticated user.

#### List People (Filtered to Current User)
```http
GET /api/people
```
Returns only person records owned by the authenticated user (via profile relation).

## Error Responses

### 401 Unauthorized
```json
{
  "error": {
    "status": 401,
    "name": "UnauthorizedError",
    "message": "Unauthorized"
  }
}
```
**Cause**: Missing or invalid JWT token

### 403 Forbidden
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "You do not have permission to access this resource."
  }
}
```
**Cause**: Attempting to access another user's data

### 404 Not Found
```json
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "User with email \"john.doe@mail.com\" was not found."
  }
}
```
**Cause**: Email address doesn't match any user in the system

### 400 Bad Request
```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "Missing \"data\" payload in the request body"
  }
}
```
**Cause**: Invalid request body structure (missing `data` object)

## Implementation Architecture

### Security Layer (`authHelpers.js`)
- **`ensureAgentId(ctx)`**: Extracts authenticated user ID or throws 401
- **`maybeOwnerFilter(query, agentId, ownerField)`**: Injects ownership filters into queries

### Profile Management (`profileHelpers.js`)
- **`extractOwnerId(entity, ownerField)`**: Traverses relation chains to find owner
- **`parseEmailParam(id, paramKey)`**: Parses `user=email@example.com` patterns
- **`ensureProfile(strapi, user)`**: Auto-creates profiles when needed
- **`ensureProfileId(strapi, user)`**: Lightweight version returning only ID

### Generic Profile-Field Controller (`makeProfileFieldController.js`)
A factory function that generates secured CRUD controllers for entities related to profiles. Used by Person API.

**Features:**
- Automatic owner filtering
- Email-based and numeric ID support  
- Auto-creation of missing profile and related records
- Documents API integration (Strapi v5)
- Ownership validation on all operations

**Configuration:**
```javascript
makeProfileFieldController({
  strapi,              // Strapi instance
  UID,                 // Content type UID (e.g., 'api::person.person')
  typeField,           // Relation field on profile pointing to this type
  ownerField,          // Field pointing to owner (default: 'profile')
  ownerHasMany         // Whether owner can have multiple records (default: false)
})
```

## Best Practices

### Query Population
Always use `populate` parameter to include related data:
```http
GET /api/profiles/user=john.doe@mail.com?populate[person]=*
GET /api/profiles/user=john.doe@mail.com?populate=*
```

### Partial Updates
Send only fields that need to change:
```json
{"data": {"phone": "+1-555-9999"}}
```

### Error Handling
Always check for:
- 401: Redirect to login
- 403: Show "access denied" message
- 404: Handle missing user gracefully
- 400: Validate request body before sending

### Email Format
Use URL-encoded emails if they contain special characters:
```
/api/profiles/user=john.doe%2Btest%40mail.com
```

## Summary

1. **One-to-One Relationships**: User → Profile → Person chain ensures data integrity
2. **Automatic Provisioning**: Profiles are created on first access
3. **Email-Based Access**: Intuitive `user=email@example.com` identifier pattern
4. **Strong Ownership**: Users can only access their own data
5. **Partial Updates**: Efficient updates of individual fields
6. **Auto-creation**: Person records are created if missing during PUT operations
7. **Protection Against Ownership Hijacking**: Relation fields are stripped from user input


