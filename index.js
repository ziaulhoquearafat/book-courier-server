// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const admin = require("firebase-admin");
// const port = process.env.PORT || 3000;

// // Firebase Admin Setup
// let serviceAccount;

// if (process.env.FIREBASE_PRIVATE_KEY) {
//   serviceAccount = {
//     type: "service_account",
//     project_id: process.env.FIREBASE_PROJECT_ID,
//     private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//     client_email: process.env.FIREBASE_CLIENT_EMAIL,
//   };
// } else {
//   serviceAccount = require("./serviceAccountKey.json");
// }

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// const app = express();
// // middleware
// app.use(
//   cors({
//     origin: [process.env.CLIENT_DOMAIN],
//     credentials: true,
//     optionSuccessStatus: 200,
//   })
// );
// app.use(express.json());

// // jwt middlewares
// const verifyJWT = async (req, res, next) => {
//   try {
//     const authHeader = req.headers.authorization;
//     if (!authHeader) return res.status(401).send({ message: "Unauthorized" });

//     const token = authHeader.split(" ")[1]; // "Bearer <token>"
//     const decoded = await admin.auth().verifyIdToken(token);

//     console.log("Decoded token:", decoded);

//     req.tokenEmail = decoded.email;
//     next();
//   } catch (error) {
//     console.error("JWT Error:", error.message);
//     res.status(401).send({ message: "Invalid token" });
//   }
// };

// // Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(process.env.MONGODB_URI, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   },
// });

// async function run() {
//   try {
//     await client.connect();
//     console.log("✅ Connected to MongoDB!");

//     const db = client.db("bookCourierDB");
//     const usersCollection = db.collection("users");
//     const booksCollection = db.collection("books");
//     const ordersCollection = db.collection("orders");
//     const paymentsCollection = db.collection("payments");
//     const wishlistCollection = db.collection("wishlist");

//     // Role-based Middleware
//     const verifyAdmin = async (req, res, next) => {
//       const email = req.tokenEmail;
//       const user = await usersCollection.findOne({ email });
//       if (user?.role !== "admin") {
//         return res.status(403).send({ message: "Forbidden Access!" });
//       }
//       next();
//     };

//     const verifyLibrarian = async (req, res, next) => {
//       const email = req.tokenEmail;
//       const user = await usersCollection.findOne({ email });

//       // check librarian or admin
//       if (!user || (user.role !== "librarian" && user.role !== "admin")) {
//         return res.status(403).send({ message: "Forbidden Access!" });
//       }

//       req.userRole = user.role; // optional: route এ role দরকার হলে
//       next();
//     };

//     // ============================================
//     // AUTH ROUTES
//     // ============================================

//     // Create/Update User on Registration/Login
//     app.post("/users", async (req, res) => {
//       const user = req.body;
//       const query = { email: user.email };
//       const existingUser = await usersCollection.findOne(query);

//       if (existingUser) {
//         return res.send({ message: "User already exists", insertedId: null });
//       }

//       const result = await usersCollection.insertOne({
//         ...user,
//         role: "user",
//         createdAt: new Date(),
//       });

//       res.send(result);
//     });

//     // Get User Role
//     app.get("/users/:email/role", verifyJWT, async (req, res) => {
//       const email = req.params.email;

//       // Email mismatch check
//       if (email !== req.tokenEmail) {
//         return res.status(403).send({ message: "Forbidden Access!" });
//       }

//       const user = await usersCollection.findOne({ email });
//       res.send({ role: user?.role || "user" });
//     });

//     // Update User Profile
//     app.patch("/users/:email", verifyJWT, async (req, res) => {
//       const email = req.params.email;

//       if (email !== req.tokenEmail) {
//         return res.status(403).send({ message: "Forbidden Access!" });
//       }

//       const { name, image } = req.body;

//       const result = await usersCollection.updateOne(
//         { email },
//         { $set: { name, image, updatedAt: new Date() } }
//       );

//       res.send(result);
//     });

//     // ============================================
//     // BOOK ROUTES
//     // ============================================

//     // Get All Published Books (Public) - with search, sort & pagination
//     app.get("/books", async (req, res) => {
//       const { search, sort } = req.query;
//       let query = { status: "published" };
//       if (search) {
//         query.title = { $regex: search, $options: "i" };
//       }
//       let sortOption = {};
//       if (sort === "price_asc") sortOption = { price: 1 };
//       if (sort === "price_desc") sortOption = { price: -1 };
//       if (sort === "newest") sortOption = { createdAt: -1 };
//       const books = await booksCollection
//         .find(query)
//         .sort(sortOption)
//         .toArray();
//       res.send(books);
//     });

