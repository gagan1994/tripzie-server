const { send_notfication, NOTIFICATION_TYPE } = require('.././notification/push_notification');

async function update_ride_users(ride_id, rideStatus) {
    const filter = { _id: new ObjectId(ride_id) };
    const update = {
        $set: {
            'status': rideStatus.status,// Update the status to the new value
            updatedAt: new Date(), // Optionally update other fields
        },
    };

    const options = { returnOriginal: true };
    const result = await ridesCollection.findOneAndUpdate(filter, update, options);
    console.log("result", result);
    return await notifyUserAboutRide(result, req, rideStatus);
}
async function notifyUserAboutRide(result, req, rideStatus) {
    const usersCollection = req.db.collection('profiles');
    const promises = await result.value.riders.map(async e => {
        const profile = await usersCollection.findOne({ _id: new ObjectId(e) })
        console.log("profile", profile);
        return profile && profile['fcmToken'];
    })
    Promise.all(promises)
        .then(registrationTokens => {
            notificationData = {
                body: rideStatus.message,
                title: result.name,
                data: {
                    type: NOTIFICATION_TYPE.RIDE_STATUS_NOTIFICATION,
                    message: result
                }
            }
            send_notfication(registrationTokens, notificationData)
        })
        .catch(error => {
            console.error('An error occurred:', error);
            return false
        });
    return true;
}


const RIDE_STATUS = Object.freeze({
    RIDE_CREATED: Symbol({ "message": "You were added to a ride.. 🏍️", "status": "IDLE" }),
    RIDE_UPDATED: Symbol({ "message": "Ride has modified 🏍️", "status": "IDLE" }),
    RIDE_STARTED: Symbol({ "message": "Ride started have safe trip 😎", "status": "STARTED" }),
    RIDE_ENDED: Symbol({ "message": "Your ride ended thank you 👏", "status": "COMPLETED" }),
    RIDE_LIVE: Symbol({ "message": "Speed thrills but kills drive safe🤗", "status": "ONGOING" }),
    //negative
    RIDE_DELETED: Symbol({ "message": "Ride deleted", "status": "DELETED" }),
});

module.exports = { RIDE_STATUS, update_ride_users };
