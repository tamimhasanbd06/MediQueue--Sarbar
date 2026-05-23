const express = require("express");
const cors = require("cors");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");

require("dotenv").config();

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

const port = process.env.PORT || 8000;

const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://mediqueue:ehEJUNyigleIXJCF@cluster0.tbyvjgf.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// =========================
// LOGGER
// =========================
const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`);
  next();
};

// =========================
// AUTH MIDDLEWARE (TEMP)
// =========================
// পরে JWT দিলে replace হবে
const attachUser = (req, res, next) => {
  const tokenUser =
    req.headers["x-user-id"] || null;

  req.userId = tokenUser;
  next();
};

async function run() {
  try {
    await client.connect();

    const db = client.db("mediqueue");
    const tutorsCollection =
      db.collection("tutors");

    // =========================
    // GET ALL TUTORS
    // =========================
    app.get("/tutors", async (req, res) => {
      try {
        const result =
          await tutorsCollection
            .find()
            .toArray();

        res.json(result);
      } catch (err) {
        res.status(500).json({
          message: "Failed to fetch tutors",
        });
      }
    });

    // =========================
    // GET SINGLE TUTOR
    // =========================
    app.get(
      "/tutors/:id",
      logger,
      async (req, res) => {
        try {
          const id = req.params.id;

          const tutor =
            await tutorsCollection.findOne({
              _id: id,
            });

          if (!tutor) {
            return res.status(404).json({
              message: "Tutor not found",
            });
          }

          res.json(tutor);
        } catch (err) {
          res.status(500).json({
            message: "Server error",
          });
        }
      }
    );

    // =========================
    // CREATE TUTOR (FIXED)
    // =========================
    app.post(
      "/tutors",
      logger,
      attachUser,
      async (req, res) => {
        try {
          const tutor = req.body;

          // =========================
          // VALIDATION
          // =========================
          if (!tutor.name || !tutor.subject) {
            return res.status(400).json({
              message:
                "Name & Subject required",
            });
          }

          // =========================
          // CREATOR FIX
          // =========================
          tutor.creator = {
            type: req.userId
              ? "user"
              : "system",
            userId: req.userId || null,
          };

          // default seats safety
          tutor.totalSeats = Number(
            tutor.totalSeats || 0
          );

          tutor.hourlyFee = Number(
            tutor.hourlyFee || 0
          );

          const result =
            await tutorsCollection.insertOne(
              tutor
            );

          res.status(201).json({
            message: "Tutor created",
            insertedId: result.insertedId,
            creator: tutor.creator,
          });
        } catch (err) {
          console.log(err);
          res.status(500).json({
            message: "Failed to create tutor",
          });
        }
      }
    );

    // =========================
    // MY TUTORS (IMPORTANT)
    // =========================
    app.get(
      "/my-tutors",
      attachUser,
      async (req, res) => {
        try {
          const userId = req.userId;

          if (!userId) {
            return res.status(401).json({
              message: "Unauthorized",
            });
          }

          const result =
            await tutorsCollection
              .find({
                "creator.userId": userId,
              })
              .toArray();

          res.json(result);
        } catch (err) {
          res.status(500).json({
            message: "Failed to fetch user tutors",
          });
        }
      }
    );

    // =========================
    // DELETE TUTOR
    // =========================
    app.delete(
      "/tutors/:id",
      attachUser,
      async (req, res) => {
        try {
          const id = req.params.id;

          const result =
            await tutorsCollection.deleteOne({
              _id: id,
            });

          res.json(result);
        } catch (err) {
          res.status(500).json({
            message: "Delete failed",
          });
        }
      }
    );

    // =========================
    // UPDATE TUTOR
    // =========================
    app.patch(
      "/tutors/:id",
      attachUser,
      async (req, res) => {
        try {
          const id = req.params.id;

          const updateData = req.body;

          const result =
            await tutorsCollection.updateOne(
              { _id: id },
              { $set: updateData }
            );

          res.json(result);
        } catch (err) {
          res.status(500).json({
            message: "Update failed",
          });
        }
      }
    );

    console.log("MongoDB Connected");
  } catch (err) {
    console.log(err);
  }
}

run().catch(console.dir);

// =========================
// ROOT
// =========================
app.get("/", (req, res) => {
  res.send("MediQueue Server Running");
});

// =========================
// START SERVER
// =========================
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});