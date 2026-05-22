const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

const port = process.env.PORT || 8000;

const uri = process.env.MONGODB_URI || "mongodb+srv://mediqueue:ehEJUNyigleIXJCF@cluster0.tbyvjgf.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("mediqueue");
    const tutorsCollection = db.collection("tutors");

    const loggor = (req, res, next) => {
      console.log(`${req.method} | ${req.url}`);
      next();
    };

    // ✅ GET ALL
    app.get("/tutors", async (req, res) => {
      try {
        const result = await tutorsCollection.find().toArray();
        res.json(result);
      } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch tutors" });
      }
    });

    // ✅ GET ONE
    app.get("/tutors/:tutorId", loggor, async (req, res) => {
      try {
        const { tutorId } = req.params;

        // No conversion to ObjectId, keep it as string
        const result = await tutorsCollection.findOne({
          _id: tutorId,
        });

        // ✅ Tutor not found
        if (!result) {
          return res.status(404).json({
            message: "Tutor not found",
          });
        }

        res.json(result);
      } catch (err) {
        console.log(err);
        res.status(500).json({
          error: "Server Error",
        });
      }
    });

    console.log("MongoDB Connected");
  } finally {
    // keep alive
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Tamim Hasan");
});

app.listen(port, () => {
  console.log(`Server running on ${port}`);
});