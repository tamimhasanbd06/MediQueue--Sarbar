require("dotenv").config();

const express = require("express");

const cors = require("cors");

const jwt = require("jsonwebtoken");

const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
} = require("mongodb");



const app = express();


//   MIDDLEWARE


app.use(express.json());

app.use(
  cors({
    origin: "https://medi-queue-rouge.vercel.app",
      //  origin: "http://localhost:3000",
    credentials: true,
  })
);


  // PORT


const port =
  process.env.PORT || 8000;


//   MONTHS


const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];


//   MONGODB URI

const uri =
  process.env.MONGODB_URI ||
  process.env.MONGODB_URL;

if (!uri) {
  throw new Error(
    "MONGODB_URI missing"
  );
}

//   MONGODB CLIENT


const client =
  new MongoClient(uri, {
    serverApi: {
      version:
        ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });


  // LOGGER

const logger = (
  req,
  res,
  next
) => {
  console.log(
    `${req.method} ${req.url}`
  );

  next();
};


//   VERIFY JWT


const verifyJWT = (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization ||
      "";

    const token =
      authHeader.startsWith(
        "Bearer "
      )
        ? authHeader.split(" ")[1]
        : null;

    if (!token) {
      return res.status(401).json({
        message:
          "Unauthorized",
      });
    }

    if (
      !process.env.JWT_SECRET
    ) {
      return res.status(500).json({
        message:
          "JWT_SECRET missing",
      });
    }

    const decoded =
      jwt.verify(
        token,
        process.env.JWT_SECRET
      );

    req.user = decoded;

    req.userId =
      decoded.id ||
      decoded.userId ||
      decoded._id ||
      decoded.sub;

    if (!req.userId) {
      return res.status(401).json({
        message:
          "Invalid user token",
      });
    }

    next();
  } catch (err) {
    console.log(err);

    return res.status(401).json({
      message:
        "Invalid or expired token",
    });
  }
};


//   BUILD ID QUERY


const buildIdQuery = (
  id
) => {
  try {
    if (
      ObjectId.isValid(id)
    ) {
      return {
        _id: new ObjectId(id),
      };
    }

    return {
      _id: id,
    };
  } catch {
    return {
      _id: id,
    };
  }
};


//   MAIN FUNCTION


