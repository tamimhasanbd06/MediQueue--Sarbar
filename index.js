require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.removeHeader("Content-Security-Policy");
  next();
});

const allowedOrigins = [
  "https://medi-queue-rouge.vercel.app",
  "https://medi-queue-sarbar.vercel.app",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

const port = process.env.PORT || 8000;
const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;

if (!uri) {
  throw new Error("MONGODB_URI missing");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET missing");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const logger = (req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
};

const verifyJWT = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.userId = decoded.id || decoded.userId || decoded._id || decoded.sub;

    if (!req.userId) {
      return res.status(401).json({ message: "Invalid user token" });
    }

    next();
  } catch (err) {
    console.log(err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const buildIdQuery = (id) => {
  try {
    if (ObjectId.isValid(id)) {
      return { _id: new ObjectId(id) };
    }
    return { _id: id };
  } catch {
    return { _id: id };
  }
};

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const todayString = () => new Date().toISOString().slice(0, 10);

const normalizeTutorPayload = (payload = {}, existingTutor = null) => {
  const tutor = { ...payload };

  delete tutor._id;
  delete tutor.creator;

  const availableSlots = toNumber(
    tutor.totalSeats ?? tutor.totalSlot ?? tutor.availableSlots ?? existingTutor?.totalSeats,
    0
  );

  const slotLimit = toNumber(
    tutor.maxStudents ?? tutor.totalSlotLimit ?? existingTutor?.maxStudents,
    availableSlots
  );

  tutor.hourlyFee = toNumber(tutor.hourlyFee ?? existingTutor?.hourlyFee, 0);
  tutor.fee = toNumber(tutor.fee ?? existingTutor?.fee, 0);
  tutor.totalSeats = availableSlots;
  tutor.totalSlot = availableSlots;
  tutor.availableSlots = availableSlots;
  tutor.maxStudents = slotLimit || availableSlots;
  tutor.totalSlotLimit = slotLimit || availableSlots;

  if (tutor.sessionStartDate) {
    tutor.sessionStartDate = String(tutor.sessionStartDate).slice(0, 10);
  }

  return tutor;
};

const restoreSlot = async (tutorsCollection, tutorId) => {
  const tutorQuery = buildIdQuery(tutorId);
  const tutor = await tutorsCollection.findOne(tutorQuery);

  if (!tutor) return;

  const availableSlots = toNumber(tutor.totalSeats ?? tutor.totalSlot, 0);
  const slotLimit = toNumber(tutor.maxStudents ?? tutor.totalSlotLimit, availableSlots + 1);
  const nextSlots = Math.min(availableSlots + 1, slotLimit || availableSlots + 1);

  await tutorsCollection.updateOne(tutorQuery, {
    $set: {
      totalSeats: nextSlots,
      totalSlot: nextSlots,
      availableSlots: nextSlots,
      updatedAt: new Date(),
    },
  });
};

async function run() {
  try {
    console.log("MongoDB Connected");

    const db = client.db("mediqueue");
    const tutorsCollection = db.collection("tutors");
    const profilesCollection = db.collection("profiles");
    const bookedSessionsCollection = db.collection("bookedSessions");

    app.get("/", (req, res) => {
      res.send("Server Running Successfully");
    });

    app.get("/auth/check", logger, verifyJWT, async (req, res) => {
      res.json({ success: true, user: req.user });
    });

    app.get("/profile", logger, verifyJWT, async (req, res) => {
      try {
        const profile = await profilesCollection.findOne({ userId: req.userId });
        res.json({ success: true, user: profile || req.user });
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to fetch profile" });
      }
    });

    app.patch("/profile", logger, verifyJWT, async (req, res) => {
      try {
        const { name, email, image } = req.body;
        const updateData = { updatedAt: new Date() };

        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (image) updateData.image = image;

        await profilesCollection.updateOne(
          { userId: req.userId },
          { $set: { ...updateData, userId: req.userId } },
          { upsert: true }
        );

        res.json({ success: true, message: "Profile updated" });
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Profile update failed" });
      }
    });

    app.get("/tutors", logger, async (req, res) => {
      try {
        const { search = "", subject = "", startDate = "", endDate = "", limit = "" } = req.query;
        const query = {};

        if (search) {
          query.name = { $regex: String(search), $options: "i" };
        }

        if (subject) {
          query.subject = { $regex: String(subject), $options: "i" };
        }

        if (startDate || endDate) {
          query.sessionStartDate = {};
          if (startDate) query.sessionStartDate.$gte = String(startDate).slice(0, 10);
          if (endDate) query.sessionStartDate.$lte = String(endDate).slice(0, 10);
        }

        let cursor = tutorsCollection.find(query).sort({ createdAt: -1 });
        const limitNumber = Number(limit);

        if (Number.isFinite(limitNumber) && limitNumber > 0) {
          cursor = cursor.limit(limitNumber);
        }

        const tutors = await cursor.toArray();
        res.json(Array.isArray(tutors) ? tutors : []);
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to fetch tutors" });
      }
    });

    app.get("/tutors/:id", logger, async (req, res) => {
      try {
        const tutor = await tutorsCollection.findOne(buildIdQuery(req.params.id));

        if (!tutor) {
          return res.status(404).json({ message: "Tutor not found" });
        }

        res.json(tutor);
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.post("/tutors", logger, verifyJWT, async (req, res) => {
      try {
        if (!req.body?.name || !req.body?.subject) {
          return res.status(400).json({ message: "Name and subject required" });
        }

        const tutor = normalizeTutorPayload(req.body);

        tutor.creator = {
          type: "user",
          userId: req.userId || "unknown",
          name: req.user?.name || "Unknown",
          email: req.user?.email || "",
        };

        tutor.createdAt = new Date();
        tutor.updatedAt = new Date();

        const result = await tutorsCollection.insertOne(tutor);

        res.status(201).json({
          success: true,
          insertedId: result.insertedId,
          message: "Tutor created successfully",
        });
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to create tutor" });
      }
    });

    app.get("/my-tutors", logger, verifyJWT, async (req, res) => {
      try {
        const tutors = await tutorsCollection
          .find({ "creator.userId": req.userId })
          .sort({ createdAt: -1 })
          .toArray();

        res.json(Array.isArray(tutors) ? tutors : []);
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to fetch tutors" });
      }
    });

    app.patch("/tutors/:id", logger, verifyJWT, async (req, res) => {
      try {
        const query = buildIdQuery(req.params.id);
        const tutor = await tutorsCollection.findOne(query);

        if (!tutor) {
          return res.status(404).json({ message: "Tutor not found" });
        }

        if (tutor?.creator?.userId !== req.userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const updateData = normalizeTutorPayload(req.body, tutor);
        updateData.updatedAt = new Date();

        const result = await tutorsCollection.updateOne(query, { $set: updateData });
        res.json({ success: true, result, message: "Tutor updated successfully" });
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to update tutor" });
      }
    });

    app.delete("/tutors/:id", logger, verifyJWT, async (req, res) => {
      try {
        const query = buildIdQuery(req.params.id);
        const tutor = await tutorsCollection.findOne(query);

        if (!tutor) {
          return res.status(404).json({ message: "Tutor not found" });
        }

        if (tutor?.creator?.userId !== req.userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        const result = await tutorsCollection.deleteOne(query);
        res.json({ success: true, result, message: "Tutor deleted successfully" });
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Delete failed" });
      }
    });

    app.post("/book-session", logger, verifyJWT, async (req, res) => {
      try {
        const { tutorId, studentName, phone, studentEmail } = req.body;

        if (!tutorId) {
          return res.status(400).json({ message: "Tutor id required" });
        }

        if (!studentName || !phone) {
          return res.status(400).json({ message: "Student name and phone required" });
        }

        const query = buildIdQuery(tutorId);
        const tutor = await tutorsCollection.findOne(query);

        if (!tutor) {
          return res.status(404).json({ message: "Tutor not found" });
        }

        const sessionStartDate = tutor.sessionStartDate ? String(tutor.sessionStartDate).slice(0, 10) : "";

        if (sessionStartDate && todayString() < sessionStartDate) {
          return res.status(400).json({ message: "Booking is not available yet for this tutor" });
        }

        const availableSlots = toNumber(tutor.totalSeats ?? tutor.totalSlot ?? tutor.availableSlots, 0);

        if (availableSlots <= 0) {
          return res.status(400).json({ message: "This session is fully booked. You can’t join at the moment." });
        }

        const alreadyBooked = await bookedSessionsCollection.findOne({
          tutorId: tutor._id.toString(),
          userId: req.userId,
          status: { $ne: "cancelled" },
        });

        if (alreadyBooked) {
          return res.status(400).json({ message: "You already booked this session" });
        }

        const bookedData = {
          tutorId: tutor._id.toString(),
          userId: req.userId,
          studentName,
          phone,
          studentEmail: studentEmail || req.user?.email || "",
          tutorName: tutor.name,
          tutorImage: tutor.photoURL,
          subject: tutor.subject,
          fee: tutor.fee,
          institution: tutor.institution,
          courseDuration: tutor.courseDuration,
          sessionStartDate: tutor.sessionStartDate || "",
          status: "confirmed",
          bookStatus: "confirmed",
          bookedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await bookedSessionsCollection.insertOne(bookedData);
        const nextSlots = availableSlots - 1;

        await tutorsCollection.updateOne(query, {
          $set: {
            totalSeats: nextSlots,
            totalSlot: nextSlots,
            availableSlots: nextSlots,
            updatedAt: new Date(),
          },
        });

        res.status(201).json({
          success: true,
          insertedId: result.insertedId,
          message: "Session booked successfully",
        });
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Booking failed" });
      }
    });

    app.get("/booked-sessions", logger, verifyJWT, async (req, res) => {
      try {
        const sessions = await bookedSessionsCollection
          .find({ userId: req.userId })
          .sort({ createdAt: -1 })
          .toArray();

        res.json(Array.isArray(sessions) ? sessions : []);
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to fetch sessions" });
      }
    });

    app.patch("/booked-sessions/:id", logger, verifyJWT, async (req, res) => {
      try {
        const query = buildIdQuery(req.params.id);
        const session = await bookedSessionsCollection.findOne(query);

        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        if (session.userId !== req.userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        if (session.status === "cancelled") {
          return res.json({ success: true, message: "Session already cancelled" });
        }

        await bookedSessionsCollection.updateOne(query, {
          $set: {
            status: "cancelled",
            bookStatus: "cancelled",
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        });

        await restoreSlot(tutorsCollection, session.tutorId);

        res.json({ success: true, message: "Session cancelled successfully" });
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Cancel failed" });
      }
    });

    app.delete("/booked-sessions/:id", logger, verifyJWT, async (req, res) => {
      try {
        const query = buildIdQuery(req.params.id);
        const session = await bookedSessionsCollection.findOne(query);

        if (!session) {
          return res.status(404).json({ message: "Session not found" });
        }

        if (session.userId !== req.userId) {
          return res.status(403).json({ message: "Forbidden" });
        }

        if (session.status !== "cancelled") {
          await restoreSlot(tutorsCollection, session.tutorId);
        }

        await bookedSessionsCollection.updateOne(query, {
          $set: {
            status: "cancelled",
            bookStatus: "cancelled",
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        });

        res.json({ success: true, message: "Session cancelled successfully" });
      } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Cancel failed" });
      }
    });

    console.log("All routes ready");
  } catch (err) {
    console.log(err);
  }
}

run().catch(console.dir);

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server running on ${port}`);
  });
}

module.exports = app;
