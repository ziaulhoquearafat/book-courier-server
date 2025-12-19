require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const admin = require("firebase-admin");
const port = process.env.PORT || 3000;
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf-8"
);
const serviceAccount = JSON.parse(decoded);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
// middleware
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(express.json());

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("bookCourierDB");
    const usersCollection = db.collection("users");
    const booksCollections = db.collection("books");
    const ordersCollections = db.collection("orders");
    const paymentsCollection = db.collection("payments");
    const wishlistCollection = db.collection("wishlist");

    // Create/Update User on Registration/Login
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }

      const result = await usersCollection.insertOne({
        ...user,
        role: "user",
        createdAt: new Date(),
      });
      res.send(result);
    });

    // // Get User Role
    // app.get("/users/:email/role", async (req, res) => {
    //   const email = req.params.email;
    //   if (email !== req.tokenEmail) {
    //     return res.status(403).send({ message: "Forbidden Access!" });
    //   }
    //   const user = await usersCollection.findOne({ email });
    //   res.send({ role: user?.role || "user" });
    // });

    // Update User Profile
    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      if (email !== req.tokenEmail) {
        return res.status(403).send({ message: "Forbidden Access!" });
      }
      const { name, image } = req.body;
      const result = await usersCollection.updateOne(
        { email },
        { $set: { name, image, updatedAt: new Date() } }
      );
      res.send(result);
    });

    // ============================================
    // BOOK ROUTES
    // ============================================

    // Add Book (Librarian Only)
    app.post("/books", async (req, res) => {
      const book = req.body;
      const result = await booksCollection.insertOne({
        ...book,
        addedBy: req.tokenEmail,
        createdAt: new Date(),
        ratings: [],
      });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Book Courier Server Is Running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
