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

        // get accommodation details by id...
        app.get('/accommodation/:country/:id', async (req, res) => {
            const countryName = req.params.country;
            const id = parseInt(req.params.id);
            try {
                const country = await destinationsCollection.findOne({ country: countryName });
                if (!country) {
                    return res.status(404).json({ message: 'Country not found.' });
                }
                const accommodation = country.accommodation.find((acc) => acc.acc_id === id);
                if (!accommodation) {
                    return res.status(404).json({ message: 'Accommodation not found.' });
                }
                res.send(accommodation);
            } catch (error) {
                console.error('Error fetching accommodation details:', error);
                return res.status(500).json({ message: 'Internal server error.' });
            }
        });

        // Get accommodation from all countries and put then in an one array to get together..
        app.get('/accommodations', async (req, res) => {
            try {
                const destinations = await destinationsCollection.find().toArray();

                // Create an empty array to store all accommodations
                const allAccommodations = [];

                // Iterate through each destination and add its accommodations to the allAccommodations array
                destinations.forEach((destination) => {
                    const accommodations = destination.accommodation;
                    allAccommodations.push(...accommodations);
                });

                res.send(allAccommodations);
            } catch (error) {
                console.error("Error fetching destinations data:", error);
                res.status(500).send({ error: "An error occurred while fetching destinations data" });
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