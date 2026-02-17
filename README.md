# Monthly Split

Split monthly expenses with your group. Create groups, add expenses, settle balances, and compare month-over-month spending.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Recharts
- **Backend**: Node.js, Express, MongoDB, JWT

## Local Development

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

### Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. Create `backend/.env`:

   ```
   MONGODB_URI=mongodb://localhost:27017/monthly-split
   JWT_SECRET=your-secret-key
   ```

3. Run backend: `cd backend && npm run dev`
4. Run frontend: `cd frontend && npm run dev`
5. Open http://localhost:3000

## Deploy on Render

1. Push this repo to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repo: `Shubhamkumarpatel70/monthlyspliting`
4. Render will auto-detect `render.yaml` (or set manually):
   - **Build Command**: `npm install && cd frontend && npm install && npm run build && cd ../backend && npm install`
   - **Start Command**: `cd backend && node server.js`
5. Add environment variables:
   - `MONGODB_URI` – MongoDB Atlas connection string
   - `JWT_SECRET` – a random secret string (e.g. `openssl rand -hex 32`)

## License

MIT
