const express = require('express')
const cors = require('cors')
var jwt = require('jsonwebtoken');
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const ObjectId = require('mongodb').ObjectId
const app = express()
const port = process.env.PORT || 5000
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

app.use(cors())
app.use(express.json())


const url = `mongodb+srv://${process.env.DB_USER}:${process.env.PASSWORD}@vintagewheels.y6twe.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const verifyRequest = (req, res, next) => {
    const tokenInfo = req.headers.accesstoken;
    if (tokenInfo) {
        const [email, token] = tokenInfo.split(" ")
        if (email && token) {
            jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
                if (err) {
                    res.send({ error: 'Error Occured!!Unathurozied access' })
                }
                else {
                    if (decoded === email) {
                        next()
                    }
                    else {
                        res.send({ error: 'Sorry Unathurozied access' })
                    }
                }
            });
        }
    }
    else {
        res.send({ error: 'Sorry Unathurozied access' })
    }


}

async function run() {
    try {
        await client.connect();
        const database = client.db("vintage-wheels");
        const toolsdata = database.collection("toolsData");
        const users = database.collection("users");
        const orders = database.collection("orders");
        const reviews = database.collection("reviews");
        console.log('Db connected')



        app.post('/create-payment-intent', async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        });

        // auth
        app.put('/login', async (req, res) => {
            const { email, name } = req.body
            if (name) {
                const filter = { email: email }
                const options = { upsert: true };
                const updateDoc = {
                    $set: req.body,
                };
                const result = await users.updateOne(filter, updateDoc, options);
            }
            const token = jwt.sign(email, process.env.ACCESS_TOKEN);
            res.send({ token })
        })

        app.get('/admin/:email', async (req, res) => {
            const { email } = req.params
            const query = { email: email }
            const result = await users.findOne(query)
            const isAdmin = result.role === "admin"
            res.send({ isAdmin })
        })


        app.post('/addOrder', async (req, res) => {
            const neworder = req.body;
            const result = await orders.insertOne(neworder)
            res.send(result)
        })

        app.post('/addreview', async (req, res) => {
            const newreview = req.body;
            const result = await reviews.insertOne(newreview)
            res.send(result)
        })
        app.post('/addproduct', async (req, res) => {
            const newproduct = req.body;
            const result = await toolsdata.insertOne(newproduct)
            res.send(result)
        })

        app.get('/readtoolsData', async (req, res) => {
            const limit = req.query.limit
            const email = req.query.email
            let result;
            if (limit) {
                // result = await toolsdata.aggregate( [ { $sample: {size: parseInt(limit)} } ] )
                result = await toolsdata.find({}).limit(parseInt(limit))
            }
            else if (email) {
                result = await toolsdata.find({ email: email })
            }
            else {
                result = await toolsdata.find({})

            }
            res.send(await result.toArray())
        })

        app.get('/readmyorders', async (req, res) => {
            const email = req.query.email
            let result;
            if (email) {
                result = await orders.find({ email: email })
            }
            res.send(await result.toArray())
        })

        app.get('/readorders', async (req, res) => {
            const result = await orders.find({})
            res.send(await result.toArray())
        })

        app.get('/readreviews', async (req, res) => {
            const result = await reviews.find({})
            res.send(await result.toArray())
        })


        app.get('/readUserData', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            let result;
            if (email) {
                result = await users.findOne(query)
                res.send(result)
            }
            else {
                result = await users.find({})
                res.send(await result.toArray())
            }


        })

        app.get('/readSingleToolsData/:id', async (req, res) => {

            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await toolsdata.findOne(query)
            res.send(result)
        })

        app.get('/readSingleOrderData/:id', async (req, res) => {

            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await orders.findOne(query)
            res.send(result)
        })

        app.delete('/deleteToolsData/:id', async (req, res) => {
            const id = req.params.id
            console.log(id);
            const query = { _id: ObjectId(id) }
            const result = await toolsdata.deleteOne(query)
            res.send(result)
        })

        app.delete('/deleteOrdersData/:id', async (req, res) => {
            const id = req.params.id
            console.log(id);
            const query = { _id: ObjectId(id) }
            const result = await orders.deleteOne(query)
            res.send(result)
        })

        app.delete('/deleteuserorder/:id', verifyRequest, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await orders.deleteOne(query)
            res.send(result)
        })


        app.put('/makeadmin/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const options = { upsert: false };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await users.updateOne(filter, updateDoc, options);
            res.send(result)
        })

        app.put('/paymentupdate/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const options = { upsert: false };
            const updateDoc = {
                $set: req.body,
            };
            const result = await orders.updateOne(filter, updateDoc, options);
            res.send(result)
        })

        app.put('/updateuserprofile/:id', async (req, res) => {
            const id = req.params.id
            const updateuser = req.body
            const filter = { _id: ObjectId(id) }
            const options = { upsert: false };
            const updateDoc = {
                $set: updateuser,
            };
            const result = await users.updateOne(filter, updateDoc, options);
            res.send(result)
        })











        app.put('/deliverCarData/:id', verifyRequest, async (req, res) => {
            const id = req.params.id
            const filter = { _id: ObjectId(id) }
            const singleCar = await toolsdata.findOne(filter)
            const options = { upsert: true };
            const updateDoc = {
                $set: { quantity: parseInt(singleCar.quantity) - 1 },
            };
            const result = await toolsdata.updateOne(filter, updateDoc, options);
            res.send(result)
        })
        app.delete('/deleteCarData/:id', verifyRequest, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await toolsdata.deleteOne(query)
            res.send(result)
        })

        app.post('/updateStock', verifyRequest, async (req, res) => {
            const id = req.body._id
            const newQuantity = req.body.stock

            const filter = { _id: ObjectId(id) }
            const singleCar = await toolsdata.findOne(filter)
            const options = { upsert: true };
            const updateDoc = {
                $set: { quantity: parseInt(singleCar?.quantity) + newQuantity },
            };
            const result = await toolsdata.updateOne(filter, updateDoc, options);
            res.send(result)
        })
    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hey i am from server');
})

app.listen(port, () => {
    console.log('Server running')

})