//     // Get Latest Books (for homepage)
//     app.get("/books/latest", async (req, res) => {
//       try {
//         const books = await booksCollection
//           .find({ status: "published" })
//           .sort({ createdAt: -1 })
//           .limit(8)
//           .toArray();

//         res.send(books);
//       } catch (error) {
//         console.error("Latest books error:", error);
//         res.status(500).send({ message: "Failed to fetch latest books" });
//       }
//     });

//     // Get Single Book Details
//     app.get("/books/:id", async (req, res) => {
//       const { id } = req.params;
//       if (!ObjectId.isValid(id)) {
//         return res.status(400).send({ message: "Invalid book id" });
//       }
//       const book = await booksCollection.findOne({ _id: new ObjectId(id) });
//       if (!book) {
//         return res.status(404).send({ message: "Book not found" });
//       }
//       res.send(book);
//     });

//     // Add Book (Librarian Only)
//     app.post("/books", verifyJWT, verifyLibrarian, async (req, res) => {
//       try {
//         const book = req.body;

//         const result = await booksCollection.insertOne({
//           ...book,
//           addedBy: req.tokenEmail,
//           status: "unpublished", // 🔥 MUST
//           ratings: [],
//           createdAt: new Date(),
//         });

//         res.send(result);
//       } catch (error) {
//         console.error("Add book error:", error);
//         res.status(500).send({ message: "Failed to add book" });
//       }
//     });

//     // Get My Books (Librarian)
//     app.get("/my-books", verifyJWT, verifyLibrarian, async (req, res) => {
//       // console.log("Token email in route:", req.tokenEmail);
//       const books = await booksCollection
//         .find({ addedBy: req.tokenEmail })
//         .toArray();
//       res.send(books);
//     });

//     // Update Book (Librarian)
//     app.patch("/books/:id", verifyJWT, verifyLibrarian, async (req, res) => {
//       const id = req.params.id;

//       const book = await booksCollection.findOne({ _id: new ObjectId(id) });

//       if (!book) {
//         return res.status(404).send({ message: "Book not found" });
//       }

//       if (book.addedBy !== req.tokenEmail) {
//         return res
//           .status(403)
//           .send({ message: "You can only edit your own books!" });
//       }

//       const { title, author, price, description, image, status } = req.body;

//       const updates = {
//         ...(title && { title }),
//         ...(author && { author }),
//         ...(price && { price }),
//         ...(description && { description }),
//         ...(image && { image }),
//         ...(status && { status }),
//         updatedAt: new Date(),
//       };

//       const result = await booksCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: updates }
//       );

//       res.send(result);
//     });

//     // Get All Books (Admin - including unpublished)
//     app.get("/all-books", verifyJWT, verifyAdmin, async (req, res) => {
//       const books = await booksCollection.find().toArray();
//       res.send(books);
//     });

//     // Publish / Unpublish Book (Admin)
//     app.patch("/books/:id/status", verifyJWT, verifyAdmin, async (req, res) => {
//       try {
//         const id = req.params.id;
//         const { isPublished } = req.body;

//         if (typeof isPublished !== "boolean") {
//           return res.status(400).send({ message: "Invalid status value" });
//         }

//         const result = await booksCollection.updateOne(
//           { _id: new ObjectId(id) },
//           {
//             $set: {
//               status: isPublished ? "published" : "unpublished",
//               updatedAt: new Date(),
//             },
//           }
//         );

//         res.send(result);
//       } catch (error) {
//         console.error("Publish book error:", error);
//         res.status(500).send({ message: "Failed to update book status" });
//       }
//     });

//     // Delete Book (Admin)
//     app.delete("/books/:id", verifyJWT, verifyAdmin, async (req, res) => {
//       const id = req.params.id;
//       // Delete book
//       const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
//       // Delete all orders for this book
//       await ordersCollection.deleteMany({ bookId: new ObjectId(id) });
//       res.send(result);
//     });

//     // ============================================
//     // ORDER ROUTES
//     // ============================================

//     // Place Order
//     app.post("/orders", verifyJWT, async (req, res) => {
//       const order = req.body;
//       const book = await booksCollection.findOne({
//         _id: new ObjectId(order.bookId),
//       });

