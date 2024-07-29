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

    // Routes for products
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

      try {
        const totalProducts = await productCollection.countDocuments(query);

        const options = {
          skip: (page - 1) * limit,
          limit: parseInt(limit),
          sort: { [sortBy]: sortOrder === "asc" ? 1 : -1 },
        };

        const products = await productCollection.find(query, options).toArray();
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
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch products" });
      }
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const product = await productCollection.findOne({ _id: ObjectId(id) });
        if (product) {
          res.send({ status: true, data: product });
        } else {
          res.status(404).send({ error: "Product not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch product" });
      }
    });

    app.post("/products", async (req, res) => {
      const product = req.body;
      try {
        const result = await productCollection.insertOne(product);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to add product" });
      }
    });

    app.put("/products/:id", async (req, res) => {
      const id = req.params.id;
      const product = req.body;

      const { _id, ...updateData } = product;
      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: updateData };

      try {
        const result = await productCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
          res.send(result);
        } else {
          res.status(404).send({ error: "Product not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to update product" });
      }
    });

    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await productCollection.deleteOne({ _id: ObjectId(id) });
        if (result.deletedCount > 0) {
          res.send(result);
        } else {
          res.status(404).send({ error: "Product not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to delete product" });
      }
    });

    // Routes for categories
    app.get("/categories", async (req, res) => {
      try {
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
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch categories" });
      }
    });

    app.post("/categories", async (req, res) => {
      const category = req.body;
      try {
        const result = await categoryCollection.insertOne(category);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to add category" });
      }
    });

    app.put("/categories/:id", async (req, res) => {
      const id = req.params.id;
      const category = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: category };

      try {
        const result = await categoryCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
          res.send(result);
        } else {
          res.status(404).send({ error: "Category not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to update category" });
      }
    });

    app.delete("/categories/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await categoryCollection.deleteOne({
          _id: ObjectId(id),
        });
        if (result.deletedCount > 0) {
          res.send(result);
        } else {
          res.status(404).send({ error: "Category not found" });
        }
      } catch (error) {
        res.status(500).send({ error: "Failed to delete category" });
      }
    });

    // Routes for payments
    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      // console.log(amount);
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

    app.post("/save-payment-info", async (req, res) => {
      const paymentInfo = req.body;
      // console.log(paymentInfo);
      try {
        const result = await paymentCollection.insertOne(paymentInfo);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to save payment information" });
      }
    });

    app.get("/users-who-paid", async (req, res) => {
      try {
        const payments = await paymentCollection
          .aggregate([
            {
              $group: {
                _id: "$name",
                totalAmount: { $sum: "$amount" },
                paymentCount: { $sum: 1 },
                lastPaymentDate: { $max: "$date" },
              },
            },
            {
              $project: {
                _id: 0,
                name: "$_id",
                totalAmount: 1,
                paymentCount: 1,
                lastPaymentDate: 1,
              },
            },
          ])
          .toArray();

        console.log("Aggregated Payments:", payments); // Log the aggregated payments
        res.send(payments);
      } catch (error) {
        console.error("Failed to fetch payment history", error); // Log errors
        res.status(500).send({ error: "Failed to fetch payment history" });
      }
    });

    app.post("/clear-cart", async (req, res) => {
      try {
        // Logic to clear all cart items
        await productCollection.updateMany({}, { $set: { addedToCart: false } }); 
        res.status(200).json({ message: "Cart cleared successfully" });
      } catch (error) {
        console.error("Error clearing cart:", error);
        res.status(500).json({ error: "Failed to clear cart" });
      }
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
  } finally {
    // Close the connection if needed
  }
};

run().catch((err) => console.log("Error in server run", err));

app.get("/", (req, res) => {
  res.send("Hello From Fatihas Floral Fantasy - Online Nursery Website Server");
});

app.listen(port, () => {
  console.log(
    `Fatihas Floral Fantasy - Online Nursery Website Server listening on port ${port}`
  );
});
