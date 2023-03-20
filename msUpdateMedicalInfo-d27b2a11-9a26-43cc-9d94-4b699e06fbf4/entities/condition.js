const utils = require('utils.js');

async function execute(event, client) {
    try {

        event.data.main.data['id'] = event.id;

        const data = await client(`${event.db_schema}.conditions`)
            .where('id', '=', event.id)
            .update(event.data.main.data)
            .returning('*');

        if (data && data.length > 0) {
            return data[0];
        } else {
            throw utils.buildCustomError(404, 'Recurso não encontrado');
        }
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
    }
}

module.exports = {
    execute
}