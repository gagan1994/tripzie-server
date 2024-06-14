const express = require('express');
const http = require('http');

const serverless = require('serverless-http');
require('dotenv').config();
const googleOAuth = require('./middleware/index');
const { ObjectId, MongoClient } = require('mongodb');
const firebaseAdmin = require('./config/firebase-config')
const { setup_web_socket } = require('./socket_wrapper/socket_server');
const { send_notfication, NOTIFICATION_TYPE } = require('./notification/push_notification');
const { update_ride_users, RIDE_STATUS } = require('./modules/ride_modules');

const app = express();

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Setup WebSocket server
setup_web_socket(server);

app.use(express.json());
app.use(async (req, res, next) => {
  console.log("app init");
  try {
    const client = await MongoClient.connect(process.env.URI_LOCAL_MAC);
    const db = client.db('test');
    req.db = db;
    req.client = client;
    next();
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    res.sendStatus(500);
  }
});
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
app.get('/status', (req, res) => {
  console.log("/status");
  res.send({ "status": "running" })
});
app.patch('/fcm_token', async (req, res) => {
  console.log("fcm_token", req.body);
  try {
    const updatedFields = { 'fcmToken': req.body.fcm_token }
    const usersCollection = req.db.collection('profiles');
    const result = await usersCollection.updateOne({ _id: new ObjectId(req.body.userid) },
      { $set: updatedFields });
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'profile not found' });
    }

    res.status(200).json({ message: 'profile updated with fcmtoken' });
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }
  req.client.close();
})
app.get('/current_rides', async (req, res) => {
  try {
    console.log("get current_rides");
    const ridesCollection = req.db.collection('trips');
    let query = {
      $or: {
        status: RIDE_STATUS.RIDE_LIVE.status,
        status: RIDE_STATUS.RIDE_STARTED.status
      }
    };
    const rides = await ridesCollection.find(query).toArray();
    res.json(rides);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});
app.post('/rides', async (req, res) => {
  try {
    console.log("create rides");
    const ridesCollection = req.db.collection('trips');
    req.body['status'] = RIDE_STATUS.RIDE_CREATED.status;
    const response = await ridesCollection.insertOne(req.body);
    await update_ride_users(response.insertedId, RIDE_STATUS.RIDE_CREATED)
    res.status(201).json(response);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});
app.delete('/rides/:id', async (req, res) => {
  try {
    const ridesCollection = req.db.collection('trips');
    console.log("req.params.id", req.params.id)
    await update_ride_users(req.params.id, RIDE_STATUS.RIDE_DELETED)
    const result = await ridesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.status(200).json(RIDE_STATUS.RIDE_DELETED);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});
app.get('/rides', async (req, res) => {
  try {
    const ridesCollection = req.db.collection('trips');
    const rides = await ridesCollection.find().toArray();
    res.json(rides);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }
  req.client.close();
});
app.get('/rides/:id', async (req, res) => {
  try {
    const ridesCollection = req.db.collection('trips');
    const objectId = new ObjectId(req.params.id);
    const rides = await ridesCollection.findOne({ _id: objectId });
    console.log("inside rides/id", req.params.id, rides)
    res.json(rides);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }
  req.client.close();
});
app.patch('/rides/:id', async (req, res) => {
  try {
    const updatedFields = req.body;
    const ridesCollection = req.db.collection('trips');
    console.log("req.params.id", req.params.id)
    const result = await ridesCollection.updateOne({ _id: new ObjectId(req.params.id) },
      { $set: updatedFields });
    update_ride_users(req.params.id, RIDE_STATUS.RIDE_CREATED)
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'ride not found' });
    }
    res.status(200).json({ message: 'ride updated successfully' });
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});
app.post('/start_ride', async (req, res) => {

  isStarted = await update_ride_users(req.body.ride_id, RIDE_STATUS.RIDE_STARTED)
  if (isStarted) {
    res.send(RIDE_STATUS.RIDE_STARTED).status(200);
  } else {
    res.send("error not able to start ride").status(501);
  }
})
app.post('/complete_ride', async (req, res) => {
  isSuccess = await update_ride_users(req.body.ride_id, RIDE_STATUS.RIDE_ENDED)
  if (isSuccess) {
    res.send(RIDE_STATUS.RIDE_ENDED).status(200)
  } else {
    res.send("error").status(500)
  }
})
app.delete('/ridesall', async (req, res) => {
  try {
    const ridesCollection = req.db.collection('trips');

    //const result = await ridesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    const result = await ridesCollection.deleteMany({}, function (err, result) {
      if (err) throw err;

      console.log(`Deleted ${result.deletedCount} documents from ${collectionName}`);

      // Close the MongoDB connection
      client.close();
    });
    console.log("result", result)
    // if (result.deletedCount === 0) {
    //   return res.status(404).json({ message: 'Document not found' });
    // }
    res.status(200).json({ message: 'Ride Document deleted successfully' });
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});