async function run() {
  try {
    await client.connect();

    console.log(
      "MongoDB Connected"
    );

  
//       DATABASE


    const db =
      client.db(
        "mediqueue"
      );

    const tutorsCollection =
      db.collection(
        "tutors"
      );

    const profilesCollection =
      db.collection(
        "profiles"
      );

    const bookedSessionsCollection =
      db.collection(
        "bookedSessions"
      );

    
    //   HOME ROUTE
    

    app.get(
      "/",
      (req, res) => {
        res.send(
          "Server Running Successfully"
        );
      }
    );

    
    //   AUTH CHECK
    

    app.get(
      "/auth/check",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        res.json({
          success: true,
          user:
            req.user,
        });
      }
    );

    
    //   GET PROFILE
    

    app.get(
      "/profile",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const profile =
            await profilesCollection.findOne(
              {
                userId:
                  req.userId,
              }
            );

          res.json({
            success: true,

            user:
              profile ||
              req.user,
          });
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Failed to fetch profile",
          });
        }
      }
    );

    
    //   UPDATE PROFILE
    

    app.patch(
      "/profile",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const {
            name,
            email,
            image,
          } = req.body;

          const updateData =
            {
              updatedAt:
                new Date(),
            };

          if (name)
            updateData.name =
              name;

          if (email)
            updateData.email =
              email;

          if (image)
            updateData.image =
              image;

          await profilesCollection.updateOne(
            {
              userId:
                req.userId,
            },
            {
              $set: {
                ...updateData,
                userId:
                  req.userId,
              },
            },
            {
              upsert: true,
            }
          );

          res.json({
            success: true,

            message:
              "Profile updated",
          });
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Profile update failed",
          });
        }
      }
    );

    
    //   GET ALL TUTORS
    

    app.get(
      "/tutors",
      logger,
      async (
        req,
        res
      ) => {
        try {
          const tutors =
            await tutorsCollection
              .find()
              .sort({
                createdAt:
                  -1,
              })
              .toArray();

          res.json(
            Array.isArray(
              tutors
            )
              ? tutors
              : []
          );
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Failed to fetch tutors",
          });
        }
      }
    );

    
    //   GET SINGLE TUTOR
    

    app.get(
      "/tutors/:id",
      logger,
      async (
        req,
        res
      ) => {
        try {
          const id =
            req.params.id;

          const query =
            buildIdQuery(
              id
            );

          const tutor =
            await tutorsCollection.findOne(
              query
            );

          if (!tutor) {
            return res.status(404).json({
              message:
                "Tutor not found",
            });
          }

          res.json(
            tutor
          );
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Server error",
          });
        }
      }
    );

    
    //   CREATE TUTOR
    

    app.post(
      "/tutors",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const tutor =
            req.body;

          if (
            !tutor.name ||
            !tutor.subject
          ) {
            return res.status(400).json({
              message:
                "Name and subject required",
            });
          }

          tutor.creator =
            {
              type: "user",

              userId:
                req.userId ||
                "unknown",

              name:
                req.user
                  ?.name ||
                "Unknown",

              email:
                req.user
                  ?.email ||
                "",
            };

          tutor.hourlyFee =
            Number(
              tutor.hourlyFee ||
                0
            );

          tutor.totalSeats =
            Number(
              tutor.totalSeats ||
                0
            );

          tutor.maxStudents =
            Number(
              tutor.maxStudents ||
                0
            );

          tutor.fee =
            Number(
              tutor.fee ||
                0
            );

          tutor.createdAt =
            new Date();

          const result =
            await tutorsCollection.insertOne(
              tutor
            );

          res.status(201).json({
            success: true,

            insertedId:
              result.insertedId,

            message:
              "Tutor created successfully",
          });
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Failed to create tutor",
          });
        }
      }
    );

    
    //   MY TUTORS
    

    app.get(
      "/my-tutors",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const tutors =
            await tutorsCollection
              .find({
                "creator.userId":
                  req.userId,
              })
              .sort({
                createdAt:
                  -1,
              })
              .toArray();

          res.json(
            Array.isArray(
              tutors
            )
              ? tutors
              : []
          );
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Failed to fetch tutors",
          });
        }
      }
    );


    //   UPDATE TUTOR
    

    app.patch(
      "/tutors/:id",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const id =
            req.params.id;

          const query =
            buildIdQuery(
              id
            );

          const tutor =
            await tutorsCollection.findOne(
              query
            );

          if (!tutor) {
            return res.status(404).json({
              message:
                "Tutor not found",
            });
          }

          if (
            tutor?.creator
              ?.userId !==
            req.userId
          ) {
            return res.status(403).json({
              message:
                "Forbidden",
            });
          }

          const updateData =
            req.body;

          delete updateData._id;

          delete updateData.creator;

          if (
            updateData.hourlyFee
          ) {
            updateData.hourlyFee =
              Number(
                updateData.hourlyFee
              );
          }

          if (
            updateData.totalSeats
          ) {
            updateData.totalSeats =
              Number(
                updateData.totalSeats
              );
          }

          if (
            updateData.maxStudents
          ) {
            updateData.maxStudents =
              Number(
                updateData.maxStudents
              );
          }

          if (
            updateData.fee
          ) {
            updateData.fee =
              Number(
                updateData.fee
              );
          }

          updateData.updatedAt =
            new Date();

          const result =
            await tutorsCollection.updateOne(
              query,
              {
                $set:
                  updateData,
              }
            );

          res.json({
            success: true,
            result,
          });
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Failed to update tutor",
          });
        }
      }
    );

    
    //   DELETE TUTOR
    

    app.delete(
      "/tutors/:id",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const id =
            req.params.id;

          const query =
            buildIdQuery(
              id
            );

          const tutor =
            await tutorsCollection.findOne(
              query
            );

          if (!tutor) {
            return res.status(404).json({
              message:
                "Tutor not found",
            });
          }

          if (
            tutor?.creator
              ?.userId !==
            req.userId
          ) {
            return res.status(403).json({
              message:
                "Forbidden",
            });
          }

          const result =
            await tutorsCollection.deleteOne(
              query
            );

          res.json({
            success: true,
            result,
          });
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Delete failed",
          });
        }
      }
    );

    
    //   BOOK SESSION
    

    app.post(
      "/book-session",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const {
            tutorId,
          } = req.body;

          if (
            !tutorId
          ) {
            return res.status(400).json({
              message:
                "Tutor id required",
            });
          }

          const query =
            buildIdQuery(
              tutorId
            );

          const tutor =
            await tutorsCollection.findOne(
              query
            );

          if (!tutor) {
            return res.status(404).json({
              message:
                "Tutor not found",
            });
          }

          const currentBooked =
            Number(
              tutor.totalSeats ||
                0
            );

          const maxStudents =
            Number(
              tutor.maxStudents ||
                0
            );

          
          //   SEAT CHECK
          

          if (
            currentBooked >=
            maxStudents
          ) {
            return res.status(400).json({
              message:
                "No seats available",
            });
          }

          
          //   COURSE END CHECK
          

          const currentMonth =
            new Date().toLocaleString(
              "default",
              {
                month:
                  "long",
              }
            );

          const monthIndex =
            months.indexOf(
              currentMonth
            );

          const endMonthIndex =
            months.indexOf(
              tutor.courseEndMonth
            );

          if (
            endMonthIndex !==
              -1 &&
            monthIndex >
              endMonthIndex
          ) {
            return res.status(400).json({
              message:
                "Course already ended",
            });
          }

          
          //   DUPLICATE CHECK
          

          const alreadyBooked =
            await bookedSessionsCollection.findOne(
              {
                tutorId:
                  tutorId,

                userId:
                  req.userId,
              }
            );

          if (
            alreadyBooked
          ) {
            return res.status(400).json({
              message:
                "You already booked this session",
            });
          }

  
         //    BOOK DATA
   

          const bookedData =
            {
              tutorId:
                tutor._id.toString(),

              userId:
                req.userId,

              tutorName:
                tutor.name,

              tutorImage:
                tutor.photoURL,

              subject:
                tutor.subject,

              fee:
                tutor.fee,

              institution:
                tutor.institution,

              courseDuration:
                tutor.courseDuration,

              bookedAt:
                new Date(),

              createdAt:
                new Date(),
            };

          //   INSERT BOOKING
   
          const result =
            await bookedSessionsCollection.insertOne(
              bookedData
            );

           //  UPDATE SEATS
     

          await tutorsCollection.updateOne(
            query,
            {
              $set: {
                totalSeats:
                  currentBooked +
                  1,
              },
            }
          );

          res.status(201).json({
            success: true,

            insertedId:
              result.insertedId,

            message:
              "Session booked successfully",
          });
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Booking failed",
          });
        }
      }
    );


     //  GET BOOKED SESSIONS


    app.get(
      "/booked-sessions",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const sessions =
            await bookedSessionsCollection
              .find({
                userId:
                  req.userId,
              })
              .sort({
                createdAt:
                  -1,
              })
              .toArray();

          res.json(
            Array.isArray(
              sessions
            )
              ? sessions
              : []
          );
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Failed to fetch sessions",
          });
        }
      }
    );


     //  DELETE BOOKED SESSION


    app.delete(
      "/booked-sessions/:id",
      logger,
      verifyJWT,
      async (
        req,
        res
      ) => {
        try {
          const id =
            req.params.id;

          const query =
            buildIdQuery(
              id
            );

          const session =
            await bookedSessionsCollection.findOne(
              query
            );

          if (!session) {
            return res.status(404).json({
              message:
                "Session not found",
            });
          }

          if (
            session.userId !==
            req.userId
          ) {
            return res.status(403).json({
              message:
                "Forbidden",
            });
          }

      
            // UPDATE TUTOR SEATS


          const tutorQuery =
            buildIdQuery(
              session.tutorId
            );

          const tutor =
            await tutorsCollection.findOne(
              tutorQuery
            );

          if (tutor) {
            const currentSeats =
              Number(
                tutor.totalSeats ||
                  0
              );

            await tutorsCollection.updateOne(
              tutorQuery,
              {
                $set: {
                  totalSeats:
                    currentSeats >
                    0
                      ? currentSeats -
                        1
                      : 0,
                },
              }
            );
          }

     
            // DELETE SESSION
   

          await bookedSessionsCollection.deleteOne(
            query
          );

          res.json({
            success: true,

            message:
              "Session cancelled successfully",
          });
        } catch (err) {
          console.log(err);

          res.status(500).json({
            message:
              "Cancel failed",
          });
        }
      }
    );

    console.log(
      "All routes ready"
    );
  } catch (err) {
    console.log(err);
  }
}

run().catch(console.dir);


  //  SERVER LISTEN

app.listen(
  port,
  () => {
    console.log(
      `Server running on ${port}`
    );
  }
);