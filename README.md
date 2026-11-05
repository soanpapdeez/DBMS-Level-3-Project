# Digital Event Ticket Reservation & Anti-Scalping Engine

DBMS Level 3 project by Sujay P Nayak and Sohan MR.

## Tech stack

- Next.js
- PostgreSQL for users, events, seats, bookings, tickets and payments
- MongoDB for purchase attempts and bot-detection logs

## Setup

Node.js 20.19 or later and Docker are required.

1. Install the packages:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local`, then set `JWT_SECRET`.

3. Start the databases:

   ```bash
   docker compose up -d
   ```

4. Load the SQL files in this order:

   ```bash
   docker compose exec postgres psql -U ticket -d ticket_engine -v ON_ERROR_STOP=1 -f /db/schema.sql
   docker compose exec postgres psql -U ticket -d ticket_engine -v ON_ERROR_STOP=1 -f /db/procedures.sql
   docker compose exec postgres psql -U ticket -d ticket_engine -v ON_ERROR_STOP=1 -f /db/triggers.sql
   docker compose exec postgres psql -U ticket -d ticket_engine -v ON_ERROR_STOP=1 -f /db/seed.sql
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

Open http://localhost:3000.