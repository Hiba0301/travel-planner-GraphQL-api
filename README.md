# Travel Planner API

GraphQL API for travel planning with Prisma + SQLite.

## Prerequisites

- Node.js 18+
- npm

## Installation

```bash
npm install
```

## Environment variables

Create a `.env` file at the project root:

```env
DATABASE_URL="file:./prisma/dev.db"
PORT=4000
JWT_SECRET="replace-with-a-strong-secret"
JWT_EXPIRES_IN="7d"
API_CLIENT_ID="travel-client"
API_CLIENT_SECRET="travel-secret"
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=200
```

Notes:
- `JWT_SECRET` is mandatory in production.
- If `JWT_SECRET` is missing, the server starts with a temporary dev secret and prints a warning.

## Database setup

First initialization:

```bash
npx prisma migrate dev --name init
```

Then load demo data:

```bash
npm run seed
```

Optional live import:

```bash
npm run import:live -- --mode reset --limit 10
```
\\data is imported from this kaggle dataset :https://www.kaggle.com/datasets/rkiattisak/traveler-trip-data
## Run API

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm start
```

Endpoints:
- HTTP GraphQL: `http://localhost:4000/graphql`
- WebSocket subscriptions: `ws://localhost:4000/graphql`
-prisma studio: npx prisma studio

## Petite interface cliente React (Phase 2)

Une interface React a ete ajoutee dans le dossier `client/` pour demonstrer la fonctionnalite demandee dans le PDF.

Fonctionnalites dans le client:
- Saisie des client credentials (`x-client-id`, `x-client-secret`)
- Login utilisateur (`login`) avec JWT
- Dashboard (`me`, `tripStats`, `myTrips`)
- Recherche de destinations (`searchDestinations`)
- Creation de trip (`createTrip`)

Lancer le client:

```bash
npm run client:dev
```

Puis ouvrir:

- `http://localhost:5173`

Build production du client:

```bash
npm run client:build
```

Note:
- Le serveur API doit tourner en parallele (`npm run dev` ou `npm start`).
- URL API configuree par defaut vers `http://localhost:4000/graphql` (modifiable via variable `VITE_API_URL`).

---

## Phase 2 delivered

### 1) API security hardening

Conformity with PDF Phase 2:
- Security option selected: Option 1 (client credentials in requests).

- JWT authentication added for HTTP and WebSocket contexts.
- Mandatory client credentials added on all GraphQL requests:
  - HTTP headers: `x-client-id`, `x-client-secret`
  - WebSocket connection params: `clientId`, `clientSecret`
- Passwords are now hashed with `bcryptjs` during registration/user creation.
- Login flow added with JWT token generation.
- Authorization checks (ownership-based) added on sensitive operations:
  - Own profile only (`user`, `me`, `updateMyProfile`)
  - Own trips only (`tripsByUser`, `myTrips`, `tripStats`, mutation protections)
  - Own bookings only (`bookings`, `bookingsByUser`, `myBookings`, booking status update)
  - Subscription access requires authenticated user.
- Input validation added:
  - Email format
  - Minimum password length
  - Date coherence (`startDate <= endDate`, `arrivalDate <= departureDate`)
- Rate limiting added on `/graphql` via `express-rate-limit`.

### 2) Additional features

New GraphQL types:
- `AuthPayload`
- `TripStats`

New queries:
- `me`
- `myTrips(status, limit, offset, sortBy, sortOrder)`
- `myBookings(status)`
- `tripStats`
- `searchDestinations(keyword, country)`

New mutations:
- `register(name, email, password, avatar)`
- `login(email, password)`
- `updateMyProfile(name, avatar)`

Behavior update on existing mutations:
- `createTrip`: now binds trip ownership to authenticated user.
- `createBooking`: now binds booking ownership to authenticated user.
- `addReview`: requires that authenticated user has a booking on the related trip.

---

## Auth usage

### 1) Register

```graphql
mutation Register {
  register(
    name: "Hiba"
    email: "hiba@example.com"
    password: "StrongPass123"
    avatar: "https://i.pravatar.cc/150?img=5"
  ) {
    id
    name
    email
  }
}
```

### 2) Login

```graphql
mutation Login {
  login(email: "hiba@example.com", password: "StrongPass123") {
    token
    user {
      id
      name
      email
    }
  }
}
```

### 3) Send token

Add this HTTP header in your GraphQL client:

```http
Authorization: Bearer <JWT_TOKEN>
```

Add mandatory client credentials headers too:

```http
x-client-id: <API_CLIENT_ID>
x-client-secret: <API_CLIENT_SECRET>
```

For GraphQL WebSocket subscriptions, provide in connection params:

```json
{
  "authorization": "Bearer <JWT_TOKEN>",
  "clientId": "<API_CLIENT_ID>",
  "clientSecret": "<API_CLIENT_SECRET>"
}
```

---

## Phase 2 test queries

### Get current user

```graphql
query Me {
  me {
    id
    name
    email
    trips {
      id
      title
      status
    }
  }
}
```

### Create trip (authenticated)

```graphql
mutation CreateTrip {
  createTrip(
    title: "Spring in Spain"
    description: "Barcelona + Valencia"
    budget: 1800
    currency: "EUR"
    startDate: "2026-05-10"
    endDate: "2026-05-18"
  ) {
    id
    title
    status
    user {
      id
      email
    }
  }
}
```

### User statistics

```graphql
query TripStats {
  tripStats {
    totalTrips
    plannedTrips
    ongoingTrips
    completedTrips
    totalBudget
    averageBudget
  }
}
```

### Search destinations

```graphql
query SearchDestinations {
  searchDestinations(keyword: "tok", country: "Japan") {
    id
    name
    city
    country
  }
}
```

---

## Existing scripts

- `npm run dev`: start API with nodemon
- `npm start`: start API with node
- `npm run seed`: seed database
- `npm run studio`: open Prisma Studio
- `npm run import:external`: import from JSON/CSV file or URL
- `npm run import:live`: import from external live APIs (RandomUser + RestCountries)