//       const result = await ordersCollection.insertOne({
//         ...order,
//         userEmail: req.tokenEmail,
//         librarianEmail: book.addedBy,
//         bookTitle: book.title,
//         bookImage: book.image,
//         price: book.price,
//         orderStatus: "pending",
//         paymentStatus: "unpaid",
//         orderDate: new Date(),
//       });
//       res.send(result);
//     });

//     // Get My Orders (User)
//     app.get("/my-orders", verifyJWT, async (req, res) => {
//       try {
//         const orders = await ordersCollection
//           .find({ userEmail: req.tokenEmail })
//           .sort({ orderDate: -1 })
//           .toArray();

//         res.send(orders);
//       } catch (error) {
//         console.error("Get my orders error:", error);
//         res.status(500).send({ message: "Failed to get orders" });
//       }
//     });

//     // Cancel Order (User)
//     app.patch("/orders/:id/cancel", verifyJWT, async (req, res) => {
//       const id = req.params.id;
//       const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

//       if (order.userEmail !== req.tokenEmail) {
//         return res.status(403).send({ message: "Forbidden!" });
//       }

//       if (order.orderStatus !== "pending") {
//         return res.status(400).send({ message: "Cannot cancel this order!" });
//       }

//       const result = await ordersCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: { orderStatus: "cancelled" } }
//       );
//       res.send(result);
//     });

//     // Get Librarian Orders
//     app.get(
//       "/librarian-orders",
//       verifyJWT,
//       verifyLibrarian,
//       async (req, res) => {
//         try {
//           const orders = await ordersCollection
//             .find({ librarianEmail: req.tokenEmail })
//             .sort({ orderDate: -1 })
//             .toArray();

//           res.send(orders);
//         } catch (error) {
//           console.error("Get librarian orders error:", error);
//           res.status(500).send({ message: "Failed to get orders" });
//         }
//       }
//     );

//     // Update Order Status (Librarian)
//     app.patch(
//       "/orders/:id/status",
//       verifyJWT,
//       verifyLibrarian,
//       async (req, res) => {
//         try {
//           const id = req.params.id;
//           const { orderStatus } = req.body;

//           // 1️⃣ Allowed status list
//           const allowedStatus = [
//             "pending",
//             "shipped",
//             "delivered",
//             "cancelled",
//           ];

//           if (!allowedStatus.includes(orderStatus)) {
//             return res.status(400).send({ message: "Invalid order status" });
//           }

//           // 2️⃣ Find order
//           const order = await ordersCollection.findOne({
//             _id: new ObjectId(id),
//           });

//           if (!order) {
//             return res.status(404).send({ message: "Order not found" });
//           }

//           // 3️⃣ Own order check
//           if (order.librarianEmail !== req.tokenEmail) {
//             return res.status(403).send({
//               message: "You can only manage your own book orders!",
//             });
//           }

//           // 4️⃣ Status flow validation
//           const statusFlow = {
//             pending: ["shipped", "cancelled"],
//             shipped: ["delivered"],
//             delivered: [],
//             cancelled: [],
//           };

//           if (!statusFlow[order.orderStatus].includes(orderStatus)) {
//             return res.status(400).send({
//               message: `Cannot change status from ${order.orderStatus} to ${orderStatus}`,
//             });
//           }

//           // 5️⃣ Update status
//           const result = await ordersCollection.updateOne(
//             { _id: new ObjectId(id) },
//             {
//               $set: {
//                 orderStatus,
//                 updatedAt: new Date(),
//               },
//             }
//           );

//           res.send(result);
//         } catch (error) {
//           console.error("Update order status error:", error);
//           res.status(500).send({ message: "Failed to update order status" });
//         }
//       }
//     );

//     // ==========================================
//     // PAYMENT ROUTES
//     // ==========================================
//     app.post("/create-checkout-session", verifyJWT, async (req, res) => {
//       const order = req.body;

//       const session = await stripe.checkout.sessions.create({
//         payment_method_types: ["card"],

//         line_items: [
//           {
//             price_data: {
//               currency: "usd",
//               product_data: {
//                 name: order.bookTitle,
//                 images: [order.bookImage],
//               },
//               unit_amount: order.price * 100,
//             },
//             quantity: 1,
//           },
//         ],

//         mode: "payment",

