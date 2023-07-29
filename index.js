const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const app = express()
const cors = require('cors');
const port = process.env.PORT || 5000;
require('dotenv').config()

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gfisnkk.mongodb.net/?retryWrites=true&w=majority`;

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
        await client.connect();

        const usersCollection = client.db("travelODB").collection("users");
        const destinationsCollection = client.db("travelODB").collection("destinations");

        // Create user api...
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist' })
            }
            const result = await usersCollection.insertOne(user)
            res.send(result)
        })

        // Get users api...
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })

        // Get destinations api...
        app.get('/destinations', async (req, res) => {
            const result = await destinationsCollection.find().toArray();
            res.send(result)
        })

        // get api for finding package
        app.get('/packages/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            try {
                // Fetch the package details based on the provided packageId
                const packageDetails = await destinationsCollection.findOne(query);
                res.send(packageDetails);
            } catch (error) {
                console.error("Error fetching package details:", error);
                res.status(500).send({ error: "An error occurred while fetching package details" });
            }
        });

        // want to get country, countryImage and accommodation from destinationsCollection
        app.get('/popularDestinations', async (req, res) => {
            try {
                // Project only the desired fields (country, countryImage, accommodation)
                const projection = {
                    _id: 1, // Exclude the "_id" field from the response
                    country: 1,
                    countryImage: 1,
                    accommodation: 1,
                };
                const result = await destinationsCollection.find({}, projection).toArray();
                res.send(result);
            } catch (error) {
                console.error("Error fetching destinations:", error);
                res.status(500).send({ error: "An error occurred while fetching destinations" });
            }
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Travel agency is running...')
})

app.listen(port, () => {
    console.log(`Travel agency is running on port ${port}`)
})