const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();


app.use(cors());
app.use(express.json());

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kjvt8fn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection


    const userCollection = client.db('InvyDB').collection('users');
    const shopCollection = client.db('InvyDB').collection('shops');
    const productCollection = client.db('InvyDB').collection('products');
    const historyCollection = client.db('InvyDB').collection('history');
    const salesCollection = client.db('InvyDB').collection('sales');

    app.post('/jwt', async (req, res) => {
      const user = req.body;


      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '9h' });

      res.send({ token });
    })

    //user related api 

    //is user a shop owner

    app.get('/isOwner/:email', async (req, res) => {
      const email = req.params.email;
      const query = { shopOwnerEmail: email };

      const hasShop = await shopCollection.findOne(query);
      if (hasShop) {
        return res.send({ owner: true })
      }
      return res.send({ owner: false })
    })

    app.get('/getShopData/:email', async (req, res) => {
      const email = req.params.email;
      const query = { shopOwnerEmail: email };
      const shopData = await shopCollection.findOne(query);
      res.send(shopData);
    })

    app.get('/getProductData/:id', async (req, res) => {
      const id = req.params.id;
      const query = { shop_id: id };
      const productData = await productCollection.find(query).toArray();
      res.send(productData);
    })




    //payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
        payment_method_types: ['card'],
       
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });




    app.post('/addProduct', async (req, res) => {
      const product = req.body;
      console.log(product);
      const finalProduct = {
        ...product,
        productDiscount: parseInt(product.productDiscount),
        productQuantity: parseInt(product.productQuantity),
        productionCost: parseInt(product.productionCost),
        profitMargin: parseInt(product.profitMargin),
      };
      console.log(finalProduct);

      const result = await productCollection.insertOne(finalProduct);
      res.send(result);
    })





    app.post('/users', async (req, res) => {

      const user = req.body;
      const query = { email: user.email };

      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      console.log(user);
      const result = await userCollection.insertOne(user);
      res.send(result);
    });


    app.post('/shops', async (req, res) => {

      const shop = req.body;

      const finalShop = { ...shop, productLimit: 3, totalProductAdded: 0 };

      const result = await shopCollection.insertOne(finalShop);

      res.send(result);
    });


    //add product to the product list 




    // Add a new endpoint to reduce product limit for a specific shop
    app.patch('/reduceProductLimit/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const query = { shopOwnerEmail: email };
        const shop = await shopCollection.findOne(query);

        if (!shop) {
          return res.status(404).send({ message: 'Shop not found' });
        }

        // Ensure productLimit doesn't go below 0
        if (shop.productLimit > 0) {
          const newProductLimit = shop.productLimit - 1;
          const newTotalProductAdded = shop.totalProductAdded + 1;

          const updateResult = await shopCollection.updateOne(
            query,
            { $set: { productLimit: newProductLimit, totalProductAdded: newTotalProductAdded } }
          );

          if (updateResult.modifiedCount > 0) {
            return res.send(updateResult);
          }
        }

        return res.send({ message: 'Product limit already at minimum' });
      } catch (error) {
        console.error('Error reducing product limit:', error);
        return res.status(500).send({ message: 'Internal server error' });
      }
    });



    //sales apis

    app.post('/sales/:id', async (req, res) => {
      const sale = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const product = await productCollection.findOne(query);

      if (product.productQuantity < 1) {
        return res.status(404).send({ message: 'No more products to sell' });
      }

      const result = await salesCollection.insertOne(sale);
      res.send(result);
    });


    app.patch('/modifySaleCount/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const product = await productCollection.findOne(query);

      if (product.productQuantity < 1) {
        return res.status(404).send({ message: 'No more products to sell' });
      } else {
        const newProductQuantity = product.productQuantity - 1;
        const newSaleCount = product.saleCount + 1;
        const updateResult = await productCollection.updateOne(query,
          {
            $set: {
              productQuantity: newProductQuantity, saleCount: newSaleCount
            }
          }
        );

        if (updateResult.modifiedCount > 0) {
          res.send(updateResult);
        }


      }



    })





    app.delete('/product/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    })



    app.patch('/users/:email', async (req, res) => {
      const email = req.params.email;
      const extraShopInfo = req.body;

      const filter = { email: email };

      const updatedDoc = {
        $set: {
          shopName: extraShopInfo.shopName,
          shopLogo: extraShopInfo.shopLogo,
          shopInfo: extraShopInfo.shopInfo,
          shopLocation: extraShopInfo.shopLocation,
          shopOwnerEmail: extraShopInfo.shopOwnerEmail,
          ownerName: extraShopInfo.ownerName,
          role: 'manager'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })





    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);








app.get('/', (req, res) => {
  res.send('Invy is LIVE');
})

app.listen(port, () => {
  console.log(`Invy is running on port ${port}`);
})