//         metadata: {
//           orderId: order._id.toString(), // 🔥 FIXED
//         },

//         customer_email: order.userEmail,

//         success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
//         cancel_url: `${process.env.CLIENT_DOMAIN}/dashboard/my-orders`,
//       });

//       res.send({ url: session.url });
//     });

//     app.post("/verify-payment", verifyJWT, async (req, res) => {
//       try {
//         const { sessionId } = req.body;

//         const session = await stripe.checkout.sessions.retrieve(sessionId);

//         if (session.payment_status !== "paid") {
//           return res.status(400).send({ message: "Payment not completed" });
//         }

//         const orderId = session.metadata.orderId;
//         const transactionId = session.payment_intent;

//         // 🔥 order থেকে userEmail আনো
//         const order = await ordersCollection.findOne({
//           _id: new ObjectId(orderId),
//         });

//         if (!order) {
//           return res.status(404).send({ message: "Order not found" });
//         }

//         // 🔥 duplicate payment prevent
//         const existingPayment = await paymentsCollection.findOne({
//           transactionId,
//         });

//         if (existingPayment) {
//           return res.send({ message: "Payment already verified" });
//         }

//         const paymentDoc = {
//           orderId,
//           transactionId,
//           amount: session.amount_total / 100,
//           currency: session.currency,
//           customerEmail: order.userEmail, // ✅ FIXED
//           paymentMethod: session.payment_method_types[0],
//           paymentStatus: "paid",
//           createdAt: new Date(),
//         };

//         await paymentsCollection.insertOne(paymentDoc);

//         await ordersCollection.updateOne(
//           { _id: new ObjectId(orderId) },
//           {
//             $set: {
//               paymentStatus: "paid",
//               orderStatus: "delivered",
//               transactionId,
//               paidAt: new Date(),
//             },
//           }
//         );

//         res.send({ success: true });
//       } catch (error) {
//         console.error("Payment verify error:", error);
//         res.status(500).send({ message: "Payment verification failed" });
//       }
//     });

//     // Get My Payments (User)

//     app.get("/my-payments", verifyJWT, async (req, res) => {
//       try {
//         const email = req.tokenEmail;

//         if (!email) {
//           return res.status(401).send({ message: "Unauthorized access" });
//         }

//         const payments = await paymentsCollection
//           .find({ customerEmail: email }) // 🔥 CORRECT FIELD
//           .sort({ createdAt: -1 })
//           .toArray();

//         res.send(payments);
//       } catch (error) {
//         console.error("Get my payments error:", error);
//         res.status(500).send({ message: "Failed to get payments" });
//       }
//     });

//     // ============================================
//     // ADMIN ROUTES
//     // ============================================

//     // Get All Users
//     app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
//       const users = await usersCollection.find().toArray();
//       res.send(users);
//     });

//     // Update User Role (Make Librarian/Admin)
//     app.patch("/users/:id/role", verifyJWT, verifyAdmin, async (req, res) => {
//       const id = req.params.id;
//       const { role } = req.body;
//       const result = await usersCollection.updateOne(
//         { _id: new ObjectId(id) },
//         { $set: { role } }
//       );
//       res.send(result);
//     });

//     // ============================================
//     // REVIEW ROUTES
//     // ============================================

//     // Add Review & Rating (User must have delivered order)
//     app.post("/books/:id/review", verifyJWT, async (req, res) => {
//       try {
//         const bookId = req.params.id;
//         const { rating, review } = req.body;

//         if (!rating || rating < 1 || rating > 5) {
//           return res
//             .status(400)
//             .send({ message: "Rating must be between 1 and 5" });
//         }

//         // Check if user has delivered order
//         const order = await ordersCollection.findOne({
//           bookId: bookId.toString(),
//           userEmail: req.tokenEmail,
//           orderStatus: "delivered",
//         });

//         if (!order) {
//           return res.status(403).send({
//             message: "You can only review books you ordered and delivered!",
//           });
//         }

//         // Prevent duplicate review
//         const alreadyReviewed = await booksCollection.findOne({
//           _id: new ObjectId(bookId),
//           "ratings.userEmail": req.tokenEmail,
//         });

//         if (alreadyReviewed) {
//           return res
//             .status(400)
//             .send({ message: "You already reviewed this book" });
//         }