app.get('/profiles', async (req, res) => {
  try {
    const usersCollection = req.db.collection('profiles');
    const response = await usersCollection.find().toArray();
    res.json(response);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});
app.post('/profiles', async (req, res) => {
  try {
    console.log("req", req.body)
    const usersCollection = req.db.collection('profiles');
    query = {
      "$or": [
        { "phone": req.body["phone"] },
        { "email": req.body["email"] }
      ]
    }
    existing_document = await usersCollection.findOne(query)
    console.log("isExisting document: " + existing_document);
    body = "Welcome to TriPit. create ride, meet friends, and explore the world.🏍️💨";
    title = "Welcome🤗"
    if (existing_document) {
      const updateDocument = {
        $set: req.body
      };
      body = "Welcome back to TriPit. We missed you..."
      title = "Welcome Back🤗"
      notification_data = {
        body: body,
        title: title,
        data: {
          type: NOTIFICATION_TYPE.PUSH_NOTIFICATION,
          message: title
        }
      }
      result = await usersCollection.updateOne(query, updateDocument, upsert = true)
      console.log("Updated Exisitng")
      res.json({ "user_id": existing_document["_id"], "is_updated": true });
    } else {
      notification_data = {
        body: body,
        title: title,
        data: {
          type: NOTIFICATION_TYPE.PUSH_NOTIFICATION,
          message: title
        }
      }
      const users = await usersCollection.insertOne(req.body);
      res.json({ "user_id": users["inserted_id"], "is_updated": false });
      console.log("created new")
    }

    if (req.body['fcmToken']) {
      send_notfication([req.body['fcmToken']], notification_data)
    }
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});
app.get('/profiles/:id', async (req, res) => {
  try {
    const usersCollection = req.db.collection('profiles');
    const objectId = new ObjectId(req.params.id);
    const rides = await usersCollection.findOne({ _id: objectId });
    console.log("inside rides/id", req.params.id, rides)
    //const result = await collection.findOne({ _id :objectId});
    res.json(rides);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }
  req.client.close();
});
app.patch('/profiles/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const updatedFields = req.body;
    const usersCollection = req.db.collection('profiles');
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updatedFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }

  req.client.close();
});
app.get('/profiles/phone/:phone', async (req, res) => {
  try {
    const usersCollection = req.db.collection('profiles');
    //const objectId = new ObjectId(req.params.phone);

    const rides = await usersCollection.findOne({ phone: req.params.phone });
    console.log("inside rides/phone", req.params.phone, rides)
    //const result = await collection.findOne({ _id :objectId});
    res.json(rides);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }
  req.client.close();
});
app.get('/profiles/email/:email', async (req, res) => {
  try {
    const usersCollection = req.db.collection('profiles');
    //const objectId = new ObjectId(req.params.phone);

    const rides = await usersCollection.findOne({ email: req.params.email });
    console.log("inside rides/email", req.params.email, rides)
    //const result = await collection.findOne({ _id :objectId});
    res.json(rides);
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }
  req.client.close();
});
app.delete('/profiles/:id', async (req, res) => {
  try {
    const usersCollection = req.db.collection('profiles');
    console.log("req.params.id", req.params.id)
    const result = await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.status(200).json({ message: 'Profile Document deleted successfully' });
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});
app.delete('/profilesall', async (req, res) => {
  try {
    const ridesCollection = req.db.collection('trips');

    //const result = await ridesCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    const result = await ridesCollection.deleteMany({}, function (err, result) {
      if (err) throw err;

      console.log(`Deleted ${result.deletedCount} documents from ${collectionName}`);

      // Close the MongoDB connection
      client.close();
    });
    console.log("result", result)
    // if (result.deletedCount === 0) {
    //   return res.status(404).json({ message: 'Document not found' });
    // }
    res.status(200).json({ message: 'Ride Document deleted successfully' });
  } catch (error) {
    console.error('Error retrieving users from MongoDB:', error);
    res.sendStatus(500);
  }

  req.client.close();
});


if (process.env.DEV === 'true') {
  console.log('dev env')
  server.listen(process.env.PORT, () =>
    console.log(`Server is listening on port ${process.env.PORT}.${process.env.DEV} `)
  );
}
else {
  console.log("running serverless")
  exports.handler = serverless(app);
}

