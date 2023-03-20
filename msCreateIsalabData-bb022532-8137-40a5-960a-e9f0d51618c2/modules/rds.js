// Layers
const models = require("models");

let modelStarted = false;

async function connect(connection, schema) {
    models.init(connection, schema);
    modelStarted = true;
}

async function get(id) {
    try {
        let data = await models.Episode.query()
            .where("id", id)
            .withGraphFetched("[lives.[beneficiaries, life_locations, life_contacts], providers.[provider_contacts], procedures]");

        if (data.length > 0) {
            return data[0];
        } else return null;
    } catch (err) {
        throw err;
    }
}

function disconnect() {
    if (modelStarted)
        models.destroy();
}

module.exports = {
    connect,
    get,
    disconnect
}