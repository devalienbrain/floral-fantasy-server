require('dotenv').config();
const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://hassansabbir0321:${process.env.PASSWORD}@cluster0.it45qfo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    const db = client.db('fatihas-floral-fantasy');
    const productCollection = db.collection('products');
    const categoryCollection = db.collection('categories');

    // Get all products with optional filtering, pagination, and sorting
    app.get('/products', async (req, res) => {
      const { category, search, page = 1, limit = 10, sortBy = 'name', sortOrder = 'asc' } = req.query;
      const query = {};
      
      if (category) query.category = category;
      if (search) query.title = { $regex: search, $options: 'i' };

      const options = {
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 },
      };

      const cursor = productCollection.find(query, options);
      const products = await cursor.toArray();
      res.send({ status: true, data: products });
    });

    // Get a single product by ID
    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      const product = await productCollection.findOne({ _id: ObjectId(id) });
      res.send({ status: true, data: product });
    });

    // Add a new product
    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productCollection.insertOne(product);
      res.send(result);
    });

    // Update a product by ID
    app.put('/products/:id', async (req, res) => {
      const id = req.params.id;
      const product = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: product };
      const result = await productCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Delete a product by ID
    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const result = await productCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });

    // Get all categories
    app.get('/categories', async (req, res) => {
      const cursor = categoryCollection.find({});
      const categories = await cursor.toArray();
      res.send({ status: true, data: categories });
    });

    // Add a new category
    app.post('/categories', async (req, res) => {
      const category = req.body;
      const result = await categoryCollection.insertOne(category);
      res.send(result);
    });

    // Update a category by ID
    app.put('/categories/:id', async (req, res) => {
      const id = req.params.id;
      const category = req.body;
      const filter = { _id: ObjectId(id) };
      const updateDoc = { $set: category };
      const result = await categoryCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Delete a category by ID
    app.delete('/categories/:id', async (req, res) => {
      const id = req.params.id;
      const result = await categoryCollection.deleteOne({ _id: ObjectId(id) });
      res.send(result);
    });

  } finally {
    // Do nothing here, or close the connection if needed
  }
};

run().catch((err) => console.log(err));

app.get('/', (req, res) => {
  res.send('Hello From Fatihas Floral Fantasy - Online Nursery Website Server');
});

app.listen(port, () => {
  console.log(`Fatihas Floral Fantasy - Online Nursery Website Server listening on port ${port}`);
});
