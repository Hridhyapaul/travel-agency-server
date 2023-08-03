const express = require('express')
const app = express()
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
        const countryCollection = client.db("travelODB").collection("countries");
        const bookingCollection = client.db("travelODB").collection("booking");
        const paymentsCollection = client.db("travelODB").collection("payments");

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

        // Get country api...
        app.get('/countries', async (req, res) => {
            const result = await countryCollection.find().toArray();
            res.send(result)
        })

        // Get api to get country wise accommodation
        app.get('/accommodation', async (req, res) => {
            try {
                const accommodationsByCountry = await destinationsCollection.aggregate([
                    {
                        $lookup: {
                            from: 'countries',
                            localField: 'country_id',
                            foreignField: 'country_id',
                            as: 'countryInfo'
                        }
                    },
                    {
                        $unwind: '$countryInfo'
                    },
                    {
                        $group: {
                            _id: '$countryInfo',
                            accommodations: {
                                $push: {
                                    _id: '$_id',
                                    name: '$name',
                                    location: '$location',
                                    about: '$about',
                                    countryName: '$countryName',
                                    price: '$price',
                                    image: '$image',
                                    numberOfDay: '$numberOfDay',
                                    details: '$details',
                                    reviews: '$reviews',
                                    tourPlan: '$tourPlan',
                                    includedServices: '$includedServices'
                                }
                            }
                        }
                    },
                    {
                        $project: {
                            _id: '$_id._id',
                            country_id: '$_id.country_id',
                            country: '$_id.country',
                            slogan: '$_id.slogan',
                            countryImage: '$_id.countryImage',
                            accommodations: 1
                        }
                    }
                ]).toArray();

                res.json(accommodationsByCountry);
            } catch (err) {
                console.error('Error fetching accommodations: ', err);
                res.status(500).json({ error: 'Internal Server Error' });
            }
        });

        // get api for finding package
        app.get('/packages/:text', async (req, res) => {
            const countryName = req.params.text;
            try {
                // Fetch the package details based on the provided countryName
                const packageQuery = { countryName };
                const packageDetails = await destinationsCollection.find(packageQuery).toArray();

                // Fetch the country information based on the provided countryName
                const countryQuery = { country: countryName };
                const countryInfo = await countryCollection.findOne(countryQuery);

                if (!packageDetails || !countryInfo) {
                    return res.status(404).json({ message: 'Package not found for the provided countryName' });
                }

                // Combine the package details and country information
                const formattedPackageDetails = packageDetails.map((package) => {
                    return {
                        _id: package._id,
                        location: package.location,
                        name: package.name,
                        about: package.about,
                        countryName: package.countryName,
                        country_id: package.country_id,
                        image: package.image,
                        price: package.price,
                        numberOfDay: package.numberOfDay,
                        details: package.details,
                        reviews: package.reviews,
                    };
                });

                const result = {

                    _id: countryInfo._id,
                    country_id: countryInfo.country_id,
                    country: countryInfo.country,
                    slogan: countryInfo.slogan,
                    countryImage: countryInfo.countryImage,
                    accommodation: formattedPackageDetails,

                };

                res.json(result);
            } catch (error) {
                console.error('Error fetching package details:', error);
                res.status(500).json({ error: 'An error occurred while fetching package details' });
            }
        });


        // get accommodation details by id...
        app.get('/accommodation/:id', async (req, res) => {
            const id = (req.params.id);
            const query = { _id: new ObjectId(id) }
            try {
                const result = await destinationsCollection.findOne(query)
                res.send(result);
            } catch (error) {
                console.error('Error fetching accommodation details:', error);
                return res.status(500).json({ message: 'Internal server error.' });
            }
        });

        // Post api to insert booking collection
        app.post('/booking', async (req, res) => {
            const item = req.body;
            const result = await bookingCollection.insertOne(item)
            res.send(result)
        })

        // Get api to get book list of user...
        app.get('/booking', async (req, res) => {
            const email = req.query.email
            if (!email) {
                res.send([])
            }
            const query = { email: email };
            const result = await bookingCollection.find(query).toArray();
            res.send(result)
        })

        

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