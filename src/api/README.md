# REST API Documentation

## Overview

This API implements a user-centric data model with strong ownership guarantees. Users can only access and modify their own data through authenticated endpoints. The architecture centers around four main content types: **Profile**, **Person**, **IdentityDocument**, and **EmergencyContact**, which form a network of relationships with the authentication system.

## Data Model Relationships

### Relationship Chain
```
                    ┌─→ Person (1:1)
                    │
User (auth) ←→ Profile ├─→ IdentityDocument (1:1)
                    │
                    └─→ EmergencyContact (1:N)
```

**Relationship Types:**
- Each **User** has exactly one **Profile** (created automatically on first access)
- Each **Profile** has at most one **Person** record containing personal information (one-to-one)
- Each **Profile** has at most one **IdentityDocument** record containing identity information (one-to-one)
- Each **Profile** can have **multiple EmergencyContact** records (one-to-many)
- Access control is enforced through the User → Profile chain to all related entities

### Content Type Schemas

#### Profile
A lightweight connector entity that bridges authentication and user data.

**Fields:**
- `user` (relation): One-to-one with `plugin::users-permissions.user`
- `person` (relation): One-to-one with `api::person.person`
- `identity_document` (relation): One-to-one with `api::identity-document.identity-document`
- `emergency_contacts` (relation): One-to-many with `api::emergency-contact.emergency-contact`

**Purpose:**
- Acts as an ownership anchor for all user-related data
- Created automatically when a user first accesses their profile
- Provides a stable reference point for related entities (person, identity documents, emergency contacts, etc.)

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

#### EmergencyContact
Stores emergency contact information for the user. **Unlike Person and IdentityDocument, users can have multiple emergency contacts.**

**Fields:**
- `firstName` (string): Contact's first name
- `lastName` (string): Contact's last name
- `relationship` (string): Relationship to the user (e.g., "Spouse", "Parent", "Sibling", "Friend")
- `phone` (string): Contact's phone number
- `email` (email): Contact's email address
- `profile` (relation): Many-to-one with `api::profile.profile` (owner reference)

**Purpose:**
- Stores contact information for people to notify in case of emergency
- Supports multiple contacts per user (family, friends, neighbors, etc.)
- Linked to profile for ownership and access control

**Key Difference:** This is a **one-to-many** relationship, allowing bulk operations to create, update, or manage multiple contacts in a single request.

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
  - All relations within the profile (person, identity_document, emergency_contacts, etc.)

#### What Happens Internally

1. **Token Validation**: The JWT bearer token is validated
2. **User Identification**: `ctx.state.user` is extracted from the token
3. **Data Retrieval**: Fetches the user with profile and all nested relations
4. **Automatic Population**: Strapi populates the profile and its nested relations (person, identity_document, emergency_contacts)
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
    },
    "emergency_contacts": [
      {
        "id": 301,
        "documentId": "pqr301stu",
        "firstName": "Jane",
        "lastName": "Doe",
        "relationship": "Spouse",
        "phone": "+1-555-1111",
        "email": "jane.doe@mail.com",
        "createdAt": "2025-10-01T10:15:00.000Z",
        "updatedAt": "2025-10-13T14:30:00.000Z",
        "publishedAt": "2025-10-01T10:15:00.000Z"
      },
      {
        "id": 302,
        "documentId": "vwx302yza",
        "firstName": "Bob",
        "lastName": "Smith",
        "relationship": "Brother",
        "phone": "+1-555-2222",
        "email": "bob.smith@mail.com",
        "createdAt": "2025-10-01T10:20:00.000Z",
        "updatedAt": "2025-10-13T14:30:00.000Z",
        "publishedAt": "2025-10-01T10:20:00.000Z"
      }
    ]
  }
}
```

#### Key Advantages

1. **No Email Required**: Works directly from the JWT token without needing to know the user's email
2. **Single Request**: Gets user, profile, person, identity document, and all emergency contacts in one API call
3. **Standard Endpoint**: Uses Strapi's built-in users-permissions `/me` endpoint
4. **Automatic Ownership**: No ownership checks needed—always returns the authenticated user's data
5. **Null Safety**: If profile, person, or identity_document don't exist yet, they'll be null; emergency_contacts will be an empty array

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

if (userData.profile?.emergency_contacts?.length > 0) {
  console.log(`Emergency contacts: ${userData.profile.emergency_contacts.length}`);
  userData.profile.emergency_contacts.forEach(contact => {
    console.log(`- ${contact.firstName} ${contact.lastName} (${contact.relationship}): ${contact.phone}`);
  });
}
```

