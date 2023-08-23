const express = require('express')
const app = express()
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middleware
app.use(cors());
app.use(express.json());


// Implemented JWT verification middleware
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log(authorization)
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }

    const token = authorization.split(' ')[1]

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    });
}


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
        // const bookingCollection = client.db("travelODB").collection("booking");
        const bookingRequestCollection = client.db("travelODB").collection("bookingRequest");
        const paymentsCollection = client.db("travelODB").collection("payments");
        const contactMessageCollection = client.db("travelODB").collection("contactMessage");

        // Created JWT Generation Route
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        // Authorization Middleware for Admin Role
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'Admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

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

        // Patch api to update users from admin route
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateRole = req.body;
            const updateDoc = {
                $set: {
                    role: updateRole.role
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // Created GET API for finding user email is Admin or not... 
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'Admin' }
            res.send(result);
        })

        // Created GET API for finding user email is traveler or not...
        app.get('/users/traveler/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ traveler: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { traveler: user?.role === 'Traveler' }
            res.send(result);
        })

        // Create a GET API for getting destinations...
        app.get('/destinations', async (req, res) => {
            const places = await destinationsCollection.find().toArray();
            res.send(places)
        })

        // Create a GET API for getting popular destinations...
        app.get('/popularDestinations', async (req, res) => {
            const result = await destinationsCollection.find().sort({ sold_Tickets: -1 }).toArray()
            res.send(result)
        })

        // Create a POST API for adding destinations...
        app.post('/destinations', async (req, res) => {
            const query = req.body
            const result = await destinationsCollection.insertOne(query)
            res.send(result)
        })

        // Create a DELETE API for deleting single destinations...
        app.delete('/destinations/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await destinationsCollection.deleteOne(query);
            res.send(result);
        })

        // Create a POST API for updating accommodation...
        app.put('/destinations/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateAccommodation = req.body;
            const accommodations = {
                $set: {
                    name: updateAccommodation.name,
                    location: updateAccommodation.location,
                    about: updateAccommodation.about,
                    countryName: updateAccommodation.countryName,
                    image: updateAccommodation.image,
                    price: updateAccommodation.price,
                    numberOfDay: updateAccommodation.numberOfDay,
                    details: updateAccommodation.details,
                    reviews: updateAccommodation.reviews,
                    tourPlan: updateAccommodation.tourPlan,
                    includedServices: updateAccommodation.includedServices,
                },
            }
            const result = await destinationsCollection.updateOne(filter, accommodations, options)
            res.send(result);
        })

        // Create a POST API for inserting review...
        app.post('/destinations/:destinationId/addReview', async (req, res) => {
            const destinationId = req.params.destinationId;
            const newReview = req.body;

            // <----- Find the destination with the specified ID ----->
            const query = { _id: new ObjectId(destinationId) };
            const destination = await destinationsCollection.findOne(query);

            if (!destination) {
                return res.status(404).json({ error: 'Destination not found' });
            }

            // <----- Add the new review to the 'reviews' array of the destination ----->
            destination.reviews.push(newReview);

            // <----- Update the document in the collection with the new review ----->
            const result = await destinationsCollection.updateOne(query, { $set: { reviews: destination.reviews } });

            res.send(result)
        });


        // Get country api...
        app.get('/countries', async (req, res) => {
            const result = await countryCollection.find().toArray();
            res.send(result)
        })

        // Create a POST API for adding countries...
        app.post('/countries', async (req, res) => {
            const details = req.body;
            const query = { country: details.country }
            const existingCountry = await countryCollection.findOne(query)
            if (existingCountry) {
                return res.status(400).json({ message: 'Country already exist', countryName: existingCountry.country });
            }
            const result = await countryCollection.insertOne(details)
            res.send(result)
        })

        // Create a DELETE API for deleting single country...
        app.delete('/countries/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await countryCollection.deleteOne(query);
            res.send(result);
        })

        // Create a POST API for updating country...
        app.put('/countries/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateCountry = req.body;
            const countries = {
                $set: {
                    country: updateCountry.country,
                    countryImage: updateCountry.countryImage,
                    slogan: updateCountry.slogan,
                },
            }
            const result = await countryCollection.updateOne(filter, countries, options)
            res.send(result);
        })

        // Get api to get country wise accommodation
        app.get('/accommodation', async (req, res) => {
            try {
                const accommodationsByCountry = await destinationsCollection.aggregate([
                    {
                        $lookup: {
                            from: 'countries',
                            localField: 'countryName',
                            foreignField: 'country',
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
            const sort = { date: -1 };
            try {
                const result = await destinationsCollection.findOne(query)
                if (result && result.reviews) {
                    result.reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
                }
                res.send(result);
            } catch (error) {
                console.error('Error fetching accommodation details:', error);
                return res.status(500).json({ message: 'Internal server error.' });
            }
        });

        // Post api to insert booking collection
        app.post('/booking', async (req, res) => {
            const item = req.body;
            const result = await bookingRequestCollection.insertOne(item)
            res.send(result)
        })

        // Get api to get book list of user...
        app.get('/bookingRequest', verifyJWT, async (req, res) => {
            const email = req.query.email
            if (!email) {
                res.send([])
            }
            const query = { email: email };
            const result = await bookingRequestCollection.find(query).toArray();
            res.send(result)
        })

        // Delete api to delete booking request...
        app.delete('/bookingRequest/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingRequestCollection.deleteOne(query);
            res.send(result);
        })

        // Payment intent api...
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ["card"]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post('/payments', verifyJWT, async (req, res) => {
            // Payment saved to the database....
            const payments = req.body;
            const insertResult = await paymentsCollection.insertOne(payments)

            const query = { _id: { $in: payments.bookingItem_id.map(id => new ObjectId(id)) } }
            const deleteResult = await bookingRequestCollection.deleteMany(query)

            const updateDestinationsQuery = { _id: { $in: payments.accommodation_id.map(id => new ObjectId(id)) } };
            const updateDestinationsOptions = { $inc: { sold_Tickets: 1 } };
            const updateCourseResult = await destinationsCollection.updateMany(updateDestinationsQuery, updateDestinationsOptions);

            res.send({ insertResult, deleteResult, updateCourseResult })
        })

        // Get api to get payments by query email
        app.get('/payments', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const sort = { date: -1 };
            const result = await paymentsCollection.find(query).sort(sort).toArray();
            res.send(result);
        })

        // Get api to get all payments
        app.get('/allPayments', verifyJWT, verifyAdmin, async (req, res) => {
            const sort = { date: -1 };
            const result = await paymentsCollection.find().sort(sort).toArray();
            res.send(result);
        })

        // finding booking collection apis
        app.get('/booking', verifyJWT, async (req, res) => {
            try {
                const email = req.query.email;
                const query = { email: email };

                // Fetch payments based on the provided email
                const payments = await paymentsCollection.find(query).toArray();

                // Extract accommodation IDs from payments
                const accommodationIds = payments.map(payment => payment.accommodation_id).flat().map(id => new ObjectId(id));

                // Fetch accommodations matching the accommodation IDs
                const accommodations = await destinationsCollection.find({ _id: { $in: accommodationIds } }).toArray();

                // Create an object to hold the total number of tickets per accommodation
                const accommodationTickets = {};

                // Iterate through payments to calculate total tickets per accommodation
                payments.forEach(payment => {
                    payment.tickets.forEach(ticket => {
                        const accommodation = ticket.accommodation;

                        if (!accommodationTickets[accommodation]) {
                            accommodationTickets[accommodation] = 0;
                        }

                        accommodationTickets[accommodation] += ticket.tickets;
                    });
                });

                // Create an object to hold the total amount of price per accommodation
                const totalPaidAmount = {};

                // Iterate through payments to calculate total tickets per accommodation
                payments.forEach(payment => {
                    payment.tickets.forEach(ticket => {
                        const accommodation = ticket.accommodation;

                        if (!totalPaidAmount[accommodation]) {
                            totalPaidAmount[accommodation] = 0;
                        }

                        totalPaidAmount[accommodation] += ticket.paidAmount;
                    });
                });

                // Create an array to hold the final output
                const output = accommodations.map(accommodation => {
                    const totalTickets = accommodationTickets[accommodation.name] || 0;
                    const paidAmount = totalPaidAmount[accommodation.name] || 0;

                    return {
                        _id: accommodation._id,
                        name: accommodation.name,
                        location: accommodation.location,
                        about: accommodation.about,
                        tickets: totalTickets,
                        paidAmount: paidAmount,
                        countryName: accommodation.countryName,
                        image: accommodation.image,
                        price: accommodation.price,
                        numberOfDay: accommodation.numberOfDay,
                        details: accommodation.details,
                        reviews: accommodation.reviews,
                        includedServices: accommodation.includedServices,
                        tourPlan: accommodation.tourPlan
                    };
                });

                res.send(output);
            } catch (error) {
                console.error(error);
                res.status(500).send('Internal Server Error');
            }
        });

        app.get('/countryStats', verifyJWT, verifyAdmin, async (req, res) => {
            try {
                // Fetch payments based on the provided email
                const payments = await paymentsCollection.find().toArray();

                // Create an object to hold the country statistics
                const countryStats = {};

                // Iterate through payments to calculate country statistics
                payments.forEach(payment => {
                    payment.tickets.forEach(ticket => {
                        const country = ticket.country;

                        if (!countryStats[country]) {
                            countryStats[country] = {
                                countryName: country,
                                count: 0,
                                paidAmount: 0
                            };
                        }

                        countryStats[country].count += 1;
                        countryStats[country].paidAmount += ticket.paidAmount;
                    });
                });

                // Convert countryStats object to an array of values
                const countryStatsArray = Object.values(countryStats);

                res.send(countryStatsArray);
            } catch (error) {
                console.error(error);
                res.status(500).send('Internal Server Error');
            }
        });

        // finding all booking collection apis
        app.get('/allBooking', verifyJWT, verifyAdmin, async (req, res) => {
            try {
                // Fetch payments based on the provided email
                const payments = await paymentsCollection.find().toArray();

                // Extract accommodation IDs from payments
                const accommodationIds = payments.map(payment => payment.accommodation_id).flat().map(id => new ObjectId(id));

                // Fetch accommodations matching the accommodation IDs
                const accommodations = await destinationsCollection.find({ _id: { $in: accommodationIds } }).toArray();

                // Create an object to hold the total number of tickets per accommodation
                const accommodationTickets = {};

                // Iterate through payments to calculate total tickets per accommodation
                payments.forEach(payment => {
                    payment.tickets.forEach(ticket => {
                        const accommodation = ticket.accommodation;

                        if (!accommodationTickets[accommodation]) {
                            accommodationTickets[accommodation] = 0;
                        }

                        accommodationTickets[accommodation] += ticket.tickets;
                    });
                });

                // Create an object to hold the total amount of price per accommodation
                const totalPaidAmount = {};

                // Iterate through payments to calculate total tickets per accommodation
                payments.forEach(payment => {
                    payment.tickets.forEach(ticket => {
                        const accommodation = ticket.accommodation;

                        if (!totalPaidAmount[accommodation]) {
                            totalPaidAmount[accommodation] = 0;
                        }

                        totalPaidAmount[accommodation] += ticket.paidAmount;
                    });
                });

                // Create an array to hold the final output
                const output = accommodations.map(accommodation => {
                    const totalTickets = accommodationTickets[accommodation.name] || 0;
                    const paidAmount = totalPaidAmount[accommodation.name] || 0;

                    const payment = payments.find(payment => payment.accommodationName.includes(accommodation.name));

                    return {
                        _id: accommodation._id,
                        name: accommodation.name,
                        location: accommodation.location,
                        about: accommodation.about,
                        tickets: totalTickets,
                        paidAmount: paidAmount,
                        countryName: accommodation.countryName,
                        image: accommodation.image,
                        price: accommodation.price,
                        numberOfDay: accommodation.numberOfDay,
                        details: accommodation.details,
                        reviews: accommodation.reviews,
                        includedServices: accommodation.includedServices,
                        tourPlan: accommodation.tourPlan,
                        status: payment ? payment.status : 'unknown',
                        traveler_email: payment.email,
                        traveler_name: payment.name,
                        travelerPhone: payment.phoneNumber,
                    };
                });

                res.send(output);
            } catch (error) {
                console.error(error);
                res.status(500).send('Internal Server Error');
            }
        });

        // Create POST API to insert user contact message
        app.post('/contactMessage', async (req, res) => {
            const query = req.body
            const result = await contactMessageCollection.insertOne(query)
            res.send(result)
        })

        // Create GET API to get user contact message
        app.get('/contactMessage', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await contactMessageCollection.find().toArray();
            res.send(result)
        })

        // Create GET API to get single user contact message
        app.get('/message', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { userEmail: email };
            const result = await contactMessageCollection.find(query).toArray();
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