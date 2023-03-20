const utils = require('utils.js');

async function execute(event, client) {
    try {

        event.data.main.data['id'] = event.id;

        return await client.transaction(async trx => {
            try {
                const data = await client(`${event.db_schema}.measurements`)
                    .where('id', '=', event.id)
                    .update(event.data.main.data)
                    .returning('*')
                    .transacting(trx);

                if (!data || data.length == 0) {
                    throw utils.buildCustomError(404, 'Recurso não encontrado');
                }

                return {
                    ...event.data.main.data,
                    id: event.id.toString()
                }
            } catch (err) {
                throw err;
            }
        });
    } catch (err) {
        throw err;
    } finally {
        client.destroy();
    }
}

module.exports = {
    execute
}