**Conditional Rendering**: Check if profile is complete
```javascript
const hasPersonalInfo = userData.profile?.person !== null;
const hasIdentityDocument = userData.profile?.identity_document !== null;
const hasEmergencyContacts = userData.profile?.emergency_contacts?.length > 0;

if (!hasPersonalInfo || !hasIdentityDocument || !hasEmergencyContacts) {
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
- **populate=*** : Populates all relations (user, person, identity_document, emergency_contacts)

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
      },
      "emergency_contacts": {
        "data": [
          {
            "id": 301,
            "documentId": "pqr301stu",
            "attributes": {
              "firstName": "Jane",
              "lastName": "Doe",
              "relationship": "Spouse",
              "phone": "+1-555-1111",
              "email": "jane.doe@mail.com",
              "createdAt": "2025-10-01T10:15:00.000Z",
              "updatedAt": "2025-10-13T14:30:00.000Z",
              "publishedAt": "2025-10-01T10:15:00.000Z"
            }
          },
          {
            "id": 302,
            "documentId": "vwx302yza",
            "attributes": {
              "firstName": "Bob",
              "lastName": "Smith",
              "relationship": "Brother",
              "phone": "+1-555-2222",
              "email": "bob.smith@mail.com",
              "createdAt": "2025-10-01T10:20:00.000Z",
              "updatedAt": "2025-10-13T14:30:00.000Z",
              "publishedAt": "2025-10-01T10:20:00.000Z"
            }
          }
        ]
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
- **Null Safety**: Returns `null` if person or identity_document haven't been created yet; emergency_contacts returns an empty array if none exist

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

## IdentityDocument API

Base URL: `/api/identity-documents`

The IdentityDocument API follows the same patterns as the Person API, providing secure access to identity document information through the Profile ownership chain.

### GET /api/identity-documents/user=john.doe@mail.com

#### Purpose
Retrieves a user's identity document by email address.

#### Request
```http
GET /api/identity-documents/user=john.doe@mail.com HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
```

#### Response Structure
```json
{
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
      "publishedAt": "2025-10-01T10:10:00.000Z",
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

### PUT /api/identity-documents/user=john.doe@mail.com

#### Purpose
Updates (or creates) a user's identity document by email address. Allows partial updates of identity document fields.

#### Request
```http
PUT /api/identity-documents/user=john.doe@mail.com HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "data": {
    "type": "passport",
    "number": "P87654321",
    "issueDate": "2023-06-01",
    "expiryDate": "2033-06-01",
    "issuingAuthority": "U.S. Department of State"
  }
}
```

#### Request Body Structure
The body must contain a `data` object with the fields to update:
```json
{
  "data": {
    "type": "passport",
    "number": "P87654321",
    "issueDate": "2023-06-01",
    "expiryDate": "2033-06-01",
    "issuingAuthority": "U.S. Department of State"
  }
}
```

#### What Happens Internally

The IdentityDocument API uses the same `makeProfileFieldController` as Person, providing identical security and behavior patterns:

1. **Email Parsing**: Extracts `john.doe@mail.com` from the `user=` parameter
2. **User Lookup**: Finds user by email with profile and identity_document populated
3. **Authorization Check**: Verifies `ctx.state.user.id` matches the user
4. **Profile Verification**: Ensures the user has a profile (creates if missing)
5. **Document Record Resolution**:
   - **If identity_document exists**: Finds the existing document record linked to this profile
   - **If identity_document doesn't exist**: Creates a new document record with `profile: profileId`
6. **Ownership Protection**: Strips out any `profile` field from the payload (prevents ownership hijacking)
7. **Partial Update**: Updates only the fields present in the request body
8. **Document API**: Uses Strapi's Documents API (`strapi.documents(UID).update()`) for the update
9. **Response**: Returns the updated identity document record with sanitized data

#### Effect of the Example Request

**Scenario 1: Updating Existing Document**

**Before:**
```json
{
  "id": 234,
  "type": "passport",
  "number": "P12345678",
  "issueDate": "2020-01-15",
  "expiryDate": "2030-01-15",
  "issuingAuthority": "U.S. Department of State"
}
```

**After:**
```json
{
  "id": 234,
  "type": "passport",              // ← Unchanged (reconfirmed)
  "number": "P87654321",           // ← Changed
  "issueDate": "2023-06-01",       // ← Changed
  "expiryDate": "2033-06-01",      // ← Changed
  "issuingAuthority": "U.S. Department of State"  // ← Unchanged (reconfirmed)
}
```

**Scenario 2: Creating New Document**

If no identity document exists for the user, the same PUT request creates one:

**Before:** `null` (no document)

**After:**
```json
{
  "id": 234,
  "type": "passport",
  "number": "P87654321",
  "issueDate": "2023-06-01",
  "expiryDate": "2033-06-01",
  "issuingAuthority": "U.S. Department of State",
  "profile": 123
}
```

#### Response Structure
```json
{
  "data": {
    "id": 234,
    "documentId": "jkl234mno",
    "attributes": {
      "type": "passport",
      "number": "P87654321",
      "issueDate": "2023-06-01",
      "expiryDate": "2033-06-01",
      "issuingAuthority": "U.S. Department of State",
      "createdAt": "2025-10-01T10:10:00.000Z",
      "updatedAt": "2025-10-13T16:00:00.000Z",
      "publishedAt": "2025-10-01T10:10:00.000Z",
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
// Update only the expiry date
{
  "data": {
    "expiryDate": "2035-12-31"
  }
}
```

**Document Type Changes**: Can change document type (e.g., from passport to driver's license)
```json
{
  "data": {
    "type": "driver_license",
    "number": "DL123456789",
    "issueDate": "2024-01-01",
    "expiryDate": "2028-01-01",
    "issuingAuthority": "California DMV"
  }
}
```

**Auto-creation**: If identity_document doesn't exist, it's created with the provided fields
```json
// First update creates the identity document record
{
  "data": {
    "type": "national_id",
    "number": "NID-98765432",
    "issueDate": "2022-03-15",
    "expiryDate": "2032-03-15",
    "issuingAuthority": "National ID Authority"
  }
}
```

**Ownership Protection**: The `profile` relation cannot be changed via API
```json
// This attempt to change ownership is ignored
{
  "data": {
    "type": "passport",
    "profile": 999  // ← This is stripped out before processing
  }
}
```

#### Common Document Types

The `type` field typically contains one of these values:
- `"passport"` - International passport
- `"national_id"` - National identity card
- `"driver_license"` - Driver's license
- `"residence_permit"` - Residence/work permit
- `"military_id"` - Military identification
- Or any custom document type your application requires

#### Security Considerations

**Sensitive Data**: Identity documents contain highly sensitive PII (Personally Identifiable Information)
- Always use HTTPS in production
- Consider additional encryption for document numbers
- Implement audit logging for all access and modifications
- Follow data protection regulations (GDPR, CCPA, etc.)

**Access Control**: 
- Users can only access their own identity documents
- No cross-user access is possible
- Ownership is enforced at the database query level

## EmergencyContact API

Base URL: `/api/emergency-contacts`

The EmergencyContact API differs from Person and IdentityDocument in a fundamental way: it supports **one-to-many relationships**. Users can have multiple emergency contacts, and the API provides bulk operations to manage them efficiently.

### Key Difference: One-to-Many Relationship

Unlike Person and IdentityDocument (which are one-to-one with Profile), EmergencyContact uses a **one-to-many** relationship:
- A single Profile can have **multiple** EmergencyContact records
- Updates accept **arrays** of contact objects
- Each item in the array can be either an update (with `id`) or a new contact (without `id`)

### GET /api/emergency-contacts

#### Purpose
Retrieves all emergency contacts for the authenticated user.

#### Request
```http
GET /api/emergency-contacts HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
```

#### Response Structure
```json
{
  "data": [
    {
      "id": 301,
      "documentId": "pqr301stu",
      "attributes": {
        "firstName": "Jane",
        "lastName": "Doe",
        "relationship": "Spouse",
        "phone": "+1-555-1111",
        "email": "jane.doe@mail.com",
        "createdAt": "2025-10-01T10:15:00.000Z",
        "updatedAt": "2025-10-13T14:30:00.000Z",
        "publishedAt": "2025-10-01T10:15:00.000Z"
      }
    },
    {
      "id": 302,
      "documentId": "vwx302yza",
      "attributes": {
        "firstName": "Bob",
        "lastName": "Smith",
        "relationship": "Brother",
        "phone": "+1-555-2222",
        "email": "bob.smith@mail.com",
        "createdAt": "2025-10-01T10:20:00.000Z",
        "updatedAt": "2025-10-13T14:30:00.000Z",
        "publishedAt": "2025-10-01T10:20:00.000Z"
      }
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 25,
      "pageCount": 1,
      "total": 2
    }
  }
}
```

#### Features
- Automatically filtered to show only the authenticated user's contacts
- Supports standard Strapi query parameters (pagination, sorting, filtering)
- Returns empty array if no contacts exist

### PUT /api/emergency-contacts/user=john.doe@mail.com

#### Purpose
Updates or creates emergency contacts for a user identified by their email address. **This endpoint supports bulk operations** with partial updates.

#### Request
```http
PUT /api/emergency-contacts/user=john.doe@mail.com HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "data": [
    {
      "id": 301,
      "phone": "+1-555-9999"
    },
    {
      "firstName": "Sarah",
      "lastName": "Johnson",
      "relationship": "Friend",
      "phone": "+1-555-3333",
      "email": "sarah.j@mail.com"
    }
  ]
}
```

#### Request Body Structure

The body must contain a `data` field with an **array** of emergency contact objects. Each object represents either an update to an existing contact or a new contact to create.

**Critical Point:** Unlike Person and IdentityDocument which accept a single object, EmergencyContact requires an **array** in the `data` field.

```json
{
  "data": [
    // Array of contact objects
  ]
}
```

### How Updates Work for EmergencyContacts

The API processes each item in the array according to these rules:

#### Rule 1: Item with `id` field (Update Existing)

If an element contains an `id` field, the API updates the existing contact:

**Behavior:**
1. Finds the existing emergency contact by its `id`
2. Verifies that the authenticated user owns this contact (via profile)
3. Updates **only the fields provided** in the request (partial update)
4. Leaves all other fields unchanged
5. Returns the updated contact

**Example:**
```json
{
  "data": [
    {
      "id": 301,
      "phone": "+1-555-9999"
    }
  ]
}
```

**Effect:** Updates only the phone number of contact #301, leaving firstName, lastName, relationship, and email unchanged.

#### Rule 2: Item without `id` field (Create New)

If an element does **not** contain an `id` field, the API creates a new contact:

**Behavior:**
1. Creates a new emergency contact entry
2. Automatically assigns the authenticated user's profile as the owner
3. Initializes the contact with the provided field values
4. Returns the newly created contact

**Example:**
```json
{
  "data": [
    {
      "firstName": "Sarah",
      "lastName": "Johnson",
      "relationship": "Friend",
      "phone": "+1-555-3333",
      "email": "sarah.j@mail.com"
    }
  ]
}
```

**Effect:** Creates a new emergency contact with the provided information.

### Complete Update Example

#### Request
```http
PUT /api/emergency-contacts/user=john.doe@mail.com HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "data": [
    {
      "id": 301,
      "phone": "+1-555-1111-NEW"
    },
    {
      "id": 302,
      "relationship": "Close Friend",
      "email": "bob.updated@mail.com"
    },
    {
      "firstName": "Emergency",
      "lastName": "Services",
      "relationship": "Hospital",
      "phone": "+1-911-0000",
      "email": "emergency@hospital.com"
    }
  ]
}
```

**What happens:**
- **Contact #301**: Updates only the phone number
- **Contact #302**: Updates relationship and email, other fields unchanged
- **Third item**: Creates a new emergency contact

#### Response
```json
{
  "data": [
    {
      "id": 301,
      "documentId": "pqr301stu",
      "attributes": {
        "firstName": "Jane",
        "lastName": "Doe",
        "relationship": "Spouse",
        "phone": "+1-555-1111-NEW",
        "email": "jane.doe@mail.com",
        "createdAt": "2025-10-01T10:15:00.000Z",
        "updatedAt": "2025-10-13T16:00:00.000Z",
        "publishedAt": "2025-10-01T10:15:00.000Z"
      }
    },
    {
      "id": 302,
      "documentId": "vwx302yza",
      "attributes": {
        "firstName": "Bob",
        "lastName": "Smith",
        "relationship": "Close Friend",
        "phone": "+1-555-2222",
        "email": "bob.updated@mail.com",
        "createdAt": "2025-10-01T10:20:00.000Z",
        "updatedAt": "2025-10-13T16:00:00.000Z",
        "publishedAt": "2025-10-01T10:20:00.000Z"
      }
    },
    {
      "id": 303,
      "documentId": "bcd303efg",
      "attributes": {
        "firstName": "Emergency",
        "lastName": "Services",
        "relationship": "Hospital",
        "phone": "+1-911-0000",
        "email": "emergency@hospital.com",
        "createdAt": "2025-10-13T16:00:00.000Z",
        "updatedAt": "2025-10-13T16:00:00.000Z",
        "publishedAt": "2025-10-13T16:00:00.000Z"
      }
    }
  ],
  "meta": {}
}
```

### Common Use Cases

#### Use Case 1: Add First Emergency Contact
```json
{
  "data": [
    {
      "firstName": "Jane",
      "lastName": "Doe",
      "relationship": "Spouse",
      "phone": "+1-555-1111",
      "email": "jane@example.com"
    }
  ]
}
```

#### Use Case 2: Update Existing Contact Phone
```json
{
  "data": [
    {
      "id": 301,
      "phone": "+1-555-9999"
    }
  ]
}
```

#### Use Case 3: Add Multiple Contacts at Once
```json
{
  "data": [
    {
      "firstName": "Mom",
      "lastName": "Smith",
      "relationship": "Mother",
      "phone": "+1-555-1111",
      "email": "mom@example.com"
    },
    {
      "firstName": "Dad",
      "lastName": "Smith",
      "relationship": "Father",
      "phone": "+1-555-2222",
      "email": "dad@example.com"
    },
    {
      "firstName": "Best Friend",
      "lastName": "Jones",
      "relationship": "Friend",
      "phone": "+1-555-3333",
      "email": "friend@example.com"
    }
  ]
}
```

#### Use Case 4: Mixed Update and Create
```json
{
  "data": [
    {
      "id": 301,
      "email": "jane.new@example.com"
    },
    {
      "firstName": "New",
      "lastName": "Contact",
      "relationship": "Colleague",
      "phone": "+1-555-4444",
      "email": "colleague@example.com"
    }
  ]
}
```

### What Happens Internally

1. **Email Parsing**: Extracts `john.doe@mail.com` from the `user=` parameter
2. **User Lookup**: Finds user by email with profile and emergency_contacts populated
3. **Authorization Check**: Verifies `ctx.state.user.id` matches the user
4. **Profile Verification**: Ensures the user has a profile (creates if missing)
5. **Array Validation**: Confirms `data` is an array, not a single object
6. **Item Processing**: Iterates through each item in the array:
   - **If item has `id`**: 
     - Finds existing contact by ID
     - Verifies ownership via profile chain
     - Performs partial update with Documents API
   - **If item has no `id`**:
     - Creates new contact with `profile: profileId`
     - Assigns all provided fields
7. **Ownership Protection**: Strips out any `profile` field from payloads
8. **Response**: Returns array of all processed contacts (updated and created)

### Ownership Protection

The `profile` relation cannot be changed via API:
```json
// This attempt to change ownership is ignored
{
  "data": [
    {
      "id": 301,
      "phone": "+1-555-9999",
      "profile": 999  // ← This is stripped out before processing
    }
  ]
}
```

### Common Relationship Values

Typical values for the `relationship` field:
- `"Spouse"` / `"Partner"`
- `"Parent"` / `"Mother"` / `"Father"`
- `"Child"` / `"Son"` / `"Daughter"`
- `"Sibling"` / `"Brother"` / `"Sister"`
- `"Friend"` / `"Close Friend"`
- `"Colleague"` / `"Coworker"`
- `"Neighbor"`
- `"Doctor"` / `"Physician"`
- `"Lawyer"`
- Or any custom relationship your application requires

### DELETE /api/emergency-contacts/:id

#### Purpose
Deletes emergency contact(s) by ID. **This operation is only available for EmergencyContact** because it's the only content type with a one-to-many relationship.

#### Two Deletion Patterns

The DELETE endpoint supports two distinct patterns:

1. **Pattern A: Direct ID Deletion** - Delete a single contact using its numeric/UUID ID
2. **Pattern B: Email-Based Bulk Deletion** - Delete multiple contacts using email identifier with IDs in request body

#### Pattern A: Delete Single Contact by Direct ID

##### Request
```http
DELETE /api/emergency-contacts/301 HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
```

##### What Happens Internally

1. **ID Validation**: Confirms the ID is a direct numeric/UUID ID
2. **Fetch Record**: Retrieves the emergency contact with profile and user populated
3. **Ownership Check**: Verifies the authenticated user owns this contact via profile chain
4. **Authorization**: Returns 403 if the contact belongs to another user
5. **Deletion**: Removes the record using Documents API (or service API as fallback)
6. **Response**: Returns the deleted contact data

##### Response Structure
```json
{
  "data": {
    "id": 301,
    "documentId": "pqr301stu",
    "attributes": {
      "firstName": "Jane",
      "lastName": "Doe",
      "relationship": "Spouse",
      "phone": "+1-555-1111",
      "email": "jane.doe@mail.com",
      "createdAt": "2025-10-01T10:15:00.000Z",
      "updatedAt": "2025-10-13T14:30:00.000Z",
      "publishedAt": "2025-10-01T10:15:00.000Z"
    }
  },
  "meta": {}
}
```

#### Pattern B: Delete Multiple Contacts by Email

##### Purpose
Deletes multiple emergency contacts for a user identified by their email address. **This pattern enables efficient bulk deletion** with full ownership verification before any deletions occur.

##### Request
```http
DELETE /api/emergency-contacts/user=john.doe@mail.com HTTP/1.1
Host: localhost:1337
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "data": [301, 302, 305]
}
```

##### Request Body Structure

The body must contain a `data` field with an **array** of IDs to delete. Supports two formats:

**Format 1: Plain ID array (recommended)**
```json
{
  "data": [301, 302, 305]
}
```

**Format 2: Objects with id property**
```json
{
  "data": [
    {"id": 301},
    {"id": 302},
    {"id": 305}
  ]
}
```

##### What Happens Internally

1. **Email Parsing**: Extracts `john.doe@mail.com` from the `user=` parameter
2. **User Lookup**: Finds user by email with profile populated
3. **Authorization Check**: Verifies `ctx.state.user.id` matches the user
4. **Profile Verification**: Ensures the user has a profile
5. **ID Extraction**: Collects all IDs from the request body (supports both formats)
6. **Ownership Verification Phase**: 
   - Fetches each record by ID with populated owner
   - Verifies authenticated user owns ALL records
   - **If ANY record fails verification, NO deletions occur** (atomic-like behavior)
   - Returns 403 or 404 if any verification fails
7. **Deletion Phase**: Only after all verifications pass
   - Deletes each record using Documents API (or service API as fallback)
   - Collects all deletion results
8. **Response**: Returns array of all deleted records

##### Complete Example: Bulk Deletion

**Scenario:** User wants to remove multiple outdated emergency contacts at once.

**Step 1:** Get current contacts and their IDs
```http
GET /api/emergency-contacts HTTP/1.1
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "data": [
    {
      "id": 301,
      "attributes": {
        "firstName": "Jane",
        "relationship": "Ex-Spouse"
      }
    },
    {
      "id": 302,
      "attributes": {
        "firstName": "Old",
        "relationship": "Former Colleague"
      }
    },
    {
      "id": 303,
      "attributes": {
        "firstName": "Bob",
        "relationship": "Brother"
      }
    },
    {
      "id": 304,
      "attributes": {
        "firstName": "Alice",
        "relationship": "Sister"
      }
    }
  ]
}
```

**Step 2:** Delete multiple contacts (keeping 303 and 304)
```http
DELETE /api/emergency-contacts/user=john.doe@mail.com HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "data": [301, 302]
}
```

**Response:**
```json
{
  "data": [
    {
      "id": 301,
      "documentId": "pqr301stu",
      "attributes": {
        "firstName": "Jane",
        "lastName": "Doe",
        "relationship": "Ex-Spouse",
        "phone": "+1-555-1111",
        "email": "jane.doe@mail.com",
        "createdAt": "2025-10-01T10:15:00.000Z",
        "updatedAt": "2025-10-13T14:30:00.000Z",
        "publishedAt": "2025-10-01T10:15:00.000Z"
      }
    },
    {
      "id": 302,
      "documentId": "vwx302yza",
      "attributes": {
        "firstName": "Old",
        "lastName": "Contact",
        "relationship": "Former Colleague",
        "phone": "+1-555-2222",
        "email": "old.contact@mail.com",
        "createdAt": "2025-10-01T10:20:00.000Z",
        "updatedAt": "2025-10-13T14:30:00.000Z",
        "publishedAt": "2025-10-01T10:20:00.000Z"
      }
    }
  ],
  "meta": {}
}
```

**Result:** Contacts #301 and #302 are deleted. Contacts #303 and #304 remain.

#### Common Delete Use Cases

##### Use Case 1: Remove Single Outdated Contact (Direct ID)
```bash
# Delete contact who is no longer available
curl -X DELETE http://localhost:1337/api/emergency-contacts/305 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

##### Use Case 2: Bulk Cleanup - Remove Multiple Contacts (Email-Based)
```bash
# Delete multiple contacts in one request
curl -X DELETE http://localhost:1337/api/emergency-contacts/user=john.doe@mail.com \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [301, 303, 305]
  }'
```

##### Use Case 3: Replace a Contact (Direct ID)
```bash
# Step 1: Delete old contact
curl -X DELETE http://localhost:1337/api/emergency-contacts/301 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Step 2: Add new contact
curl -X PUT http://localhost:1337/api/emergency-contacts/user=john.doe@mail.com \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [{
      "firstName": "New",
      "lastName": "Contact",
      "relationship": "Friend",
      "phone": "+1-555-9999",
      "email": "new@example.com"
    }]
  }'