//         // Add review
//         const result = await booksCollection.updateOne(
//           { _id: new ObjectId(bookId) },
//           {
//             $push: {
//               ratings: {
//                 userEmail: req.tokenEmail,
//                 rating,
//                 review,
//                 date: new Date(),
//               },
//             },
//           }
//         );

//         res.send(result);
//       } catch (error) {
//         console.error("Add review error:", error);
//         res.status(500).send({ message: "Failed to add review" });
//       }
//     });

//     // Get Reviews of a Book
//     app.get("/books/:id/reviews", async (req, res) => {
//       try {
//         const bookId = req.params.id;

//         const book = await booksCollection.findOne(
//           { _id: new ObjectId(bookId) },
//           { projection: { ratings: 1 } }
//         );

//         if (!book) {
//           return res.status(404).send({ message: "Book not found" });
//         }

//         res.send(book.ratings || []);
//       } catch (error) {
//         console.error("Get reviews error:", error);
//         res.status(500).send({ message: "Failed to get reviews" });
//       }
//     });

//     // ============================================
//     // WISHLIST ROUTES
//     // ============================================

//     // Add to Wishlist
//     app.post("/wishlist", verifyJWT, async (req, res) => {
//       try {
//         const { bookId } = req.body;

//         // Check duplicate
//         const existing = await wishlistCollection.findOne({
//           userEmail: req.tokenEmail,
//           bookId,
//         });

//         if (existing) {
//           return res.send({ message: "Already in wishlist" });
//         }

//         const result = await wishlistCollection.insertOne({
//           userEmail: req.tokenEmail,
//           bookId,
//           addedAt: new Date(),
//         });

//         res.send({ success: true, result });
//       } catch (error) {
//         console.error("Add to wishlist error:", error);
//         res.status(500).send({ message: "Failed to add to wishlist" });
//       }
//     });

//     // Get My Wishlist
//     app.get("/my-wishlist", verifyJWT, async (req, res) => {
//       try {
//         const wishlist = await wishlistCollection
//           .find({ userEmail: req.tokenEmail })
//           .toArray();

//         // Populate book details
//         const bookIds = wishlist.map((item) => new ObjectId(item.bookId));
//         const books = await booksCollection
//           .find({ _id: { $in: bookIds } })
//           .toArray();

//         res.send({ success: true, books });
//       } catch (error) {
//         console.error("Get wishlist error:", error);
//         res.status(500).send({ message: "Failed to fetch wishlist" });
//       }
//     });

//     // Remove from Wishlist
//     app.delete("/wishlist/:bookId", verifyJWT, async (req, res) => {
//       try {
//         const bookId = req.params.bookId;

//         const result = await wishlistCollection.deleteOne({
//           userEmail: req.tokenEmail,
//           bookId,
//         });

//         res.send({ success: true, result });
//       } catch (error) {
//         console.error("Remove wishlist error:", error);
//         res.status(500).send({ message: "Failed to remove from wishlist" });
//       }
//     });

//     // Send a ping to confirm a successful connection
//     await client.db("admin").command({ ping: 1 });
//     console.log(
//       "Pinged your deployment. You successfully connected to MongoDB!"
//     );
//   } finally {
//     // Ensures that the client will close when you finish/error
//   }
// }
// run().catch(console.dir);

// app.get("/", (req, res) => {
//   res.send("Book Courier Server Is Running");
// });

// app.listen(port, () => {
//   console.log(`Server is running on port ${port}`);
// });

//=====================================
//=====================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const admin = require("firebase-admin");

const app = express();
app.use(cors({ origin: [process.env.CLIENT_DOMAIN], credentials: true }));
app.use(express.json());

