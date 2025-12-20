require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
  const authHeader = req.headers?.authorization;
  if (!authHeader)
    return res.status(401).send({ message: "Unauthorized Access!" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log("Decoded Email:", decoded.email);
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
    const booksCollection = db.collection("books");
    const ordersCollection = db.collection("orders");
    // const paymentsCollection = db.collection("payments");
    // const wishlistCollection = db.collection("wishlist");

    // Role-based Middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersCollection.findOne({ email });
      if (user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden Access!" });
      }
      next();
    };

    const verifyLibrarian = async (req, res, next) => {
      const email = req.tokenEmail;
      const user = await usersCollection.findOne({ email });
      console.log("Role in middleware:", user?.role); // <-- debug
      if (user?.role !== "librarian" && user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden Access!" });
      }
      next();
    };

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

    // Get User Role
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

    // Get All Published Books (Public) - with search & sort
    app.get("/books", async (req, res) => {
      const { search, sort } = req.query;
      let query = { status: "published" };

      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      let sortOption = {};
      if (sort === "price_asc") sortOption = { price: 1 };
      if (sort === "price_desc") sortOption = { price: -1 };
      if (sort === "newest") sortOption = { createdAt: -1 };

      const books = await booksCollection
        .find(query)
        .sort(sortOption)
        .toArray();
      res.send(books);
    });

    // Get Latest Books (for homepage)
    app.get("/books/latest", async (req, res) => {
      const books = await booksCollection
        .find({ status: "published" })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(books);
    });

    // Get Single Book Details
    app.get("/books/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid book id" });
      }
      const book = await booksCollection.findOne({ _id: new ObjectId(id) });
      if (!book) {
        return res.status(404).send({ message: "Book not found" });
      }
      res.send(book);
    });

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

    // Get My Books (Librarian)
    app.get("/my-books", async (req, res) => {
      console.log("Token email in route:", req.tokenEmail); // <-- debug
      const books = await booksCollection
        .find({ addedBy: req.tokenEmail })
        .toArray();
      res.send(books);
    });

    // Update Book (Librarian)
    app.patch("/books/:id", async (req, res) => {
      const id = req.params.id;

      const book = await booksCollection.findOne({ _id: new ObjectId(id) });

      if (!book) {
        return res.status(404).send({ message: "Book not found" });
      }

      if (book.addedBy !== req.tokenEmail) {
        return res
          .status(403)
          .send({ message: "You can only edit your own books!" });
      }

      const { title, author, price, description, image, status } = req.body;

      const updates = {
        ...(title && { title }),
        ...(author && { author }),
        ...(price && { price }),
        ...(description && { description }),
        ...(image && { image }),
        ...(status && { status }),
        updatedAt: new Date(),
      };

      const result = await booksCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updates }
      );

      res.send(result);
    });

    // ============================================
    // ORDER ROUTES
    // ============================================

    // Place Order
    app.post("/orders", async (req, res) => {
      const order = req.body;
      const book = await booksCollection.findOne({
        _id: new ObjectId(order.bookId),
      });

      const result = await ordersCollection.insertOne({
        ...order,
        userEmail: req.tokenEmail,
        librarianEmail: book.addedBy,
        bookTitle: book.title,
        bookImage: book.image,
        price: book.price,
        orderStatus: "pending",
        paymentStatus: "unpaid",
        orderDate: new Date(),
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