```

##### Use Case 4: Frontend - Remove Multiple Contacts (Recommended: Email-Based)
```javascript
// Efficient bulk deletion in a single request
const contactIdsToRemove = [301, 303, 305];

await fetch(`http://localhost:1337/api/emergency-contacts/user=${userEmail}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    data: contactIdsToRemove
  })
});
```

##### Use Case 5: Frontend - Remove Multiple Contacts (Alternative: Individual Requests)
```javascript
// Less efficient but works with direct IDs
const contactIdsToRemove = [301, 303, 305];

for (const contactId of contactIdsToRemove) {
  await fetch(`http://localhost:1337/api/emergency-contacts/${contactId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
}
```

##### Use Case 6: Complete Contact Management Flow
```javascript
// Get all contacts
const response = await fetch('http://localhost:1337/api/emergency-contacts', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { data: contacts } = await response.json();

// Filter contacts to keep and to remove
const contactsToKeep = contacts.filter(c => 
  c.attributes.relationship !== "Ex-Spouse"
);
const idsToRemove = contacts
  .filter(c => c.attributes.relationship === "Ex-Spouse")
  .map(c => c.id);

// Bulk delete unwanted contacts
if (idsToRemove.length > 0) {
  await fetch(`http://localhost:1337/api/emergency-contacts/user=${userEmail}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ data: idsToRemove })
  });
}
```

#### Choosing Between Deletion Patterns

| Scenario | Recommended Pattern | Reason |
|----------|---------------------|--------|
| Delete 1 contact | Direct ID | Simple, single request |
| Delete 2+ contacts | Email-based bulk | Fewer requests, atomic verification |
| Delete all contacts of type | Email-based bulk | Filter then bulk delete |
| Integration with search | Direct ID | Use ID from search result |
| Complex filtering logic | Email-based bulk | Filter in app, then bulk delete |

#### Why Person and IdentityDocument Don't Support DELETE

Person and IdentityDocument are **one-to-one** relationships with Profile:
- Each profile has **at most one** Person record
- Each profile has **at most one** IdentityDocument record
- Deleting doesn't make sense—you'd update to empty/null values instead
- To "remove" data, use PUT with empty strings or omit fields

EmergencyContact is **one-to-many**:
- Each profile can have **multiple** contacts
- Deleting individual contacts is necessary for management
- DELETE is enabled only for this relationship type
- **Supports both single deletion and bulk deletion**

### Error Responses

**400 Bad Request** - Invalid ID format or wrong content type (DELETE with direct ID):
```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "Delete requires a valid record ID."
  }
}
```

**400 Bad Request** - Missing or invalid data array (DELETE with email):
```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "Request body must contain a \"data\" array with IDs to delete."
  }
}
```

**400 Bad Request** - No valid IDs in array (DELETE with email):
```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "No valid IDs found in request body data array."
  }
}
```

**400 Bad Request** - Data is not an array (PUT requests):
```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "Data must be an array of updates"
  }
}
```

**403 Forbidden** - Attempting to delete another user's contact (direct ID):
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "You do not have permission to delete this resource."
  }
}
```

**403 Forbidden** - Attempting to delete another user's contact (email-based):
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "You do not own the record with id 301"
  }
}
```

**403 Forbidden** - Attempting to delete resources for different user (email-based):
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "You do not have permission to delete resources for this user."
  }
}
```

**403 Forbidden** - Attempting to update another user's contact:
```json
{
  "error": {
    "status": 403,
    "name": "ForbiddenError",
    "message": "You do not own the record with id 301"
  }
}
```

**404 Not Found** - Contact not found (direct ID):
```json
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Record not found."
  }
}
```

**404 Not Found** - Contact not found in bulk deletion (email-based):
```json
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Record with id 301 not found."
  }
}
```

**404 Not Found** - User not found (email-based operations):
```json
{
  "error": {
    "status": 404,
    "name": "NotFoundError",
    "message": "Owner with email \"invalid@example.com\" was not found."
  }
}
```

## Alternative Access Patterns

### Numeric ID Access
All APIs support traditional numeric IDs for direct access:

```http
GET /api/profiles/123
PUT /api/people/789
PUT /api/identity-documents/234
PUT /api/emergency-contacts/user=john.doe@mail.com
DELETE /api/emergency-contacts/301
```

When using numeric IDs:
- The system still verifies ownership through the relationship chain
- The profile/person/identity-document/emergency-contacts must belong to the authenticated user
- Returns 403 Forbidden if ownership check fails

**Note:** For EmergencyContact bulk operations (updates or deletes), the email-based endpoint is preferred. Direct numeric IDs work for single-contact operations but require individual requests for each contact.

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

#### List Identity Documents (Filtered to Current User)
```http
GET /api/identity-documents
```
Returns only identity document records owned by the authenticated user (via profile relation).

#### List Emergency Contacts (Filtered to Current User)
```http
GET /api/emergency-contacts
```
Returns only emergency contact records owned by the authenticated user (via profile relation). Supports pagination for users with many contacts.

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
GET /api/profiles/user=john.doe@mail.com?populate[identity_document]=*
GET /api/profiles/user=john.doe@mail.com?populate[emergency_contacts]=*
GET /api/profiles/user=john.doe@mail.com?populate=*
```

