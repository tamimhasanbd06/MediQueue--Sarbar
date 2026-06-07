# MediQueue Server

Backend API for the MediQueue – Tutor Booking System.

## Features

- JWT protected private API routes
- Tutor CRUD API
- Case-insensitive tutor search using MongoDB `$regex`
- Tutor date filtering using MongoDB `$gte` and `$lte`
- Booking API with session date restriction
- Auto slot decrease after successful booking
- Cancel booking using PATCH status update
- Logged-in user specific booked session list

## Environment Variables

Create a `.env` file from `.env.example` and fill in your own values.

```env
PORT=8000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:3000
```

## Install

```bash
npm install
```

## Run Locally

```bash
npm start
```

## Main API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/` | Server health check |
| GET | `/tutors` | Get tutors with search, filter, and limit |
| GET | `/tutors/:id` | Get tutor details |
| POST | `/tutors` | Add tutor |
| PATCH | `/tutors/:id` | Update tutor |
| DELETE | `/tutors/:id` | Delete tutor |
| GET | `/my-tutors` | Get logged-in user's tutors |
| POST | `/book-session` | Book a tutor session |
| GET | `/booked-sessions` | Get logged-in user's booked sessions |
| PATCH | `/booked-sessions/:id` | Cancel booked session |

## Deployment

Use Render, Vercel serverless, or any Node.js hosting service. Add the same environment variables in the hosting dashboard.
