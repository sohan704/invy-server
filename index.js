const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();


app.use(cors());
app.use(express.json());






const { MongoClient, ServerApiVersion } = require('mongodb');
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

    app.post('/jwt', async (req, res) => {
      const user = req.body;


      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '9h' });

      res.send({ token });
    })

    //user related api 

    //is user a shop owner

    app.get('/isOwner/:email', async(req,res)=>{
       const email = req.params.email;
       const query = {shopOwnerEmail : email};

       const hasShop = await shopCollection.findOne(query);
       if(hasShop){
        return res.send({owner : true})
       }
       return res.send({owner: false})
    })

    app.get('/getShopData/:email', async(req,res)=>{
      const email = req.params.email;
      const query = {shopOwnerEmail : email};
      const shopData = await shopCollection.findOne(query);
      res.send(shopData);
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

      const finalShop = { ...shop, productLimit: 3};

      const result = await shopCollection.insertOne(finalShop);

      res.send(result);     
    });


    app.patch('/users/:email', async(req,res)=>{
      const email = req.params.email;
      const extraShopInfo = req.body;

      const filter = {email : email};

      const updatedDoc = {
        $set : {
          shopName: extraShopInfo.shopName,
          shopLogo: extraShopInfo.shopLogo,
          shopInfo: extraShopInfo.shopInfo,
          shopLocation: extraShopInfo.shopLocation,
          shopOwnerEmail: extraShopInfo.shopOwnerEmail,
          ownerName: extraShopInfo.ownerName,
        }
      }
      const result = await userCollection.updateOne(filter,updatedDoc);
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
