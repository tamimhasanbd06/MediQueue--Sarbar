# MediQueue Server

Backend API for the MediQueue platform. This server manages tutor sessions, user profiles, authentication, session bookings, and slot management using Express.js, MongoDB, and JWT authentication.

## 🚀 Live Features

- JWT Authentication & Authorization
- User Profile Management
- Tutor Session Management (CRUD)
- Protected Private Routes
- Session Booking System
- Automatic Seat/Slot Management
- Booking Cancellation & Seat Restoration
- Search Tutors by Name
- Filter Tutors by Subject
- Filter Tutors by Date Range
- MongoDB Database Integration
- RESTful API Architecture
- CORS Configuration
- Environment Variable Security

---

## 🛠️ Technologies Used

- Node.js
- Express.js
- MongoDB
- JWT (jsonwebtoken)
- CORS
- Dotenv

---

## 📂 Project Structure

```bash
├── server.js
├── package.json
├── .env
├── node_modules
└── README.md
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory and add the following:

```env
PORT=8000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_jwt_secret_key

CLIENT_URL=http://localhost:3000
```

---

## 📦 Installation

### Clone Repository

```bash
git clone https://github.com/your-username/mediqueue-server.git
```

### Navigate to Project

```bash
cd mediqueue-server
```

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Run Production Server

```bash
npm start
```

---

## 🔐 Authentication

Protected routes require JWT Token:

```http
Authorization: Bearer YOUR_TOKEN
```

---

# 📌 API Endpoints

## Root Route

### GET /

Returns server status.

```http
GET /
```

Response:

```json
"Server Running Successfully"
```

---

# 👤 Profile Routes

## Get User Profile

```http
GET /profile
```

Protected Route ✅

---

## Update Profile

```http
PATCH /profile
```

Protected Route ✅

Body:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "image": "profile-image-url"
}
```

---

# 🎓 Tutor Routes

## Get All Tutors

```http
GET /tutors
```

Query Parameters:

| Parameter | Description |
|------------|-------------|
| search | Search by tutor name |
| subject | Filter by subject |
| startDate | Filter start date |
| endDate | Filter end date |
| limit | Limit results |

Example:

```http
GET /tutors?subject=Math&limit=6
```

---

## Get Single Tutor

```http
GET /tutors/:id
```

---

## Create Tutor

```http
POST /tutors
```

Protected Route ✅

Example Body:

```json
{
  "name": "John Smith",
  "subject": "Mathematics",
  "hourlyFee": 20,
  "fee": 100,
  "totalSeats": 10,
  "sessionStartDate": "2026-01-01"
}
```

---

## Update Tutor

```http
PATCH /tutors/:id
```

Protected Route ✅

Only tutor creator can update.

---

## Delete Tutor

```http
DELETE /tutors/:id
```

Protected Route ✅

Only tutor creator can delete.

---

## Get My Tutors

```http
GET /my-tutors
```

Protected Route ✅

Returns all tutors created by logged-in user.

---

# 📚 Session Booking Routes

## Book Session

```http
POST /book-session
```

Protected Route ✅

Example Body:

```json
{
  "tutorId": "tutor_id",
  "studentName": "Tamim Hasan",
  "phone": "017xxxxxxxx",
  "studentEmail": "tamim@example.com"
}
```

Features:

- Prevents duplicate bookings
- Checks seat availability
- Auto decreases available seats
- Prevents booking before session start date

---

## Get My Booked Sessions

```http
GET /booked-sessions
```

Protected Route ✅

Returns all booked sessions for current user.

---

## Cancel Session

```http
PATCH /booked-sessions/:id
```

Protected Route ✅

Features:

- Marks booking as cancelled
- Restores tutor seat automatically

---

## Cancel Session (Alternative)

```http
DELETE /booked-sessions/:id
```

Protected Route ✅

Features:

- Cancels booking
- Restores seat count

---

# 🔒 Security Features

- JWT Verification Middleware
- Protected Routes
- User Ownership Validation
- Environment Variable Protection
- MongoDB ObjectId Validation
- Secure Authentication Flow

---

# 📊 Database Collections

### tutors

Stores tutor session information.

### profiles

Stores user profile data.

### bookedSessions

Stores booked session records.

---

# 🔄 Booking Workflow

1. User logs in.
2. User views available tutors.
3. User books a session.
4. Seat count decreases automatically.
5. User cancels booking.
6. Seat count restores automatically.

---

# 🌐 CORS Configuration

Allowed Origins:

```javascript
[
  "https://medi-queue-rouge.vercel.app",
  "https://medi-queue-sarbar.vercel.app",
  "http://localhost:3000"
]
```

---

# 🚀 Deployment

Suitable Platforms:

- Vercel (Frontend)
- Render
- Railway
- Cyclic
- VPS
- DigitalOcean

---

# 👨‍💻 Author

Tamim Hasan

Backend Developer | MERN Stack Developer

---

## ⭐ Project Highlights

- Clean REST API Architecture
- Secure JWT Authentication
- Smart Booking System
- Automatic Slot Management
- MongoDB Integration
- Scalable Backend Structure
- Production Ready