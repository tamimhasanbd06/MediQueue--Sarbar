const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

const port = process.env.PORT || 8000;

const uri = "mongodb+srv://mediqueue:ehEJUNyigleIXJCF@cluster0.tbyvjgf.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db("mediqueue");
    const tutorsCollection = db.collection("tutors");

    // ✅ GET ALL
    app.get("/tutors", async (req, res) => {
      try {
        const result = await tutorsCollection.find().toArray();
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch tutors" });
      }
    });

    // ✅ GET ONE
    app.get("/tutors/:tutorId", async (req, res) => {
      try {
        const { tutorId } = req.params;
        const result = await tutorsCollection.findOne({
          _id: new ObjectId(tutorId),
        });
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: "Tutor not found" });
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