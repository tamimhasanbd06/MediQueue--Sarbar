const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
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
  process.env.MONGODB_URL;

if (!uri) {
  throw new Error(
    "MONGODB_URI or MONGODB_URL missing"
  );
}

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
// JWT AUTH MIDDLEWARE
// =========================
const verifyJWT = (req, res, next) => {
  const authHeader =
    req.headers.authorization || "";

  const token =
    authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      message: "JWT_SECRET missing",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;
    req.userId = decoded.id;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

// =========================
// MONGO ID HELPER
// =========================
const buildIdQuery = (id) => {
  if (ObjectId.isValid(id)) {
    return {
      _id: new ObjectId(id),
    };
  }

  return {
    _id: id,
  };
};

// =========================
// USER FILTER HELPER
// =========================
const buildUserFilter = (req) => {
  const filters = [];

  if (req.userId) {
    filters.push({
      id: req.userId,
    });
  }

  if (req.userId && ObjectId.isValid(req.userId)) {
    filters.push({
      _id: new ObjectId(req.userId),
    });
  }

  if (req.user?.email) {
    filters.push({
      email: req.user.email,
    });
  }

  return {
    $or: filters,
  };
};

// =========================
// SAFE PROFILE DATA
// =========================
const getSafeProfileData = (body) => {
  const updateData = {};

  if (typeof body.name === "string") {
    updateData.name = body.name.trim();
  }

  if (typeof body.email === "string") {
    updateData.email = body.email.trim();
  }

  if (typeof body.image === "string") {
    updateData.image = body.image.trim();
  }

  updateData.updatedAt = new Date();

  return updateData;
};

async function run() {
  try {
    await client.connect();

    const db = client.db("mediqueue");

    const tutorsCollection =
      db.collection("tutors");

    // Better Auth usually uses user collection.
    const userCollection =
      db.collection("user");

    // Fallback if your database has users collection.
    const usersCollection =
      db.collection("users");

    // Extra profile collection for safe profile updates.
    const profilesCollection =
      db.collection("profiles");

    // =========================
    // FIND AUTH USER HELPER
    // =========================
    const findAuthUser = async (filter) => {
      let authUser =
        await userCollection.findOne(filter);

      if (authUser) {
        return {
          authUser,
          collection: userCollection,
        };
      }

      authUser =
        await usersCollection.findOne(filter);

      if (authUser) {
        return {
          authUser,
          collection: usersCollection,
        };
      }

      return {
        authUser: null,
        collection: userCollection,
      };
    };

    // =========================
    // AUTH CHECK
    // =========================
    app.get(
      "/auth/check",
      logger,
      verifyJWT,
      async (req, res) => {
        res.json({
          success: true,
          user: req.user,
        });
      }
    );

    // =========================
    // GET PROFILE
    // =========================
    app.get(
      "/profile",
      logger,
      verifyJWT,
      async (req, res) => {
        try {
          const filter = buildUserFilter(req);

          const { authUser } =
            await findAuthUser(filter);

          const savedProfile =
            await profilesCollection.findOne({
              userId: req.userId,
            });

          const user = {
            id:
              authUser?.id ||
              req.userId ||
              "",
            name:
              savedProfile?.name ||
              authUser?.name ||
              req.user?.name ||
              "",
            email:
              savedProfile?.email ||
              authUser?.email ||
              req.user?.email ||
              "",
            image:
              savedProfile?.image ||
              authUser?.image ||
              req.user?.image ||
              "",
          };

          res.json({
            success: true,
            user,
          });
        } catch (err) {
          res.status(500).json({
            message: "Failed to fetch profile",
          });
        }
      }
    );

    // =========================
    // UPDATE PROFILE
    // =========================
    app.patch(
      "/profile",
      logger,
      verifyJWT,
      async (req, res) => {
        try {
          const updateData =
            getSafeProfileData(req.body);

          if (
            !updateData.name &&
            !updateData.email &&
            !updateData.image
          ) {
            return res.status(400).json({
              message:
                "Name, email or image is required",
            });
          }

          const filter = buildUserFilter(req);

          const { authUser, collection } =
            await findAuthUser(filter);

          // Update Better Auth user document if found.
          if (authUser) {
            await collection.updateOne(
              filter,
              {
                $set: updateData,
              }
            );
          }

          // Always save profile copy safely.
          await profilesCollection.updateOne(
            {
              userId: req.userId,
            },
            {
              $set: {
                ...updateData,
                userId: req.userId,
              },
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            {
              upsert: true,
            }
          );

          const savedProfile =
            await profilesCollection.findOne({
              userId: req.userId,
            });

          const user = {
            id:
              authUser?.id ||
              req.userId ||
              "",
            name:
              savedProfile?.name ||
              updateData.name ||
              authUser?.name ||
              req.user?.name ||
              "",
            email:
              savedProfile?.email ||
              updateData.email ||
              authUser?.email ||
              req.user?.email ||
              "",
            image:
              savedProfile?.image ||
              updateData.image ||
              authUser?.image ||
              req.user?.image ||
              "",
          };

          res.json({
            success: true,
            message: "Profile updated",
            user,
          });
        } catch (err) {
          res.status(500).json({
            message: "Profile update failed",
          });
        }
      }
    );

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
      verifyJWT,
      async (req, res) => {
        try {
          const id = req.params.id;

          const tutor =
            await tutorsCollection.findOne(
              buildIdQuery(id)
            );

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
    // CREATE TUTOR
    // JWT PROTECTED
    // =========================
    app.post(
      "/tutors",
      logger,
      verifyJWT,
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
          // CREATOR FROM JWT
          // =========================
          tutor.creator = {
            type: "user",
            userId: req.userId,
            name: req.user?.name || "",
            email: req.user?.email || "",
            image: req.user?.image || "",
          };

          tutor.totalSeats = Number(
            tutor.totalSeats || 0
          );

          tutor.hourlyFee = Number(
            tutor.hourlyFee || 0
          );

          tutor.maxStudents = Number(
            tutor.maxStudents ||
              tutor.totalSeats ||
              0
          );

          tutor.fee = Number(
            tutor.fee || 0
          );

          tutor.createdAt = new Date();

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
    // MY TUTORS
    // JWT PROTECTED
    // =========================
    app.get(
      "/my-tutors",
      logger,
      verifyJWT,
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
            message:
              "Failed to fetch user tutors",
          });
        }
      }
    );

    // =========================
    // DELETE TUTOR
    // JWT PROTECTED
    // =========================
    app.delete(
      "/tutors/:id",
      logger,
      verifyJWT,
      async (req, res) => {
        try {
          const id = req.params.id;
          const query = buildIdQuery(id);

          const tutor =
            await tutorsCollection.findOne(query);

          if (!tutor) {
            return res.status(404).json({
              message: "Tutor not found",
            });
          }

          if (
            tutor?.creator?.userId !==
            req.userId
          ) {
            return res.status(403).json({
              message: "Forbidden",
            });
          }

          const result =
            await tutorsCollection.deleteOne(
              query
            );

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
    // JWT PROTECTED
    // =========================
    app.patch(
      "/tutors/:id",
      logger,
      verifyJWT,
      async (req, res) => {
        try {
          const id = req.params.id;
          const query = buildIdQuery(id);

          const tutor =
            await tutorsCollection.findOne(query);

          if (!tutor) {
            return res.status(404).json({
              message: "Tutor not found",
            });
          }

          if (
            tutor?.creator?.userId !==
            req.userId
          ) {
            return res.status(403).json({
              message: "Forbidden",
            });
          }

          const updateData = req.body;

          delete updateData._id;
          delete updateData.creator;

          if (updateData.hourlyFee) {
            updateData.hourlyFee = Number(
              updateData.hourlyFee
            );
          }

          if (updateData.totalSeats) {
            updateData.totalSeats = Number(
              updateData.totalSeats
            );
          }

          if (updateData.maxStudents) {
            updateData.maxStudents = Number(
              updateData.maxStudents
            );
          }

          if (updateData.fee) {
            updateData.fee = Number(
              updateData.fee
            );
          }

          updateData.updatedAt = new Date();

          const result =
            await tutorsCollection.updateOne(
              query,
              {
                $set: updateData,
              }
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