// ------------------ Firebase Admin ------------------
let serviceAccount;
if (process.env.FIREBASE_PRIVATE_KEY) {
  serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  };
} else {
  serviceAccount = require("./serviceAccountKey.json");
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// ------------------ MongoDB Setup ------------------
const client = new MongoClient(process.env.MONGODB_URI);
let db,
  usersCollection,
  booksCollection,
  ordersCollection,
  paymentsCollection,
  wishlistCollection;

async function connectDB() {
  if (!db) {
    await client.connect();
    db = client.db("bookCourierDB");
    usersCollection = db.collection("users");
    booksCollection = db.collection("books");
    ordersCollection = db.collection("orders");
    paymentsCollection = db.collection("payments");
    wishlistCollection = db.collection("wishlist");
    console.log("✅ MongoDB Connected!");
  }
}

// ------------------ JWT Middleware ------------------
const verifyJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send({ message: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    next();
  } catch (err) {
    console.error("JWT Error:", err.message);
    res.status(401).send({ message: "Invalid token" });
  }
};

// ------------------ Role Middlewares ------------------
const verifyAdmin = async (req, res, next) => {
  await connectDB();
  const user = await usersCollection.findOne({ email: req.tokenEmail });
  if (!user || user.role !== "admin")
    return res.status(403).send({ message: "Forbidden" });
  next();
};

const verifyLibrarian = async (req, res, next) => {
  await connectDB();
  const user = await usersCollection.findOne({ email: req.tokenEmail });
  if (!user || (user.role !== "librarian" && user.role !== "admin"))
    return res.status(403).send({ message: "Forbidden" });
  req.userRole = user.role;
  next();
};

// ------------------ ROUTES ------------------

// Ping
app.get("/", (req, res) => res.send("Book Courier Server is Running"));

// ------------------ Users ------------------

// Create/Update User
app.post("/users", async (req, res) => {
  await connectDB();
  const user = req.body;
  const existing = await usersCollection.findOne({ email: user.email });
  if (existing)
    return res.send({ message: "User already exists", insertedId: null });

  const result = await usersCollection.insertOne({
    ...user,
    role: "user",
    createdAt: new Date(),
  });
  res.send(result);
});

// Get User Role
app.get("/users/:email/role", verifyJWT, async (req, res) => {
  await connectDB();
  const email = req.params.email;
  if (email !== req.tokenEmail)
    return res.status(403).send({ message: "Forbidden" });
  const user = await usersCollection.findOne({ email });
  res.send({ role: user?.role || "user" });
});

// Update Profile
app.patch("/users/:email", verifyJWT, async (req, res) => {
  await connectDB();
  const email = req.params.email;
  if (email !== req.tokenEmail)
    return res.status(403).send({ message: "Forbidden" });

  const { name, image } = req.body;
  const result = await usersCollection.updateOne(
    { email },
    { $set: { name, image, updatedAt: new Date() } }
  );
  res.send(result);
});

// Get All Users (Admin)
app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
  await connectDB();
  const users = await usersCollection.find().toArray();
  res.send(users);
});

// Update Role (Admin)
app.patch("/users/:id/role", verifyJWT, verifyAdmin, async (req, res) => {
  await connectDB();
  const { role } = req.body;
  const result = await usersCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: { role } }
  );
  res.send(result);
});

// ------------------ Books ------------------

// Get All Published Books
app.get("/books", async (req, res) => {
  await connectDB();
  try {
    const { search, sort } = req.query;
    let query = { status: "published" };
    if (search) query.title = { $regex: search, $options: "i" };
    let sortOption = {};
    if (sort === "price_asc") sortOption = { price: 1 };
    if (sort === "price_desc") sortOption = { price: -1 };
    if (sort === "newest") sortOption = { createdAt: -1 };

    const books = await booksCollection.find(query).sort(sortOption).toArray();
    res.send(books);
  } catch (err) {
    res.status(500).send({ message: "Failed to fetch books" });
  }
});

// Get Latest Books
app.get("/books/latest", async (req, res) => {
  await connectDB();
  try {
    const books = await booksCollection
      .find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray();
    res.send(books);
  } catch (err) {
    res.status(500).send({ message: "Failed to fetch latest books" });
  }
});

// ✅ ADD THIS - Get All Books (Admin - including unpublished)
app.get("/all-books", verifyJWT, verifyAdmin, async (req, res) => {
  await connectDB();
  try {
    const books = await booksCollection.find().toArray();
    res.send(books);
  } catch (error) {
    console.error("Get all books error:", error);
    res.status(500).send({ message: "Failed to fetch all books" });
  }
});

// Single Book
app.get("/books/:id", async (req, res) => {
  await connectDB();
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id))
      return res.status(400).send({ message: "Invalid book id" });
    const book = await booksCollection.findOne({ _id: new ObjectId(id) });
    if (!book) return res.status(404).send({ message: "Book not found" });
    res.send(book);
  } catch (err) {
    res.status(500).send({ message: "Failed to fetch book" });
  }
});

// Add Book (Librarian)
app.post("/books", verifyJWT, verifyLibrarian, async (req, res) => {
  await connectDB();
  const book = req.body;
  const result = await booksCollection.insertOne({
    ...book,
    addedBy: req.tokenEmail,
    ratings: [],
    createdAt: new Date(),
  });
  res.send(result);
});

