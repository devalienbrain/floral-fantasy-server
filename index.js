require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://hassansabbir0321:${process.env.PASSWORD}@cluster0.it45qfo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
  },
});

const run = async () => {
  try {
    await client.connect();
    const db = client.db("fatihas-floral-fantasy");
    const productCollection = db.collection("products");
    const categoryCollection = db.collection("categories");
    const paymentCollection = db.collection("payments");


    // Routes for products, categories and payment

    // Payment part
    // Get all products with optional filtering, pagination, and sorting
    app.get("/products", async (req, res) => {
      const {
        category,
        search,
        page = 1,
        limit = 10,
        sortBy = "name",
        sortOrder = "asc",
        addedToCart,
      } = req.query;
      const query = {};

      if (category) query.category = category;
      if (search) query.title = { $regex: search, $options: "i" };
      if (addedToCart !== undefined) query.addedToCart = addedToCart === "true";

      const totalProducts = await productCollection.countDocuments(query);

      const options = {
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 },
      };

      const cursor = productCollection.find(query, options);
      const products = await cursor.toArray();

      const totalPages = Math.ceil(totalProducts / limit);

      res.send({
        status: true,
        data: products,
        pagination: {
          totalProducts,
          totalPages,
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
        },
      });
    });

    // Get a single product by ID
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const product = await productCollection.findOne({ _id: ObjectId(id) });
      res.send({ status: true, data: product });
    });

    // Add a new product
    app.post("/products", async (req, res) => {
      const product = req.body;
      console.log(product);
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    // Update a product by Id
    app.put("/products/:id", async (req, res) => {
      const id = req.params.id;
      const product = req.body;

      // Exclude the _id field from the update document
      const { _id, ...updateData } = product;

      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: updateData };

      try {
        const result = await productCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to update product" });
      }
    });

    // Delete a product by Id
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });

    // Category part

    // Get all categories with product count
    app.get("/categories", async (req, res) => {
      const categories = await categoryCollection
        .aggregate([
          {
            $lookup: {
              from: "products",
              localField: "name",
              foreignField: "category",
              as: "products",
            },
          },
          {
            $project: {
              name: 1,
              totalProducts: { $size: "$products" },
            },
          },
        ])
        .toArray();
      res.send({ status: true, data: categories });
    });

    // Add a new category
    app.post("/categories", async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      res.send(result);
    });

    // Update a category by ID
    app.put("/categories/:id", async (req, res) => {
      const id = req.params.id;
      const category = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: category };
      const result = await categoryCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Delete a category by ID
    app.delete("/categories/:id", async (req, res) => {
      const id = req.params.id;
      const result = await categoryCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });

    // Payment part 

    // Create a Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount * 100, // amount in cents
          currency: "usd",
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Save payment information
    app.post("/save-payment-info", async (req, res) => {
      const paymentInfo = req.body;

      try {
        const result = await paymentCollection.insertOne(paymentInfo);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to save payment information" });
      }
    });

    // Get user list who have made payments
    app.get("/users-who-paid", async (req, res) => {
      try {
        const users = await paymentCollection
          .aggregate([
            {
              $group: {
                _id: "$userId",
                totalAmount: { $sum: "$amount" },
                paymentCount: { $sum: 1 },
                lastPaymentDate: { $max: "$createdAt" },
              },
            },
            {
              $lookup: {
                from: "users", // user information is stored in a collection named 'users'
                localField: "_id",
                foreignField: "_id",
                as: "userDetails",
              },
            },
            {
              $unwind: "$userDetails",
            },
            {
              $project: {
                _id: 0,
                userId: "$_id",
                totalAmount: 1,
                paymentCount: 1,
                lastPaymentDate: 1,
                "userDetails.name": 1,
                "userDetails.email": 1,
              },
            },
          ])
          .toArray();

        res.send(users);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch users who made payments" });
      }
    });

  } finally {
    // Do nothing here, or close the connection if needed
  }
};

run().catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Hello From Fatihas Floral Fantasy - Online Nursery Website Server");
});

app.listen(port, () => {
  console.log(
    `Fatihas Floral Fantasy - Online Nursery Website Server listening on port ${port}`
  );
});