### Partial Updates

**For Person and IdentityDocument (single object):**
```json
{"data": {"phone": "+1-555-9999"}}
```

**For EmergencyContacts (array of objects):**
```json
{
  "data": [
    {"id": 301, "phone": "+1-555-9999"}
  ]
}
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

The Profile, Person, IdentityDocument, and EmergencyContact APIs provide a secure, user-centric REST interface with the following characteristics:

### Core Features

1. **Flexible Relationships**: 
   - User → Profile (1:1)
   - Profile → Person (1:1)
   - Profile → IdentityDocument (1:1)
   - Profile → EmergencyContacts (1:N)

2. **Automatic Provisioning**: Profiles are created on first access

3. **Email-Based Access**: Intuitive `user=email@example.com` identifier pattern for all endpoints

4. **Strong Ownership**: Users can only access their own data through authenticated, profile-linked ownership chains

5. **Partial Updates**: Efficient updates of individual fields without sending complete objects

6. **Auto-creation**: Person, IdentityDocument, and EmergencyContact records are created if missing during PUT operations

7. **Flexible Deletion**: EmergencyContacts support both single-item deletion (by direct ID) and bulk deletion (by email with array of IDs)

8. **Protection Against Ownership Hijacking**: Relation fields (`profile`) are automatically stripped from user input

9. **Unified Security Model**: All content types use the same `makeProfileFieldController` for consistent behavior and security

10. **Sensitive Data Protection**: Built-in considerations for PII, especially for IdentityDocument data

### Key Differences Between Content Types

| Feature | Person | IdentityDocument | EmergencyContact |
|---------|--------|------------------|------------------|
| **Relationship** | 1:1 with Profile | 1:1 with Profile | 1:N with Profile |
| **Request Body** | Single object | Single object | Array of objects |
| **Use Case** | Personal details | ID verification | Emergency contacts |
| **Update Pattern** | Replace/create one | Replace/create one | Bulk update/create |
| **Response** | Single record | Single record | Array of records |
| **DELETE Support** | ❌ No | ❌ No | ✅ Yes (single & bulk) |
| **DELETE Patterns** | N/A | N/A | Direct ID: `DELETE /api/emergency-contacts/:id`<br>Bulk: `DELETE /api/emergency-contacts/user=email` + body |

### EmergencyContact Special Features

- **Bulk Operations**: Update or delete multiple contacts in a single request
- **Mixed Operations**: Combine updates (items with `id`) and creates (items without `id`) in one PUT request
- **Array Processing**: Each item in the array is independently processed with ownership verification
- **Single Deletion**: Delete specific contacts by direct ID using `DELETE /api/emergency-contacts/:id`
- **Bulk Deletion**: Delete multiple contacts by email using `DELETE /api/emergency-contacts/user=email` with array of IDs in request body
- **Atomic Verification**: For bulk deletes, all permissions verified before any deletion occurs
- **Scalable**: Designed to handle users with many emergency contacts efficiently

