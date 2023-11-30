const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config();
const nodemailer = require('nodemailer');
const sendMailController = require('./Controllers/sendMail');
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




    const verifyToken = (req, res, next) => {
      console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Forbidden Access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      // if(!token){
      //   return res.status(401).send({message: 'Forbidden Access'});
      // }

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: 'Forbidden Access' });
        }
        req.decoded = decoded;
        next();
      })

    }







    //user related api 

    //is user a shop owner

    app.get('/isOwner/:email', async (req, res) => {
      const email = req.params.email;
      const query = { shopOwnerEmail: email };

      const hasShop = await shopCollection.findOne(query);
      // console.log('owerner info', hasShop);
      if (hasShop) {
        return res.send({ owner: true })
      }
      return res.send({ owner: false })
    })


    app.post("/promoEmail", async (req, res) => {
      const email = req.body;
      sendMailController.sendEmail(email);
      res.send({ email: 'sent' });
    });



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


    app.get('/allShops', async (req, res) => {
      const result = await shopCollection.find().toArray();
      res.send(result);
    })




    // 










    //








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
      // console.log(product);
      const finalProduct = {
        ...product,
        productDiscount: parseInt(product.productDiscount),
        productQuantity: parseInt(product.productQuantity),
        productionCost: parseInt(product.productionCost),
        profitMargin: parseInt(product.profitMargin),
      };
      // console.log(finalProduct);

      const result = await productCollection.insertOne(finalProduct);
      res.send(result);
    })


    //product updating functionality 

    app.patch('/updateProduct/:id', async (req, res) => {
      const id = req.params.id;
      const newProduct = req.body;

      // console.log('id is ', id, 'newProduct is ', newProduct);


      const query = { _id: new ObjectId(id) };

      const oldProduct = await productCollection.findOne(query);
      let newSellingPrice = oldProduct.sellingPrice;

      const calc_tax = (price) => {
        const tax2 = parseInt(price) * (7.5 / 100);
        // console.log('tax is ', tax2);
        return tax2;
      }
      const calc_profit = (price, profit) => {
        const profit2 = parseInt(price) * (parseInt(profit) / 100);
        // console.log('profit is', profit2);
        return profit2;
      }

      const total = (price, profit) => {
        const total2 = parseInt(price) + parseFloat(calc_tax(price)) + parseInt(calc_profit(price, profit));
        // console.log('total is ', total2);
        return total2;
      }
      // let taxAmount = parseInt(data?.productionCost) * (7.5 / 100);
      // let profitAmount = parseInt(data?.productionCost) * (parseInt(data?.profitMargin) / 100);

      // const sellingPrice = parseInt(data?.productionCost) + taxAmount + profitAmount;

      if (newProduct.productionCost && newProduct.profitMargin) {
        // console.log('inside 1');
        newSellingPrice = total(newProduct.productionCost, newProduct.profitMargin);
      }
      else if (newProduct.productionCost) {
        // console.log('inside 2');
        newSellingPrice = total(newProduct.productionCost, oldProduct.profitMargin);

      }
      else if (newProduct.profitMargin) {
        // console.log('inside 3');
        newSellingPrice = total(oldProduct.productionCost, newProduct.profitMargin);
      }

      const updatedDoc = {
        $set: {
          productName: newProduct.productName || oldProduct.productName,
          productQuantity: parseInt(newProduct.productQuantity) || oldProduct.productQuantity,
          productLocation: newProduct.productLocation || oldProduct.productLocation,
          productionCost: parseInt(newProduct.productionCost) || oldProduct.productionCost,
          profitMargin: parseInt(newProduct.profitMargin) || oldProduct.profitMargin,
          productDiscount: parseInt(newProduct.productDiscount) || oldProduct.productDiscount,
          productDescription: newProduct.productDescription || oldProduct.productDescription,
          productImage: newProduct.productImage || oldProduct.productImage,
          sellingPrice: newSellingPrice
        }
      }





      const updateResult = await productCollection.updateOne(query, updatedDoc);
      res.send(updateResult);
      // const updateResult = await userCollection.updateOne(query, {
      //   $set: {
      //     income: newIncome
      //   }
      // })
    })


    // productName: 'Veggie Beef Pizza',
    // prodQuantity: '1',
    // productLocation: '',
    // productionCost: '21',
    // profitMargin: '59',
    // productDiscount: '',
    // productDescription: '',
    // productImage: 'https://i.ibb.co/60psalesCollechtP0/ah5.png' 



    // app.post('/addToCart', async (req, res) => {
    //   const myCart = req.body;
    //   const currentDateTime = new Date();
    //   const formattedDateTime = currentDateTime.toLocaleString();

    //   for (const product of myCart) {
    //     const { _id, ...productWithoutId } = product;
    //      const result = await salesCollection.insertOne({...productWithoutId, productSoldDate: formattedDateTime});
    //      res.send(result);

    //   }

    //   for(const product of myCart){
    //     const query = {_id : new ObjectId(product._id)};
    //     const oldProduct = await productCollection.findOne(query);
    //     const newSalesAmount = oldProduct.saleCount + 1;
    //     const newProductQuantity = oldProduct.productQuantity - 1;
    //     const newResult = await productCollection.updateOne(query, {
    //       $set: {
    //         saleCount: newSalesAmount,
    //         productQuantity: newProductQuantity
    //       }
    //     })
    //     res.send(newResult);

    //   }



    //   res.send({ message: 'Products processed successfully' });
    // });



    app.post('/addtocart1', async (req, res) => {
      const myCart = req.body;

      const productsToInsert = myCart.map(product => {
        const { _id, ...productWithoutId } = product;
        const currentDateTime = new Date();
        const formattedDateTime = currentDateTime.toLocaleString();
        return { ...productWithoutId, productSoldDate: formattedDateTime }; // Assuming formattedDateTime is defined somewhere
      });
      console.log('products to add ', productsToInsert);

      const insertResult = await salesCollection.insertMany(productsToInsert);
      res.json(insertResult);

    })


    app.patch('/addtocart2', async (req, res) => {
      const myCart = req.body; // Assuming request body contains an array of products

      try {
        const updatePromises = myCart.map(async (product) => {
          const productId = new ObjectId(product._id);

          // Find the product by its ID and update saleCount and productQuantity
          return productCollection.updateOne(
            { _id: productId },
            {
              $inc: { saleCount: 1 }, // Increment saleCount by 1
              $inc: { productQuantity: -1 } // Decrement productQuantity by 1
            }
          );
        });

        // Wait for all update operations to complete
        await Promise.all(updatePromises);

        res.json({ message: 'Cart updated successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });



    // app.patch('/addtocart2', async (req, res) => {

    //     const myCart = req.body; // Assuming request body contains an array of products

    //     // Create an array of product IDs from myCart
    //     const productIds = myCart.map(product =>  new ObjectId(product._id));

    //     // Define the query to find products by their IDs
    //     const query = { _id: { $in: productIds } };
    //     console.log('all query',query);
    //     // Find multiple products based on the IDs
    //     // const products = await productCollection.find(query).toArray();

    //     // Update multiple products using updateMany
    //     const updateResult = await productCollection.updateMany(query, {
    //       $inc: { saleCount: 1 }, // Increment saleCount by 1
    //       $inc: { productQuantity: -1 } // Decrement productQuantity by 1
    //     });

    //     res.json(updateResult);


    // });





    // app.post('/addToCart', async (req, res) => {
    //   const myCart = req.body;
    //   const currentDateTime = new Date();
    //   const formattedDateTime = currentDateTime.toLocaleString();

    //   try {
    //     for (const product of myCart) {
    //       const { _id, ...productWithoutId } = product;

    //       // Insert sales data
    //       const result = await salesCollection.insertOne({ ...productWithoutId, productSoldDate: formattedDateTime });

    //       // Update product information
    //       const query = { _id: new ObjectId(product._id) };
    //       const oldProduct = await productCollection.findOne(query);

    //       const newSalesAmount = oldProduct.saleCount + 1;
    //       const newProductQuantity = oldProduct.productQuantity - 1;

    //       // Update product details
    //       await productCollection.updateOne(query, {
    //         $set: {
    //           saleCount: newSalesAmount,
    //           productQuantity: newProductQuantity
    //         }
    //       });
    //     }

    //     res.send({ message: 'Products processed successfully' });
    //   } catch (error) {
    //     console.error(error);
    //     res.status(500).send({ error: 'Internal Server Error' });
    //   }
    // });










    //check admin 

    app.get('/checkAdmin/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      // console.log('admin info', result);
      if (result?.role === 'admin') {
        res.send({ admin: true });
        return;
      }

      res.send({ admin: false });

    })



    //ADMIN !!!!!!!!

    app.patch('/increaseAdminIncome/:income', async (req, res) => {
      const param = req.params.income;
      const earning = parseInt(param);

      const query = { role: 'admin' };
      const admin = await userCollection.findOne(query);
      const newIncome = admin.income + earning;
      const updateResult = await userCollection.updateOne(query, {
        $set: {
          income: newIncome
        }
      })
      res.send(updateResult);


    })

    //ADMIN !!!!!!!!



    ///PRODUCT LIMIT INCREASE 

    app.patch('/increaseLimit/:id/:amount', async (req, res) => {
      const id = req.params.id;
      const param_amount = req.params.amount;
      const limit = parseInt(param_amount);
      // console.log('Entered ', id);
      const query = { _id: new ObjectId(id) };
      // console.log('Query', query);
      const shop = await shopCollection.findOne(query);


      if (!shop) {
        return res.status(404).send({ message: 'Shop not found' });
      }

      const newLimit = shop.productLimit + limit;
      const updateResult = await shopCollection.updateOne(
        query,
        { $set: { productLimit: newLimit } }
      );

      res.send(updateResult);

    })
    //premium 


    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    })


    app.post('/users', async (req, res) => {

      const user = req.body;
      const query = { email: user.email };

      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      // console.log(user);
      const result = await userCollection.insertOne(user);
      res.send(result);
    });




    app.post('/shops', async (req, res) => {

      const shop = req.body;

      const finalShop = { ...shop, productLimit: 3, totalProductAdded: 0 };

      const result = await shopCollection.insertOne(finalShop);

      res.send(result);
    });




    app.get('/allSales/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);


      if (user && user?.role === 'admin') {
        const result = await salesCollection.find().toArray();
        res.send(result);
        return;
      }


      res.send({ message: 'unauthorized route' });
    })


    app.get('/allProducts/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);


      if (user && user?.role === 'admin') {
        const result = await productCollection.find().toArray();
        res.send(result);
        return;
      }


      res.send({ message: 'unauthorized route' });
    })


    app.get('/adminData/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);


      if (user && user?.role === 'admin') {
        res.send(user);
        return;
      }


      res.send({ message: 'unauthorized route' });
    })











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

    //get sales 

    app.get('/sales/:id', async (req, res) => {
      const shop_id = req.params.id;
      const query = { shop_id: shop_id };
      const allSales = await salesCollection.find(query).toArray();
      res.send(allSales);
    })


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
  res.send('Invy version 2 is LIVE');
})

app.listen(port, () => {
  console.log(`Invy is running on port ${port}`);
})