// Update Book (Librarian)
app.patch("/books/:id", verifyJWT, verifyLibrarian, async (req, res) => {
  await connectDB();
  const id = req.params.id;
  const book = await booksCollection.findOne({ _id: new ObjectId(id) });
  if (!book) return res.status(404).send({ message: "Book not found" });
  if (book.addedBy !== req.tokenEmail)
    return res
      .status(403)
      .send({ message: "You can only edit your own books!" });

  const updates = { ...req.body, updatedAt: new Date() };
  const result = await booksCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: updates }
  );
  res.send(result);
});

// Get My Books
app.get("/my-books", verifyJWT, verifyLibrarian, async (req, res) => {
  await connectDB();
  const books = await booksCollection
    .find({ addedBy: req.tokenEmail })
    .toArray();
  res.send(books);
});

// Delete Book (Admin)
app.delete("/books/:id", verifyJWT, verifyAdmin, async (req, res) => {
  await connectDB();
  const id = req.params.id;
  const result = await booksCollection.deleteOne({ _id: new ObjectId(id) });
  await ordersCollection.deleteMany({ bookId: id });
  res.send(result);
});

// Publish / Unpublish Book (Admin)
app.patch("/books/:id/status", verifyJWT, verifyAdmin, async (req, res) => {
  await connectDB();
  const id = req.params.id;
  const { isPublished } = req.body;
  const result = await booksCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        status: isPublished ? "published" : "unpublished",
        updatedAt: new Date(),
      },
    }
  );
  res.send(result);
});

// ------------------ Orders ------------------
app.post("/orders", verifyJWT, async (req, res) => {
  await connectDB();
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

// Get My Orders
app.get("/my-orders", verifyJWT, async (req, res) => {
  await connectDB();
  const orders = await ordersCollection
    .find({ userEmail: req.tokenEmail })
    .sort({ orderDate: -1 })
    .toArray();
  res.send(orders);
});

// ✅ ADD THIS - Get Librarian Orders
app.get("/librarian-orders", verifyJWT, verifyLibrarian, async (req, res) => {
  await connectDB();
  try {
    const orders = await ordersCollection
      .find({ librarianEmail: req.tokenEmail })
      .sort({ orderDate: -1 })
      .toArray();

    res.send(orders);
  } catch (error) {
    console.error("Get librarian orders error:", error);
    res.status(500).send({ message: "Failed to get orders" });
  }
});

// ✅ ADD THIS - Cancel Order (User)
app.patch("/orders/:id/cancel", verifyJWT, async (req, res) => {
  await connectDB();
  const id = req.params.id;
  const order = await ordersCollection.findOne({ _id: new ObjectId(id) });

  if (!order) {
    return res.status(404).send({ message: "Order not found" });
  }

  if (order.userEmail !== req.tokenEmail) {
    return res.status(403).send({ message: "Forbidden!" });
  }

  if (order.orderStatus !== "pending") {
    return res.status(400).send({ message: "Cannot cancel this order!" });
  }

  const result = await ordersCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { orderStatus: "cancelled", updatedAt: new Date() } }
  );
  res.send(result);
});

// Update Order Status (Librarian)
app.patch(
  "/orders/:id/status",
  verifyJWT,
  verifyLibrarian,
  async (req, res) => {
    await connectDB();
    const id = req.params.id;
    const { orderStatus } = req.body;
    const allowed = ["pending", "shipped", "delivered", "cancelled"];
    if (!allowed.includes(orderStatus))
      return res.status(400).send({ message: "Invalid status" });

    const order = await ordersCollection.findOne({ _id: new ObjectId(id) });
    if (!order) return res.status(404).send({ message: "Order not found" });
    if (order.librarianEmail !== req.tokenEmail)
      return res.status(403).send({ message: "Forbidden" });

    const statusFlow = {
      pending: ["shipped", "cancelled"],
      shipped: ["delivered"],
      delivered: [],
      cancelled: [],
    };
    if (!statusFlow[order.orderStatus].includes(orderStatus))
      return res.status(400).send({
        message: `Cannot change from ${order.orderStatus} to ${orderStatus}`,
      });

    const result = await ordersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { orderStatus, updatedAt: new Date() } }
    );
    res.send(result);
  }
);

// ------------------ Wishlist ------------------
app.post("/wishlist", verifyJWT, async (req, res) => {
  await connectDB();
  const { bookId } = req.body;
  const existing = await wishlistCollection.findOne({
    userEmail: req.tokenEmail,
    bookId,
  });
  if (existing) return res.send({ message: "Already in wishlist" });

  const result = await wishlistCollection.insertOne({
    userEmail: req.tokenEmail,
    bookId,
    addedAt: new Date(),
  });
  res.send({ success: true, result });
});

app.get("/my-wishlist", verifyJWT, async (req, res) => {
  await connectDB();
  const wishlist = await wishlistCollection
    .find({ userEmail: req.tokenEmail })
    .toArray();
  const bookIds = wishlist.map((item) => new ObjectId(item.bookId));
  const books = await booksCollection.find({ _id: { $in: bookIds } }).toArray();
  res.send({ success: true, books });
});

app.delete("/wishlist/:bookId", verifyJWT, async (req, res) => {
  await connectDB();
  const result = await wishlistCollection.deleteOne({
    userEmail: req.tokenEmail,
    bookId: req.params.bookId,
  });
  res.send({ success: true, result });
});

// ------------------ Reviews ------------------
app.post("/books/:id/review", verifyJWT, async (req, res) => {
  await connectDB();
  const bookId = req.params.id;
  const { rating, review } = req.body;
  if (!rating || rating < 1 || rating > 5)
    return res.status(400).send({ message: "Rating must be 1-5" });

  const order = await ordersCollection.findOne({
    bookId,
    userEmail: req.tokenEmail,
    orderStatus: "delivered",
  });
  if (!order)
    return res
      .status(403)
      .send({ message: "Only delivered orders can be reviewed" });

  const alreadyReviewed = await booksCollection.findOne({
    _id: new ObjectId(bookId),
    "ratings.userEmail": req.tokenEmail,
  });
  if (alreadyReviewed)
    return res.status(400).send({ message: "Already reviewed" });

  const result = await booksCollection.updateOne(
    { _id: new ObjectId(bookId) },
    {
      $push: {
        ratings: {
          userEmail: req.tokenEmail,
          rating,
          review,
          date: new Date(),
        },
      },
    }
  );
  res.send(result);
});

app.get("/books/:id/reviews", async (req, res) => {
  await connectDB();
  const book = await booksCollection.findOne(
    { _id: new ObjectId(req.params.id) },
    { projection: { ratings: 1 } }
  );
  res.send(book?.ratings || []);
});

// ------------------ Payments ------------------
app.post("/create-checkout-session", verifyJWT, async (req, res) => {
  await connectDB();
  const order = req.body;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: order.bookTitle, images: [order.bookImage] },
          unit_amount: order.price * 100,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    metadata: { orderId: order._id.toString() },
    customer_email: order.userEmail,
    success_url: `${process.env.CLIENT_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_DOMAIN}/dashboard/my-orders`,
  });
  res.send({ url: session.url });
});

app.post("/verify-payment", verifyJWT, async (req, res) => {
  await connectDB();
  const { sessionId } = req.body;
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid")
    return res.status(400).send({ message: "Payment not completed" });

  const orderId = session.metadata.orderId;
  const transactionId = session.payment_intent;

  const order = await ordersCollection.findOne({ _id: new ObjectId(orderId) });
  if (!order) return res.status(404).send({ message: "Order not found" });

  const existingPayment = await paymentsCollection.findOne({ transactionId });
  if (existingPayment) return res.send({ message: "Payment already verified" });

  await paymentsCollection.insertOne({
    orderId,
    transactionId,
    amount: session.amount_total / 100,
    currency: session.currency,
    customerEmail: order.userEmail,
    paymentMethod: session.payment_method_types[0],
    paymentStatus: "paid",
    createdAt: new Date(),
  });

  await ordersCollection.updateOne(
    { _id: new ObjectId(orderId) },
    {
      $set: {
        paymentStatus: "paid",
        orderStatus: "delivered",
        transactionId,
        paidAt: new Date(),
      },
    }
  );

  res.send({ success: true });
});

app.get("/my-payments", verifyJWT, async (req, res) => {
  await connectDB();
  const payments = await paymentsCollection
    .find({ customerEmail: req.tokenEmail })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(payments);
});

// ------------------ Export ------------------
module.exports = app;
